---
milestone: M-41-execute-actions-from-dashboard
action: A-87
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
  - src/server/process-manager.js
autonomous: true
declarations:
  - D-08

must_haves:
  truths:
    - "POST /api/action/:id/execute spawns claude CLI and returns 202"
    - "SSE clients receive action-output events with stdout/stderr lines"
    - "SSE clients receive action-complete event with exit code on process end"
    - "POST /api/action/:id/stop kills a running process and returns 200"
    - "GET /api/running returns list of currently running action IDs"
    - "Duplicate execute request returns 409 when action already running"
    - "Execute request for action without exec-plan returns 400"
  artifacts:
    - path: "src/server/process-manager.js"
      provides: "Process lifecycle management — spawn, track, stop, stream"
      exports: ["createProcessManager"]
    - path: "src/server/index.js"
      provides: "POST routes for execute, stop, and GET route for running"
      contains: "handleExecuteAction"
  key_links:
    - from: "src/server/process-manager.js"
      to: "child_process.spawn"
      via: "spawns claude CLI with -p flag"
      pattern: "spawn\\('claude'"
    - from: "src/server/process-manager.js"
      to: "sseClients"
      via: "broadcasts action-output and action-complete events"
      pattern: "action-output|action-complete"
    - from: "src/server/index.js"
      to: "src/server/process-manager.js"
      via: "route handler calls process manager"
      pattern: "require.*process-manager"
---

<objective>
Add an execute endpoint and process manager to the Declare server so actions can be triggered from the dashboard.

Purpose: Enables the dashboard to spawn Claude executor sessions for planned actions, streaming output back to the UI in real time via SSE. This is the backend half of the "execute from dashboard" feature (D-08).

Output: Three new API endpoints (execute, stop, running) and a process manager module that handles Claude CLI child process lifecycle.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-41-execute-actions-from-dashboard/PLAN.md
@src/server/index.js
@src/commands/get-exec-plan.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create process manager module</name>
  <files>src/server/process-manager.js</files>
  <action>
Create `src/server/process-manager.js` — a CJS module that exports `createProcessManager(sseClients, cwd)`.

The returned object must expose:
- `execute(actionId, milestoneId)` — spawns Claude CLI, returns `{ok: true}` or `{error: string}`
- `stop(actionId)` — sends SIGTERM to running process, returns `{ok: true}` or `{error: string}`
- `running()` — returns array of currently running action IDs

Implementation details:

1. Internal state: `const processes = new Map()` keyed by actionId, value is `{proc, milestoneId}`.

2. `execute(actionId, milestoneId)`:
   - If `processes.size > 0`, return `{error: 'busy', status: 409}` (one-at-a-time cap).
   - If `processes.has(actionId)`, return `{error: 'already_running', status: 409}`.
   - Build prompt: `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`
   - Spawn: `child_process.spawn('claude', ['-p', prompt, '--no-input'], { cwd, env: { ...process.env, FORCE_COLOR: '0' } })`.
   - Store in `processes` Map.
   - Pipe stdout and stderr line-by-line. For each line, iterate `sseClients` and write SSE event:
     ```
     event: action-output\ndata: {"actionId":"...","text":"...","stream":"stdout"}\n\n
     ```
     Use a simple line-buffering approach: accumulate chunks, split on `\n`, emit complete lines, keep remainder.
   - On process `close` event: remove from `processes`, broadcast to all SSE clients:
     ```
     event: action-complete\ndata: {"actionId":"...","exitCode":N}\n\n
     ```
   - On process `error` event (e.g. claude not found): remove from Map, broadcast action-complete with exitCode -1.
   - Return `{ok: true}`.

3. `stop(actionId)`:
   - If not in `processes`, return `{error: 'not_running', status: 404}`.
   - Call `proc.kill('SIGTERM')`. The `close` handler above will clean up.
   - Return `{ok: true}`.

4. `running()`:
   - Return `[...processes.keys()]`.

Use zero external dependencies. Use `require('node:child_process')` only. Follow the existing codebase convention of JSDoc type annotations and `'use strict'`.
  </action>
  <verify>
Run `node -e "const pm = require('./src/server/process-manager.js'); const m = pm.createProcessManager(new Set(), '/tmp'); console.log(typeof m.execute, typeof m.stop, typeof m.running)"` from project root — should print `function function function`.
  </verify>
  <done>Module exports createProcessManager. execute/stop/running methods exist and have correct signatures. Line-buffered SSE broadcast logic implemented for stdout and stderr streams.</done>
</task>

<task type="auto">
  <name>Task 2: Add POST routes and wire process manager into server</name>
  <files>src/server/index.js</files>
  <action>
Modify `src/server/index.js` to support the three new endpoints. Changes:

1. Add require at top:
   ```js
   const { createProcessManager } = require('./process-manager');
   ```

2. Update CORS preflight (line ~286) to allow POST:
   Change `'Access-Control-Allow-Methods': 'GET, OPTIONS'` to `'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'` in BOTH the OPTIONS handler AND the `sendJson` helper.

3. Remove the blanket `method !== 'GET'` rejection (lines 293-296). Replace with method-aware routing: let GET and POST through, reject others with 405.

4. Add POST route matching BEFORE the static file routes. The route function should handle these patterns:

   **POST /api/action/:id/execute**
   - Parse actionId from URL via regex: `/^\/api\/action\/([^/]+)\/execute$/`
   - Call `runGetExecPlan(cwd, ['--action', actionId])` to validate the action exists and has an exec-plan.
   - If result has `error` or `execPlan` is null, return `sendJson(res, 400, {error: 'Action not found or no exec-plan'})`.
   - Extract `milestoneId` from the result.
   - Call `processManager.execute(actionId, milestoneId)`.
   - If result has error, return `sendJson(res, result.status || 500, {error: result.error})`.
   - Otherwise return `sendJson(res, 202, {ok: true, actionId})`.

   **POST /api/action/:id/stop**
   - Parse actionId from URL via regex: `/^\/api\/action\/([^/]+)\/stop$/`
   - Call `processManager.stop(actionId)`.
   - If result has error, return `sendJson(res, result.status || 500, {error: result.error})`.
   - Otherwise return `sendJson(res, 200, {ok: true})`.

   **GET /api/running**
   - Return `sendJson(res, 200, {running: processManager.running()})`.

5. Initialize process manager: The `processManager` needs access to `sseClients` and `cwd`. Since `route()` already receives `cwd` and `sseClients` is module-level, create the process manager lazily. Add a module-level variable:
   ```js
   /** @type {ReturnType<typeof createProcessManager> | null} */
   let processManager = null;

   function getProcessManager(cwd) {
     if (!processManager) processManager = createProcessManager(sseClients, cwd);
     return processManager;
   }
   ```
   Use `getProcessManager(cwd)` inside route handlers.

6. Keep all existing GET routes exactly as they are. The new POST routes should be matched after the method check but before static file serving.
  </action>
  <verify>
Run `node -e "require('./src/server/index.js')"` from project root — should not throw.
Run the existing test suite if present: `npm test` or `node --test` to confirm no regressions.
Start the server briefly and test with curl:
- `curl -X POST http://localhost:3847/api/action/A-01/execute` should return 400 (no such action) or 202, not 405.
- `curl http://localhost:3847/api/running` should return `{"running":[]}`.
- `curl -X POST http://localhost:3847/api/action/A-01/stop` should return 404 (not running).
  </verify>
  <done>Server accepts POST requests. Execute endpoint validates action, spawns claude CLI, streams output via SSE. Stop endpoint kills running process. Running endpoint lists active action IDs. All existing GET routes still work without regression.</done>
</task>

</tasks>

<verification>
1. Start the server: `node -e "const {startServer} = require('./src/server/index.js'); startServer(process.cwd()).then(s => console.log(s.url))"`
2. Open SSE stream in one terminal: `curl -N http://localhost:3847/events`
3. In another terminal, call execute on a real action that has an EXEC-PLAN: `curl -X POST http://localhost:3847/api/action/A-87/execute`
4. Observe SSE events flowing (action-output lines, then action-complete)
5. Verify GET /api/running shows the action while running
6. Verify duplicate execute returns 409
7. Verify POST /api/action/A-87/stop sends SIGTERM
8. Verify all existing GET endpoints still return expected data
</verification>

<success_criteria>
- POST /api/action/:id/execute spawns claude CLI and returns 202 for valid actions with exec-plans
- POST /api/action/:id/execute returns 400 for missing action or missing exec-plan
- POST /api/action/:id/execute returns 409 when an action is already running
- stdout and stderr from claude process arrive as SSE action-output events
- Process exit triggers SSE action-complete event with exit code
- POST /api/action/:id/stop kills running process with SIGTERM
- GET /api/running returns array of running action IDs (empty when idle)
- All pre-existing GET routes (graph, status, milestone, activity, action, events) work unchanged
- Zero new runtime dependencies added
</success_criteria>

<output>
After completion, create `.planning/milestones/M-41-execute-actions-from-dashboard/A-87-SUMMARY.md`
</output>
