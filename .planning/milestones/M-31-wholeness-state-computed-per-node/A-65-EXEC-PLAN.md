---
milestone: M-31-wholeness-state-computed-per-node
action: A-65
type: execute
wave: 1
depends_on: []
files_modified:
  - src/graph/engine.js
autonomous: true
declarations:
  - D-10
user_setup: []

must_haves:
  truths:
    - "Action nodes report whole when status is DONE/KEPT/HONORED"
    - "Action nodes report broken when status is PENDING/ACTIVE/BROKEN/RENEGOTIATED"
    - "Milestone nodes report whole when ALL child actions are whole"
    - "Milestone nodes report partial when SOME child actions are whole"
    - "Milestone nodes report broken when NO child actions are whole"
    - "Declaration nodes report whole when ALL child milestones are whole"
    - "Declaration nodes report partial when SOME child milestones are whole"
    - "Declaration nodes report broken when NO child milestones are whole"
  artifacts:
    - path: "src/graph/engine.js"
      provides: "computeWholeness method on DeclareDag"
      exports: ["DeclareDag"]
      contains: "computeWholeness"
  key_links:
    - from: "src/graph/engine.js computeWholeness"
      to: "isCompleted helper"
      via: "action wholeness uses isCompleted(status)"
      pattern: "isCompleted\\(.*status"
    - from: "src/graph/engine.js computeWholeness"
      to: "getDownstream"
      via: "milestone/declaration wholeness aggregates children"
      pattern: "getDownstream|downEdges"
---

<objective>
Add a `computeWholeness()` method to the DeclareDag class that returns a Map of node ID to wholeness state ("whole", "partial", "broken").

Purpose: This is the core Erhard integrity model — every node in the graph knows whether it is whole, partial, or broken based on the completion state of its children.

Output: Updated `src/graph/engine.js` with the new method, rebuilt bundle.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/graph/engine.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add computeWholeness method to DeclareDag</name>
  <files>src/graph/engine.js</files>
  <action>
Add a `computeWholeness()` method to the DeclareDag class in `src/graph/engine.js`. The method:

1. Creates a `Map<string, string>` mapping node ID to wholeness state.
2. Iterates all nodes in the graph using `this.nodes`:
   - **Actions:** Use the existing `isCompleted(status)` function. If completed → "whole", else → "broken". Actions are leaf nodes with no children to aggregate.
   - **Milestones:** Get child actions via `this.downEdges.get(id)`. For each child, check if child is whole (use `isCompleted` on child status). If ALL children are whole → "whole". If SOME are whole → "partial". If NONE are whole (or no children exist) → "broken".
   - **Declarations:** Get child milestones via `this.downEdges.get(id)`. For each child milestone, recursively check: a milestone is "whole" only if all its actions are completed. Apply same ALL/SOME/NONE logic. If ALL child milestones are whole → "whole". If SOME → "partial". If NONE (or no children) → "broken".

Important: For declarations, do NOT use the milestone's own status field — compute milestone wholeness from its actions first, then aggregate. This ensures the wholeness computation is purely structural (based on action completion), not relying on potentially stale milestone status fields.

Implementation approach — bottom-up in one pass:
1. First pass: compute action wholeness (trivial — just isCompleted check)
2. Second pass: compute milestone wholeness by aggregating action results
3. Third pass: compute declaration wholeness by aggregating milestone results

Return the Map from the method.

Also export a standalone `computeWholeness(dag)` function (not just the method) for use by other modules that receive a dag instance.
  </action>
  <verify>
Run `node -e "const { DeclareDag, isCompleted } = require('./src/graph/engine'); const dag = new DeclareDag(); dag.addNode('D-01','declaration','Test',  'PENDING'); dag.addNode('M-01','milestone','Test','PENDING'); dag.addNode('A-01','action','Test','DONE'); dag.addNode('A-02','action','Test','PENDING'); dag.addEdge('A-01','M-01'); dag.addEdge('A-02','M-01'); dag.addEdge('M-01','D-01'); const w = dag.computeWholeness(); console.log(JSON.stringify(Object.fromEntries(w)));"` — expect A-01=whole, A-02=broken, M-01=partial, D-01=partial.
  </verify>
  <done>computeWholeness returns correct wholeness for all node types: actions based on completion status, milestones based on child action wholeness, declarations based on child milestone wholeness.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild bundle and verify</name>
  <files>dist/declare-tools.cjs</files>
  <action>
Run `node esbuild.config.js` to rebuild the CJS bundle. Then verify the wholeness computation works through the built bundle by running a quick smoke test loading the bundle.
  </action>
  <verify>
Run `node -e "const t = require('./dist/declare-tools.cjs'); console.log('bundle OK');"` — should print "bundle OK" with no errors.
  </verify>
  <done>Bundle rebuilt successfully with wholeness computation included.</done>
</task>

</tasks>

<verification>
1. `computeWholeness()` method exists on DeclareDag
2. Action: DONE/KEPT/HONORED → whole; PENDING/ACTIVE/BROKEN/RENEGOTIATED → broken
3. Milestone: all actions whole → whole; some → partial; none → broken
4. Declaration: all milestones whole → whole; some → partial; none → broken
5. Edge case: nodes with no children → broken
6. Bundle rebuilds cleanly
</verification>

<success_criteria>
The DeclareDag class exposes computeWholeness() returning a Map of wholeness states for every node, computed bottom-up from action completion through milestone aggregation to declaration aggregation.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-31-wholeness-state-computed-per-node/A-65-SUMMARY.md`
</output>
