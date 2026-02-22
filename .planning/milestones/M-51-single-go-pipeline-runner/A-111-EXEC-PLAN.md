---
milestone: M-51-single-go-pipeline-runner
action: A-111
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/pipeline-runner.js
  - src/server/index.js
autonomous: true
declarations: ["D-15"]
must_haves:
  truths:
    - "POST /api/execute-pipeline reads .planning/execution-manifest.json and runs all milestones/actions in declared wave order"
    - "Pipeline executes waves sequentially, actions within a wave concurrently"
    - "SSE events broadcast pipeline-start, wave-start, action-output, action-complete, wave-complete, pipeline-complete"
    - "Pipeline can be stopped mid-execution via POST /api/execute-pipeline/stop"
  artifacts:
    - path: "src/server/pipeline-runner.js"
      provides: "Manifest-driven pipeline runner"
      exports: ["createPipelineRunner"]
    - path: "src/server/index.js"
      provides: "Pipeline API routes"
      contains: "/api/execute-pipeline"
  key_links:
    - from: "src/server/pipeline-runner.js"
      to: ".planning/execution-manifest.json"
      via: "fs.readFileSync on start()"
      pattern: "execution-manifest\\.json"
    - from: "src/server/pipeline-runner.js"
      to: "claude CLI"
      via: "spawn('claude', ...)"
      pattern: "spawn\\('claude'"
    - from: "src/server/index.js"
      to: "src/server/pipeline-runner.js"
      via: "lazy singleton like getPlayRunner pattern"
      pattern: "getPipelineRunner"
---

<objective>
Create the manifest-driven pipeline runner that replaces ad-hoc Play All with a deterministic, manifest-ordered execution engine.

Purpose: This is the core of D-15 "Autonomous Execution to Completion" -- once the user confirms the execution order (M-50), this runner executes the entire pipeline without intervention.
Output: POST /api/execute-pipeline endpoint, pipeline-runner.js module
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/commands/play.js
@src/server/process-manager.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create pipeline-runner.js manifest-driven executor</name>
  <files>src/server/pipeline-runner.js</files>
  <action>
Create `src/server/pipeline-runner.js` exporting `createPipelineRunner(sseClients, cwd)`. Follow the exact pattern of `createPlayRunner` in `src/commands/play.js` (closure-based singleton with start/stop/running/status methods).

Key differences from play runner:
1. `start()` reads `.planning/execution-manifest.json` (not computePlayOrder from graph). Parse manifest expecting structure: `{ waves: [{ wave: N, milestones: [{ id: string, actions: [string] }] }] }`. Return error if manifest not found or malformed.
2. No approval gate check (already approved before manifest creation in M-50).
3. Wave execution: iterate manifest waves sequentially. Within each wave, execute all actions across all milestones concurrently using same `spawn('claude', ['-p', prompt, '--no-input'])` pattern.
4. `executeAction(actionId, milestoneId)` -- identical to play runner's executeAction (spawn claude, line-buffered stdout/stderr, broadcast SSE, append to execution.log). Extract into a shared helper or copy -- prefer copy to avoid touching play.js.
5. SSE events: `pipeline-start` (manifest summary), `pipeline-wave-start`, `action-output`, `action-complete`, `pipeline-wave-complete`, `pipeline-complete` (with completed/failed/stopped arrays).
6. Track per-action timing: record startTime on spawn, compute duration on close. Store in results array: `{ actionId, milestoneId, exitCode, durationMs, startedAt, completedAt }`.
7. `stop()` sets stopRequested flag, kills all active processes with SIGTERM.
8. `status()` returns { running, currentWave, totalWaves, activeActions, completedActions, failedActions, results }.

Use the same `appendLog` and `findMilestoneFolder` patterns from play.js. CJS module, zero external deps, @ts-check.
  </action>
  <verify>
`node -e "const { createPipelineRunner } = require('./src/server/pipeline-runner.js'); console.log(typeof createPipelineRunner)"` prints "function"
  </verify>
  <done>pipeline-runner.js exports createPipelineRunner, reads manifest, executes waves in order, broadcasts SSE events, tracks per-action timing</done>
</task>

<task type="auto">
  <name>Task 2: Wire pipeline API routes into server</name>
  <files>src/server/index.js</files>
  <action>
In `src/server/index.js`:

1. Add `require` for pipeline-runner at top with other requires:
   `const { createPipelineRunner } = require('./pipeline-runner');`

2. Add lazy singleton (same pattern as playRunner on line 1039-1048):
   ```
   let pipelineRunner = null;
   function getPipelineRunner(cwd) {
     if (!pipelineRunner) pipelineRunner = createPipelineRunner(sseClients, cwd);
     return pipelineRunner;
   }
   ```

3. Add POST routes near the existing play routes (after line ~1603):
   - `POST /api/execute-pipeline` -- calls `getPipelineRunner(cwd).start()`, returns 202 on success, 409 if already running, 400 if manifest error.
   - `POST /api/execute-pipeline/stop` -- calls `getPipelineRunner(cwd).stop()`, returns 200 on success, 400 if not running.

4. Add GET route:
   - `GET /api/execute-pipeline/status` -- calls `getPipelineRunner(cwd).status()`, returns 200 with status object.

Follow exact same sendJson/error pattern as existing play routes.
  </action>
  <verify>
Start server with `node src/server/index.js` (or however it starts), then:
- `curl -s -X POST http://localhost:3847/api/execute-pipeline` returns JSON (either error about manifest or starts pipeline)
- `curl -s http://localhost:3847/api/execute-pipeline/status` returns JSON status
  </verify>
  <done>Three pipeline API routes registered, lazy singleton wired, server starts without errors</done>
</task>

</tasks>

<verification>
- `node -c src/server/pipeline-runner.js` -- syntax OK
- `node -c src/server/index.js` -- syntax OK
- Server starts and `/api/execute-pipeline` responds to POST
- `/api/execute-pipeline/status` returns { running: false, status: null } when idle
</verification>

<success_criteria>
POST /api/execute-pipeline reads execution-manifest.json, executes milestones in wave order with concurrent actions per wave, streams SSE events, and can be stopped. Pipeline status is queryable via GET endpoint.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-51-single-go-pipeline-runner/A-111-SUMMARY.md`
</output>
