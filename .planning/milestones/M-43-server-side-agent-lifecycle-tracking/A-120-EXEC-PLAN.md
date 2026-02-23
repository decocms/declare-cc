---
milestone: M-43-server-side-agent-lifecycle-tracking
action: A-120
type: execute
wave: 2
depends_on: ["A-119"]
files_modified:
  - src/server/process-manager.js
  - src/server/derivation-runner.js
  - src/server/action-derivation-runner.js
  - src/server/revision-runner.js
  - src/server/pipeline-runner.js
  - src/server/index.js
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "Every agent spawn from any runner registers with the AgentRegistry"
    - "Every agent completion (success or failure) updates the registry"
    - "The registry is a singleton created once in index.js and injected into all runners"
  artifacts:
    - path: "src/server/process-manager.js"
      provides: "Registry integration for single-action execution"
      contains: "registry.spawn"
    - path: "src/server/derivation-runner.js"
      provides: "Registry integration for milestone derivation"
      contains: "registry.spawn"
    - path: "src/server/action-derivation-runner.js"
      provides: "Registry integration for action derivation"
      contains: "registry.spawn"
    - path: "src/server/revision-runner.js"
      provides: "Registry integration for plan revision"
      contains: "registry.spawn"
    - path: "src/server/pipeline-runner.js"
      provides: "Registry integration for pipeline execution"
      contains: "registry.spawn"
  key_links:
    - from: "src/server/index.js"
      to: "src/server/agent-registry.js"
      via: "createAgentRegistry singleton, passed to all runners"
      pattern: "createAgentRegistry"
    - from: "src/server/process-manager.js"
      to: "agent-registry"
      via: "registry parameter in factory function"
      pattern: "registry\\.spawn.*execution"
    - from: "src/server/pipeline-runner.js"
      to: "agent-registry"
      via: "registry parameter in factory function"
      pattern: "registry\\.spawn.*pipeline"
---

<objective>
Wire the AgentRegistry into every spawn point in the server so that every agent (execution, derivation, action-derivation, revision, pipeline) is tracked from birth to death.

Purpose: Without this wiring, the registry exists but knows nothing. This action makes it the single source of truth for all agent activity.
Output: All 5 runner modules accept and use the registry. index.js creates the singleton and injects it.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-119-SUMMARY.md
@src/server/agent-registry.js
@src/server/process-manager.js
@src/server/derivation-runner.js
@src/server/action-derivation-runner.js
@src/server/revision-runner.js
@src/server/pipeline-runner.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add registry parameter to all runner factories and hook lifecycle calls</name>
  <files>
    src/server/process-manager.js
    src/server/derivation-runner.js
    src/server/action-derivation-runner.js
    src/server/revision-runner.js
    src/server/pipeline-runner.js
  </files>
  <action>
Modify each runner's factory function to accept an optional `registry` parameter (last parameter, defaults to null for backward compatibility). The registry is the object returned by `createAgentRegistry()`.

**process-manager.js** — `createProcessManager(sseClients, cwd, registry)`:
- In `execute(actionId, milestoneId)`: After spawning the process (line ~123 where `processes.set()`), call `registry.spawn('execution', actionId, milestoneId)` and store the returned agent record's `id` on the ProcessEntry (add `agentId` field to the ProcessEntry typedef).
- In `proc.on('close')`: Call `registry.complete(agentId, { exitCode })` if exitCode === 0, or `registry.fail(agentId, exitCode, 'process exited')` otherwise. Look up agentId from the ProcessEntry before deleting it.
- In `proc.on('error')`: Call `registry.fail(agentId, -1, 'spawn error')`.
- Guard all registry calls with `if (registry)` so existing tests/callers without registry still work.

**derivation-runner.js** — `createDerivationRunner(sseClients, cwd, registry)`:
- In `derive()`: After setting `current`, call `registry.spawn('derivation', declarationId || 'all', '')`. Store agentId on `current`.
- In `proc.on('close')`: If exitCode === 0, call `registry.complete(agentId, { milestones })`. Otherwise `registry.fail(agentId, exitCode, 'derivation failed')`.
- In `proc.on('error')`: `registry.fail(agentId, -1, 'spawn error')`.

**action-derivation-runner.js** — `createActionDerivationRunner(sseClients, cwd, registry)`:
- In `derive()`: After setting `current`, call `registry.spawn('action-derivation', milestone.id, milestone.id)`. Store agentId on `current`.
- In `proc.on('close')`: Complete or fail based on exitCode. Result: `{ actions }`.
- In `proc.on('error')`: Fail with -1.

**revision-runner.js** — `createRevisionRunner(sseClients, cwd, onComplete, registry)`:
- In `revise()`: After setting `current`, call `registry.spawn('revision', nodeId, '')`. Store agentId on `current`.
- In `proc.on('close')`: Complete with `{ revisionRound: newRound }` on success, fail otherwise.
- In `proc.on('error')`: Fail with -1.

**pipeline-runner.js** — `createPipelineRunner(sseClients, cwd, registry)`:
- In `start()`: After validating manifest, call `registry.spawn('pipeline', 'manifest', '')` to register the pipeline itself as an agent. Store the agentId in a module-level variable `pipelineAgentId`.
- In `executeAction()`: Call `registry.spawn('execution', actionId, milestoneId)` before spawning the process. Store agentId. On close/error, complete or fail.
- In the pipeline completion block (the async IIFE after all waves): Call `registry.complete(pipelineAgentId, { completed, failed, reportPath })` or `registry.fail(...)` based on outcome.
- In `stop()`: For each active process, call `registry.fail(agentId, -1, 'stopped by user')`.

Pattern for all: registry calls are always guarded with `if (registry)`. Never import agent-registry.js in the runners — the registry object is injected.
  </action>
  <verify>
Each runner self-test still passes (they pass null/undefined for registry):
- `node src/server/process-manager.js` (no self-test, but `node -e "require('./src/server/process-manager.js')"` should not throw)
- `node src/server/derivation-runner.js` prints OK
- `node src/server/action-derivation-runner.js` prints OK
- `node src/server/revision-runner.js` prints OK
- `node -e "require('./src/server/pipeline-runner.js')"` should not throw
  </verify>
  <done>
All 5 runner factories accept an optional registry parameter. Every spawn point calls registry.spawn(). Every completion/error calls registry.complete() or registry.fail(). All calls guarded with `if (registry)`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create registry singleton in index.js and inject into all runners</name>
  <files>src/server/index.js</files>
  <action>
In src/server/index.js:

1. Add require at top (near line 38, after other requires):
   `const { createAgentRegistry } = require('./agent-registry');`

2. Create the registry singleton (near line 1087, after sseClients declaration):
   ```js
   /** @type {ReturnType<typeof createAgentRegistry> | null} */
   let agentRegistry = null;

   function getAgentRegistry(cwd) {
     if (!agentRegistry) {
       agentRegistry = createAgentRegistry(cwd, (event, data) => {
         const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
         for (const client of sseClients) {
           try { client.write(payload); } catch (_) { sseClients.delete(client); }
         }
       });
     }
     return agentRegistry;
   }
   ```

3. Update ALL runner getter functions to pass registry:
   - `getProcessManager(cwd)`: pass `getAgentRegistry(cwd)` as 3rd arg
   - `getDerivationRunner(cwd)`: pass `getAgentRegistry(cwd)` as 3rd arg
   - `getActionDerivationRunner(cwd)`: pass `getAgentRegistry(cwd)` as 3rd arg
   - `getRevisionRunner(cwd)`: pass `getAgentRegistry(cwd)` as 4th arg (after onComplete)
   - `getPipelineRunner(cwd)`: pass `getAgentRegistry(cwd)` as 3rd arg

Each getter creates its runner only once (existing singleton pattern), so the registry is injected at creation time.

IMPORTANT: Do NOT add API routes yet (that is A-121). Only wire the registry creation and injection here.
  </action>
  <verify>
`node -e "require('./src/server/index.js')"` should not throw (the module can be required without starting the server).
Grep for `getAgentRegistry` in index.js — should appear in each getter function.
Grep for `createAgentRegistry` in index.js — should appear exactly once in the require and once in the getter.
  </verify>
  <done>
AgentRegistry singleton created in index.js with SSE broadcast wired in. All 5 runner getter functions pass the registry to their respective factory functions. The broadcastFn sends SSE events (agent-start, agent-update, agent-complete) to all connected clients.
  </done>
</task>

</tasks>

<verification>
- All runner self-tests pass (backward compatible with no registry)
- index.js requires agent-registry and creates singleton
- All 5 getXxxRunner functions pass registry to their factories
- Grep confirms registry.spawn appears in all 5 runner files
- Grep confirms registry.complete and registry.fail appear in all 5 runner files
</verification>

<success_criteria>
Every agent spawn across all 5 runners registers with the AgentRegistry. Every completion or failure updates the registry. SSE events agent-start, agent-update, agent-complete are broadcast automatically via the registry's broadcastFn.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-120-SUMMARY.md`
</output>
