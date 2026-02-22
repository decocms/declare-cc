---
milestone: M-43-review-state-tracked-per-node
action: A-89
type: execute
wave: 1
depends_on: []
files_modified:
  - src/graph/engine.js
  - src/artifacts/future.js
  - src/artifacts/milestones.js
  - src/artifacts/plan.js
  - src/commands/build-dag.js
autonomous: true
declarations:
  - D-13
user_setup: []

must_haves:
  truths:
    - "Every D, M, A node in the DAG carries a reviewState in its metadata"
    - "reviewState defaults to 'draft' when not explicitly set"
    - "FUTURE.md, MILESTONES.md, and PLAN.md persist the review state field"
    - "Round-trip parse->write preserves review state without data loss"
  artifacts:
    - path: "src/graph/engine.js"
      provides: "VALID_REVIEW_STATES constant exported"
      contains: "VALID_REVIEW_STATES"
    - path: "src/artifacts/future.js"
      provides: "Review field parsing and writing for declarations"
      contains: "Review"
    - path: "src/artifacts/milestones.js"
      provides: "Review column in milestone table"
      contains: "Review"
    - path: "src/artifacts/plan.js"
      provides: "Review field parsing and writing for actions"
      contains: "Review"
    - path: "src/commands/build-dag.js"
      provides: "reviewState populated in node metadata from parsed artifacts"
      contains: "reviewState"
  key_links:
    - from: "src/artifacts/future.js"
      to: "src/commands/build-dag.js"
      via: "parseFutureFile returns reviewState field, buildDagFromDisk puts it in metadata"
      pattern: "reviewState"
    - from: "src/artifacts/milestones.js"
      to: "src/commands/build-dag.js"
      via: "parseMilestonesFile returns reviewState field, buildDagFromDisk puts it in metadata"
      pattern: "reviewState"
    - from: "src/artifacts/plan.js"
      to: "src/commands/build-dag.js"
      via: "parsePlanFile returns reviewState per action, buildDagFromDisk puts it in metadata"
      pattern: "reviewState"
---

<objective>
Add reviewState field to the graph engine and all three artifact parsers (FUTURE.md, MILESTONES.md, PLAN.md) so every node in the DAG carries a review state that persists through parse/write round-trips.

Purpose: Foundation for the review-gated execution system (D-13). Without review state on nodes, no other review feature can function.
Output: VALID_REVIEW_STATES constant, updated parsers/writers, reviewState in DAG node metadata.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/graph/engine.js
@src/artifacts/future.js
@src/artifacts/milestones.js
@src/artifacts/plan.js
@src/commands/build-dag.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add VALID_REVIEW_STATES to engine and update all three artifact parsers/writers</name>
  <files>
    src/graph/engine.js
    src/artifacts/future.js
    src/artifacts/milestones.js
    src/artifacts/plan.js
  </files>
  <action>
**engine.js changes:**
- Add a `VALID_REVIEW_STATES` Set: `new Set(['draft', 'in_review', 'revision_needed', 'approved'])`
- Export it from the module alongside existing exports

**future.js changes (FUTURE.md parser/writer):**
- In `parseFutureFile`: after extracting Status, extract `**Review:**` field using the existing `extractField` helper. Default to `'draft'` if not present. Add `reviewState` to the returned declaration object.
- In `writeFutureFile`: after the `**Status:**` line, add `**Review:** ${d.reviewState || 'draft'}` line.
- Update the JSDoc @returns typedef to include `reviewState: string`.

**milestones.js changes (MILESTONES.md parser/writer):**
- In `parseMilestonesFile`: read `row['Review']` cell, default to `'draft'`. Add `reviewState` to the returned milestone object.
- In `writeMilestonesFile`: add `'Review'` column to the table. Always include it (not conditional like Description) since all nodes will have it. Add it after the `Plan` column. The value is `m.reviewState || 'draft'`.
- Update JSDoc typedefs accordingly.

**plan.js changes (PLAN.md parser/writer):**
- In `parsePlanFile`: after extracting `Status` and `Produces` for each action, extract `**Review:**` field. Default to `'draft'`. Add `reviewState` to the returned action object.
- In `writePlanFile`: after the `**Status:**` line for each action, add `**Review:** ${action.reviewState || 'draft'}`.
- Update JSDoc typedefs accordingly.

Important: The parsers must be permissive — if the Review field is missing (existing files), default to 'draft' without error. The writers must always output the field.
  </action>
  <verify>
Run `node -e "const f = require('./src/artifacts/future'); const m = require('./src/artifacts/milestones'); const p = require('./src/artifacts/plan'); const e = require('./src/graph/engine'); console.log('VALID_REVIEW_STATES:', [...e.VALID_REVIEW_STATES]); const d = f.parseFutureFile('## D-01: Test\n**Statement:** x\n**Status:** PENDING\n**Milestones:** M-01\n'); console.log('future parse reviewState:', d[0].reviewState); const written = f.writeFutureFile(d, 'test'); console.log('future write has Review:', written.includes('**Review:**')); const ms = m.parseMilestonesFile('## Milestones\n\n| ID | Title | Status | Realizes | Plan | Review |\n|---|---|---|---|---|---|\n| M-01 | Test | PENDING | D-01 | YES | approved |\n'); console.log('milestones parse reviewState:', ms.milestones[0].reviewState); const pa = p.parsePlanFile('# Plan: M-01 -- Test\n**Milestone:** M-01\n**Realizes:** D-01\n**Status:** PENDING\n**Derived:** 2026-01-01\n## Actions\n### A-01: Do thing\n**Status:** PENDING\n**Produces:** stuff\n'); console.log('plan parse default reviewState:', pa.actions[0].reviewState);"` — all should output correct values with 'draft' defaults.
  </verify>
  <done>
VALID_REVIEW_STATES exported from engine.js. All three parsers read reviewState (defaulting to 'draft'). All three writers output the Review field. Existing files without Review field parse without error.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire reviewState through build-dag into DAG node metadata</name>
  <files>
    src/commands/build-dag.js
  </files>
  <action>
In `buildDagFromDisk`:

1. **Declarations** (line ~87-89): When adding declaration nodes, include `reviewState: d.reviewState || 'draft'` in the metadata object alongside the existing `ref` field.

2. **Milestones** (line ~92-96): When adding milestone nodes, include `reviewState: m.reviewState || 'draft'` in the metadata object alongside existing `description`, `classification`, `dependsOn`.

3. **Actions** (line ~98-99): Currently actions are added with no metadata (`dag.addNode(a.id, 'action', a.title, a.status || 'PENDING')`). Change to pass `{ reviewState: a.reviewState || 'draft' }` as the metadata argument.

4. In `loadActionsFromFolders`: when building the action object from parsed plan data, include `reviewState: action.reviewState || 'draft'` so it flows through to buildDagFromDisk.

This ensures the /api/graph response (which serializes the DAG including metadata) automatically includes reviewState on every node without any changes to load-graph.js or server/index.js.
  </action>
  <verify>
Run `node -e "const { buildDagFromDisk } = require('./src/commands/build-dag'); const result = buildDagFromDisk(process.cwd()); if (result.error) { console.log(result.error); process.exit(1); } const node = result.dag.getNode('D-06'); console.log('D-06 metadata:', JSON.stringify(node.metadata)); const m = result.dag.getNode('M-18'); console.log('M-18 metadata:', JSON.stringify(m.metadata)); const actions = result.dag.getActions(); if (actions.length > 0) { console.log('First action metadata:', JSON.stringify(actions[0].metadata)); }"` — all nodes should have `reviewState: "draft"` in their metadata.
  </verify>
  <done>
Every D, M, A node in the DAG has reviewState in metadata. Default is 'draft'. The /api/graph endpoint automatically includes reviewState in its response since it serializes node metadata.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const { buildDagFromDisk } = require('./src/commands/build-dag'); const r = buildDagFromDisk(process.cwd()); const dag = r.dag; const json = dag.toJSON(); const noReview = json.nodes.filter(n => !n.metadata || !n.metadata.reviewState); console.log('Nodes missing reviewState:', noReview.length); console.log('Total nodes:', json.nodes.length);"` — 0 nodes missing reviewState.
2. Parse existing FUTURE.md, MILESTONES.md, PLAN.md files — no errors, all default to 'draft'.
3. Write then re-parse a declaration/milestone/action with non-default reviewState — value survives round-trip.
</verification>

<success_criteria>
- VALID_REVIEW_STATES constant exported from engine.js with exactly: draft, in_review, revision_needed, approved
- parseFutureFile/writeFutureFile handle **Review:** field (default: draft)
- parseMilestonesFile/writeMilestonesFile handle Review column (default: draft)
- parsePlanFile/writePlanFile handle **Review:** field per action (default: draft)
- buildDagFromDisk populates reviewState in metadata for all node types
- Existing files without Review field parse without error (backward compatible)
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-review-state-tracked-per-node/A-89-SUMMARY.md`
</output>
