---
milestone: M-43-server-side-agent-lifecycle-tracking
action: A-119
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/agent-registry.js
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "Registry tracks every agent with a unique ID, type, target, status, and timestamps"
    - "Agents transition through spawn -> running -> complete/fail lifecycle"
    - "Registry state persists to .planning/agent-state.json periodically and on every lifecycle transition"
    - "Registry returns both active agents and recently completed agents (last 50, max 30 minutes old)"
  artifacts:
    - path: "src/server/agent-registry.js"
      provides: "AgentRegistry class with full lifecycle management"
      exports: ["createAgentRegistry"]
  key_links:
    - from: "src/server/agent-registry.js"
      to: ".planning/agent-state.json"
      via: "fs.writeFileSync on lifecycle transitions"
      pattern: "writeFileSync.*agent-state\\.json"
---

<objective>
Build the AgentRegistry module — an in-memory registry that tracks every agent (execution, derivation, action-derivation, revision, pipeline) through its full lifecycle. The registry is the server-side single source of truth for "what is the system doing right now."

Purpose: Foundation for D-16 (Real-Time Agent Presence). All other M-43 actions depend on this module.
Output: src/server/agent-registry.js with createAgentRegistry factory function.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/process-manager.js
@src/server/pipeline-runner.js
@src/server/derivation-runner.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create AgentRegistry class with lifecycle methods</name>
  <files>src/server/agent-registry.js</files>
  <action>
Create src/server/agent-registry.js as a CJS module (matching all other server modules — zero runtime dependencies, @ts-check, 'use strict').

Export a `createAgentRegistry(cwd, broadcastFn)` factory that returns the registry object. Parameters:
- `cwd` — project root, used for persistence path
- `broadcastFn` — callback `(event, data) => void` for SSE broadcast (injected by index.js)

Internal state:
- `agents` Map keyed by agent ID (string)
- `recentAgents` array for completed/failed agents (FIFO, max 50 entries, prune entries older than 30 minutes on access)

Agent record shape (JSDoc typedef `AgentRecord`):
```
{
  id: string,           // unique ID like "exec-A-119-1708XXX" or "deriv-D-16-1708XXX"
  type: string,         // "execution" | "derivation" | "action-derivation" | "revision" | "pipeline"
  target: string,       // what it's operating on: "A-119", "D-16", "M-43", etc.
  milestoneId: string,  // parent milestone if applicable, empty string otherwise
  status: string,       // "running" | "complete" | "failed" | "interrupted"
  startedAt: string,    // ISO timestamp
  updatedAt: string,    // ISO timestamp of last status change
  completedAt: string|null,
  exitCode: number|null,
  error: string|null,   // error message on failure
  result: object|null   // structured result metadata (set on completion by caller)
}
```

Lifecycle methods on the returned object:

1. `spawn(type, target, milestoneId)` — Creates a new AgentRecord with status "running", adds to `agents` map, calls `broadcastFn('agent-start', record)`, persists state, returns the record. Generate ID as `${type.slice(0,4)}-${target}-${Date.now()}`.

2. `update(agentId, patch)` — Merges patch into the agent record, updates `updatedAt`, calls `broadcastFn('agent-update', record)`, persists state. Used for progress updates.

3. `complete(agentId, result)` — Sets status to "complete", `completedAt` to now, `exitCode` to 0, `result` to the provided object, moves from `agents` to `recentAgents`, calls `broadcastFn('agent-complete', record)`, persists state.

4. `fail(agentId, exitCode, errorMessage)` — Sets status to "failed", `completedAt` to now, `exitCode`, `error` to errorMessage, moves from `agents` to `recentAgents`, calls `broadcastFn('agent-complete', record)` (same event type, status field differentiates), persists state.

5. `get(agentId)` — Returns the agent record from either active or recent, or null.

6. `getActive()` — Returns array of all agents in `agents` map (status "running").

7. `getRecent(limit)` — Returns array of recent agents (pruned for staleness), default limit 20.

8. `getAll()` — Returns `{ active: getActive(), recent: getRecent() }`.

9. `markInterrupted(agentIds)` — For each ID in the array, if found in `agents`, sets status to "interrupted", moves to `recentAgents`, persists. Used by A-122 restart logic.

10. `loadFromDisk()` — Reads `.planning/agent-state.json`, returns the parsed state or null. Does NOT modify in-memory state (caller decides what to do with it). Never throws.

Persistence method (private):
- `persistState()` — Writes `{ agents: Object.fromEntries(agents), recentAgents, persistedAt: ISO timestamp }` to `.planning/agent-state.json`. Uses `writeFileSync` wrapped in try/catch (never throws, matching existing pattern in pipeline-runner.js). Called after every lifecycle transition.

Add a self-test block at the bottom (matching pattern in derivation-runner.js):
```js
if (require.main === module) {
  const reg = createAgentRegistry('.', () => {});
  const a = reg.spawn('execution', 'A-01', 'M-01');
  console.log('spawned:', a.id, a.status);
  reg.complete(a.id, { path: 'test.md' });
  console.log('completed:', reg.get(a.id).status);
  console.log('active:', reg.getActive().length);
  console.log('recent:', reg.getRecent().length);
  console.log('OK');
}
```
  </action>
  <verify>
Run `node src/server/agent-registry.js` — should print spawned/completed/active/recent/OK without errors.
Verify the file exports createAgentRegistry: `node -e "const { createAgentRegistry } = require('./src/server/agent-registry.js'); console.log(typeof createAgentRegistry);"` should print "function".
  </verify>
  <done>
AgentRegistry module exists at src/server/agent-registry.js. Self-test passes. spawn/update/complete/fail/get/getActive/getRecent/getAll/markInterrupted/loadFromDisk methods all implemented. State persists to .planning/agent-state.json on every lifecycle transition.
  </done>
</task>

</tasks>

<verification>
- `node src/server/agent-registry.js` passes self-test
- File follows CJS pattern matching process-manager.js and derivation-runner.js
- No runtime dependencies beyond Node built-ins (fs, path)
- JSDoc types for AgentRecord and all public methods
</verification>

<success_criteria>
createAgentRegistry factory function exported from src/server/agent-registry.js. All 10 public methods implemented. Self-test demonstrates full spawn -> complete lifecycle. State persists to .planning/agent-state.json.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-119-SUMMARY.md`
</output>
