---
milestone: M-46-execution-gated-on-approval
action: A-98
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
  - src/commands/play.js
autonomous: true
declarations:
  - D-13

must_haves:
  truths:
    - "POST /api/action/:id/execute returns 403 when the action's reviewState is not 'approved'"
    - "POST /api/play returns 403 when any in-scope action has reviewState not 'approved'"
    - "403 response body includes list of unapproved action nodes with id, title, and reviewState"
    - "Actions with reviewState 'approved' execute normally (no regression)"
  artifacts:
    - path: "src/server/index.js"
      provides: "Approval gate in handleExecuteAction"
      contains: "reviewState.*approved"
    - path: "src/commands/play.js"
      provides: "Approval gate in play start()"
      contains: "reviewState.*approved"
  key_links:
    - from: "src/server/index.js handleExecuteAction"
      to: "graph actions reviewState"
      via: "runLoadGraph then filter unapproved"
      pattern: "reviewState.*!==.*approved"
    - from: "src/commands/play.js start()"
      to: "graph actions reviewState"
      via: "computePlayOrder actions checked before execution"
      pattern: "reviewState.*!==.*approved"
---

<objective>
Add server-side approval gates to both execution endpoints so actions cannot run unless their reviewState is "approved".

Purpose: Enforce D-13 (Plan Verification Before Execution) at the API layer — nothing executes without explicit human approval.
Output: Modified server/index.js and commands/play.js with 403 gates.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/index.js
@src/commands/play.js
@src/commands/load-graph.js
@src/commands/build-dag.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate POST /api/action/:id/execute on approval</name>
  <files>src/server/index.js</files>
  <action>
In `handleExecuteAction` (line ~432), after the existing exec-plan validation but before calling `pm.execute()`, add an approval gate:

1. Load the graph via `runLoadGraph(cwd)` to get the action's reviewState.
2. Find the action in `graph.actions` by matching `actionId` (case-insensitive).
3. If the action's `reviewState` is not `'approved'`, return 403 with:
   ```json
   {
     "error": "Action not approved for execution",
     "unapproved": [{ "id": "A-98", "title": "...", "reviewState": "draft" }]
   }
   ```
4. If `reviewState === 'approved'`, proceed with existing execution logic unchanged.

Note: `runLoadGraph` is already imported at the top of index.js. The action object from `graph.actions` has `reviewState` populated from PLAN.md (via build-dag.js).
  </action>
  <verify>
Start the server with `node -e "require('./src/server/index').startServer(process.cwd())"`, then:
- `curl -X POST http://localhost:3847/api/action/A-98/execute` should return 403 with unapproved list (since A-98 is not approved).
- Confirm the response JSON has `error` and `unapproved` array fields.
  </verify>
  <done>POST /api/action/:id/execute returns 403 with unapproved node list when action reviewState is not "approved". Approved actions execute normally.</done>
</task>

<task type="auto">
  <name>Task 2: Gate POST /api/play on approval</name>
  <files>src/commands/play.js</files>
  <action>
In the `start()` function of `createPlayRunner` (line ~239), after `computePlayOrder(graph)` returns waves but before setting `isRunning = true`:

1. Collect ALL actions across all waves. For each action ID in the waves, find the action in `graph.actions`.
2. Filter to those where `reviewState !== 'approved'`.
3. If any unapproved actions exist, return an error object instead of starting:
   ```js
   return {
     error: 'Cannot play: unapproved actions exist',
     unapproved: unapprovedActions.map(a => ({ id: a.id, title: a.title, reviewState: a.reviewState }))
   };
   ```
4. The caller in index.js (line ~1178) already checks `result.error` and returns 409. Update that block to also forward `result.unapproved` in the response and use status 403 when `result.unapproved` exists:
   ```js
   if (result.error) {
     const status = result.unapproved ? 403 : 409;
     sendJson(res, status, { error: result.error, ...(result.unapproved && { unapproved: result.unapproved }) });
   }
   ```

The `graph` variable already contains actions with `reviewState` from `runLoadGraph(cwd)` called at line 244.
  </action>
  <verify>
With the server running, confirm:
- `curl -X POST http://localhost:3847/api/play` returns 403 with the full list of unapproved actions when any exist.
- The response includes both `error` and `unapproved` array.
  </verify>
  <done>POST /api/play returns 403 with full unapproved action list when any in-scope action is not approved. When all are approved, play proceeds normally.</done>
</task>

</tasks>

<verification>
1. Server starts without errors after changes
2. POST /api/action/:id/execute with unapproved action returns 403 + unapproved list
3. POST /api/play with any unapproved action returns 403 + unapproved list
4. Existing execution flow unchanged for approved actions
</verification>

<success_criteria>
Both execute endpoints reject unapproved actions with 403 and a structured error response listing all unapproved nodes.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-46-execution-gated-on-approval/A-98-SUMMARY.md`
</output>
