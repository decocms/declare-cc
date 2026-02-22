---
milestone: M-33-workability-path-surface
action: A-69
type: execute
wave: 1
depends_on: []
files_modified:
  - src/graph/engine.js
  - src/graph/engine.test.js
  - src/server/index.js
autonomous: true
declarations: ["D-10"]

must_haves:
  truths:
    - "Given any node ID, the system returns the leaf-level broken/pending actions blocking its wholeness"
    - "Each fix step includes actionId, title, milestoneId, and an impact score based on upstream unblock count"
    - "A whole node returns an empty fix-steps array"
    - "The workability path is accessible via GET /api/workability/:id"
  artifacts:
    - path: "src/graph/engine.js"
      provides: "computeWorkabilityPath function"
      exports: ["computeWorkabilityPath"]
      contains: "computeWorkabilityPath"
    - path: "src/graph/engine.test.js"
      provides: "Tests for workability path computation"
      contains: "computeWorkabilityPath"
    - path: "src/server/index.js"
      provides: "GET /api/workability/:id endpoint"
      contains: "/api/workability/"
  key_links:
    - from: "src/server/index.js"
      to: "src/graph/engine.js"
      via: "require and function call"
      pattern: "computeWorkabilityPath"
    - from: "src/graph/engine.js computeWorkabilityPath"
      to: "src/graph/engine.js computeWholeness"
      via: "internal call to get wholeness map before traversal"
      pattern: "computeWholeness"
---

<objective>
Implement the workability path computation algorithm and expose it via API.

Purpose: Given any node in the DAG, trace downward through non-whole children to find the root-cause broken/pending actions that block wholeness. This is the core "path to workability" that D-10 (Integrity as Architecture) requires -- making diminished integrity actionable.

Output: `computeWorkabilityPath` function in engine.js, tests in engine.test.js, GET /api/workability/:id endpoint in server/index.js.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-33-workability-path-surface/PLAN.md
@src/graph/engine.js
@src/graph/engine.test.js
@src/server/index.js
@src/commands/load-graph.js
@src/commands/build-dag.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement computeWorkabilityPath and add tests</name>
  <files>src/graph/engine.js, src/graph/engine.test.js</files>
  <action>
Add a `computeWorkabilityPath(dag, nodeId)` standalone function to `src/graph/engine.js` (after the existing `computeWholeness` function, before `module.exports`).

Algorithm:
1. Call `dag.computeWholeness()` to get the wholeness map for all nodes.
2. If the target node's wholeness is "whole", return `{ nodeId, wholeness: "whole", steps: [] }`.
3. If nodeId is not found in the DAG, throw an Error with message `Node not found: ${nodeId}`.
4. Walk downward through the DAG using `dag.downEdges` following only children whose wholeness is NOT "whole" (i.e., "broken" or "partial").
5. Collect leaf-level broken actions: actions (type === "action") whose wholeness is "broken" (meaning status is not completed -- PENDING, ACTIVE, or BROKEN).
6. For each collected action, compute `impact` by counting how many UNIQUE upstream nodes (milestones + declarations) would be unblocked if this action became whole. Do this by walking `dag.upEdges` recursively from the action, collecting all ancestor node IDs. Count = number of ancestors whose wholeness is currently NOT "whole".
7. Classify impact: "high" if count >= 3, "medium" if count >= 1, "low" if count === 0.
8. Each step object: `{ actionId: string, title: string, milestoneId: string, impact: "high"|"medium"|"low" }`. The `milestoneId` is the first milestone found in `dag.getUpstream(actionId)` (actions always have at least one milestone parent via upEdges).
9. Sort steps by impact descending (high first, then medium, then low), then alphabetically by actionId as tiebreaker.
10. Return `{ nodeId, wholeness: wholenessMap.get(nodeId), steps }`.

Export `computeWorkabilityPath` in `module.exports` alongside existing exports.

Then add tests to `src/graph/engine.test.js` (inside the existing describe block, after test 24). Import `computeWorkabilityPath` from the require at the top of the file. Add these tests:

Test 25: `computeWorkabilityPath returns empty steps for whole node` -- Build a DAG with D-01, M-01, A-01 (DONE), all connected. Verify steps is empty array and wholeness is "whole".

Test 26: `computeWorkabilityPath returns broken leaf actions` -- Build a DAG with D-01, M-01 (connected), A-01 (DONE), A-02 (PENDING) both causing M-01. Verify steps contains one entry for A-02 with correct actionId, title, milestoneId "M-01".

Test 27: `computeWorkabilityPath computes impact correctly` -- Build a DAG with D-01, D-02, M-01 (realizes D-01), M-02 (realizes D-02), A-01 (PENDING, causes both M-01 and M-02). Call computeWorkabilityPath(dag, "D-01"). Verify A-01 has impact "high" (blocks M-01, M-02, D-01, D-02 = 4 non-whole ancestors >= 3).

Test 28: `computeWorkabilityPath traverses multi-level DAG` -- Build D-01, M-01, M-02, A-01 (DONE causes M-01), A-02 (PENDING causes M-01), A-03 (PENDING causes M-02). M-01 and M-02 both realize D-01. Call on D-01. Verify steps has A-02 and A-03 (not A-01 since it is DONE).

Test 29: `computeWorkabilityPath throws for unknown node` -- Call with non-existent "X-99". Assert throws /Node not found/.

Test 30: `computeWorkabilityPath sorts by impact descending then by actionId` -- Build a DAG where A-01 has high impact and A-02 has medium impact. Verify A-01 comes first in steps.

Follow the existing test style: `node:test` describe/it, `node:assert/strict`, section comment headers with test numbers.
  </action>
  <verify>Run `node --test src/graph/engine.test.js` -- all 30 tests pass (24 existing + 6 new).</verify>
  <done>computeWorkabilityPath exported from engine.js. All 30 tests pass. Function correctly traces non-whole paths, collects broken leaf actions, computes impact, and sorts results.</done>
</task>

<task type="auto">
  <name>Task 2: Add GET /api/workability/:id endpoint</name>
  <files>src/server/index.js</files>
  <action>
Add a `handleWorkability` function and route it in the server.

1. At the top of `src/server/index.js`, update the require for build-dag to also import `buildDagFromDisk`:
   `const { buildDagFromDisk } = require('../commands/build-dag');`
   Also import `computeWorkabilityPath` from the engine:
   `const { computeWorkabilityPath } = require('../graph/engine');`

2. Add a `handleWorkability(res, cwd, nodeId)` function (place it after `handleMilestone`):
   - Call `buildDagFromDisk(cwd)` to get the DAG (same pattern as load-graph uses).
   - If result has `error`, return 500 with the error.
   - Normalize nodeId: uppercase, e.g., `const normalizedId = nodeId.toUpperCase();`
   - If `dag.getNode(normalizedId)` returns undefined, return 404 with `{ error: "Node 'X' not found" }`.
   - Call `computeWorkabilityPath(dag, normalizedId)`.
   - Return 200 with the result via `sendJson`.
   - Wrap in try/catch, return 500 on error (same pattern as other handlers).

3. In the `route` function, add a route match BEFORE the existing `milestoneMatch` block (to avoid conflicts):
   ```
   const workabilityMatch = urlPath.match(/^\/api\/workability\/([^/]+)$/);
   if (workabilityMatch) {
     handleWorkability(res, cwd, workabilityMatch[1]);
     return;
   }
   ```

Do NOT modify any existing handlers or routes. Only add the new import, handler function, and route match.
  </action>
  <verify>
Start the server with `node -e "require('./src/server/index').startServer(process.cwd()).then(s => { console.log(s.url); setTimeout(() => s.server.close(), 5000) })"` and test:
- `curl http://localhost:3847/api/workability/D-10` returns JSON with nodeId, wholeness, and steps array.
- `curl http://localhost:3847/api/workability/X-99` returns 404.
- Verify the build still bundles: `npm run build` (or equivalent if present).
  </verify>
  <done>GET /api/workability/:id endpoint returns workability path for any node. 404 for unknown nodes. Integrates with existing server patterns (sendJson, try/catch, CORS headers via sendJson).</done>
</task>

</tasks>

<verification>
1. `node --test src/graph/engine.test.js` -- all tests pass (including 6 new workability tests)
2. `node --test src/commands/commands.test.js` -- existing command tests still pass (no regressions)
3. Server manually tested: GET /api/workability/:id returns correct workability path JSON
4. `computeWorkabilityPath` is exported and usable from require('./src/graph/engine')
</verification>

<success_criteria>
- computeWorkabilityPath(dag, nodeId) traces diminished integrity to root broken/pending actions
- Each step has { actionId, title, milestoneId, impact } with impact derived from upstream unblock count
- Whole nodes return empty steps array
- Unknown nodes throw/return 404
- Steps sorted by impact (high > medium > low) then by actionId
- GET /api/workability/:id endpoint works end-to-end
- All existing tests pass (no regressions)
- 6 new engine tests validate the algorithm
</success_criteria>

<output>
After completion, create `.planning/milestones/M-33-workability-path-surface/A-69-SUMMARY.md`
</output>
