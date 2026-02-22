---
milestone: M-19-browser-based-milestone-derivation
action: A-38
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
autonomous: true
declarations:
  - D-06
must_haves:
  truths:
    - "POST /api/milestones/derive triggers a derivation subprocess and returns a session ID"
    - "POST /api/milestones/derive/stop stops the running derivation"
    - "POST /api/milestones/derive/accept accepts proposed milestones and persists them via add-milestones-batch"
    - "GET /api/derivation/running returns the current derivation session ID or null"
  artifacts:
    - path: "src/server/index.js"
      provides: "Derivation API routes wired to derivation-runner"
      contains: "handleDerive"
  key_links:
    - from: "src/server/index.js"
      to: "src/server/derivation-runner.js"
      via: "require and getDerivationRunner singleton"
      pattern: "require.*derivation-runner"
    - from: "src/server/index.js handleDeriveAccept"
      to: "src/commands/add-milestones-batch.js"
      via: "runAddMilestonesBatch call"
      pattern: "runAddMilestonesBatch"
---

<objective>
Add milestone derivation API endpoints to the server: trigger derivation, stop it, check status, and accept proposed milestones.

Purpose: Exposes the derivation-runner (A-37) to the browser UI through HTTP endpoints, following the same patterns as the existing execute/stop endpoints for action execution.

Output: Updated `src/server/index.js` with 4 new routes.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/index.js
@src/server/process-manager.js
@src/server/derivation-runner.js
@src/commands/add-milestones-batch.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add derivation API routes to server</name>
  <files>src/server/index.js</files>
  <action>
Modify `src/server/index.js` to add 4 derivation endpoints. Follow the exact patterns used for action execution (handleExecuteAction, stop route, running route).

**1. Add require at top:**
```js
const { createDerivationRunner } = require('./derivation-runner');
const { runAddMilestonesBatch } = require('../commands/add-milestones-batch');
```

**2. Add derivation runner singleton** (same pattern as getProcessManager):
```js
/** @type {ReturnType<typeof createDerivationRunner> | null} */
let derivationRunner = null;

function getDerivationRunner(cwd) {
  if (!derivationRunner) derivationRunner = createDerivationRunner(sseClients, cwd);
  return derivationRunner;
}
```

**3. Add handler function handleDerive(req, res, cwd):**
- Parse JSON body from POST request (use standard Node pattern: collect chunks, JSON.parse)
- Body shape: `{ declarationId?: string }` (optional — null means derive for all undone declarations)
- Load graph via `runLoadGraph(cwd)` to get declarations array
- Extract declarations with their statements and milestone counts: `graph.declarations.map(d => ({ id: d.id, statement: d.statement, milestones: d.milestones || [] }))`
- Call `getDerivationRunner(cwd).derive(body.declarationId || null, declarations)`
- If error, return sendJson(res, status, { error })
- If ok, return sendJson(res, 202, { ok: true, sessionId })

**4. Add handler function handleDeriveStop(res, cwd):**
- Call `getDerivationRunner(cwd).stop()`
- Return result similar to action stop handler

**5. Add handler function handleDeriveAccept(req, res, cwd):**
- Parse JSON body: `{ milestones: [{ title, realizes }] }`
- Call `runAddMilestonesBatch(cwd, ['--json', JSON.stringify(body.milestones)])`
- If error, return sendJson(res, 400, { error })
- If ok, return sendJson(res, 200, result)

**6. Wire routes in the route() function's POST section** (after existing POST routes, before the 404 fallback):
```js
if (urlPath === '/api/milestones/derive') {
  handleDerive(req, res, cwd);
  return;
}
if (urlPath === '/api/milestones/derive/stop') {
  handleDeriveStop(res, cwd);
  return;
}
if (urlPath === '/api/milestones/derive/accept') {
  handleDeriveAccept(req, res, cwd);
  return;
}
```

**7. Wire GET route for derivation status** (in GET section):
```js
if (urlPath === '/api/derivation/running') {
  const dr = getDerivationRunner(cwd);
  sendJson(res, 200, { running: dr.running() });
  return;
}
```

**Body parsing helper** — add a small utility function since the server doesn't have one yet:
```js
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
```

Make handleDerive and handleDeriveAccept async (they await parseBody). Wrap in try/catch with sendJson error response.
  </action>
  <verify>
Run `node -e "const { createServer } = require('./src/server/index.js'); console.log('OK')"` — should print OK without errors (confirms the require chain works with the new imports).

Verify routes exist by searching the file for the 4 new URL patterns.
  </verify>
  <done>
Server has POST /api/milestones/derive (trigger), POST /api/milestones/derive/stop (cancel), POST /api/milestones/derive/accept (persist), and GET /api/derivation/running (status) endpoints. All follow existing server patterns.
  </done>
</task>

</tasks>

<verification>
- `node -e "require('./src/server/index.js')"` loads without error
- grep confirms all 4 route patterns exist in index.js
- handleDerive calls derivation-runner.derive()
- handleDeriveAccept calls runAddMilestonesBatch()
</verification>

<success_criteria>
All 4 derivation API endpoints are wired in the server, following existing code patterns. POST /api/milestones/derive triggers derivation, /derive/stop cancels it, /derive/accept persists proposed milestones, and GET /api/derivation/running returns session status.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-19-browser-based-milestone-derivation/A-38-SUMMARY.md`
</output>
