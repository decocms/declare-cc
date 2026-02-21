---
milestone: M-31-wholeness-state-computed-per-node
action: A-66
type: execute
wave: 2
depends_on:
  - A-65
files_modified:
  - src/commands/load-graph.js
  - dist/declare-tools.cjs
autonomous: true
declarations:
  - D-10
user_setup: []

must_haves:
  truths:
    - "GET /api/graph response includes wholeness field on every declaration node"
    - "GET /api/graph response includes wholeness field on every milestone node"
    - "GET /api/graph response includes wholeness field on every action node"
    - "Wholeness values are one of: whole, partial, broken"
  artifacts:
    - path: "src/commands/load-graph.js"
      provides: "Wholeness-enriched graph response"
      exports: ["runLoadGraph"]
      contains: "computeWholeness"
  key_links:
    - from: "src/commands/load-graph.js"
      to: "src/graph/engine.js computeWholeness"
      via: "calls dag.computeWholeness() and merges into node objects"
      pattern: "computeWholeness"
    - from: "src/server/index.js handleGraph"
      to: "src/commands/load-graph.js runLoadGraph"
      via: "existing call — no change needed, wholeness flows through automatically"
      pattern: "runLoadGraph"
---

<objective>
Wire wholeness computation into the /api/graph response so every node includes a `wholeness` field.

Purpose: The API is the single source of truth for the dashboard. Once wholeness is in the API response, all consumers (dashboard, CLI, future integrity visualization) get it for free.

Output: Updated `src/commands/load-graph.js` and rebuilt bundle.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-31-wholeness-state-computed-per-node/A-65-SUMMARY.md
@src/commands/load-graph.js
@src/commands/build-dag.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enrich graph response with wholeness field</name>
  <files>src/commands/load-graph.js</files>
  <action>
Modify `runLoadGraph()` in `src/commands/load-graph.js` to compute and attach wholeness to every node:

1. After `buildDagFromDisk(cwd)` returns `{ dag, declarations, milestones, actions }`, call `dag.computeWholeness()` to get the wholeness Map.
2. For each array (declarations, milestones, actions), map over the items and add a `wholeness` field by looking up the node's ID in the wholeness Map. Default to "broken" if not found (defensive).
3. Return the enriched arrays in the response.

The change is small — approximately 10 lines added to `runLoadGraph()`. The server's `handleGraph` already passes through whatever `runLoadGraph` returns, so no server changes needed.

Shape of enriched node:
```json
{ "id": "A-65", "title": "...", "status": "PENDING", "wholeness": "broken", ... }
```
  </action>
  <verify>
Run `node -e "const { runLoadGraph } = require('./src/commands/load-graph'); const r = runLoadGraph(process.cwd()); if (r.error) { console.log(r.error); process.exit(1); } const sample = r.actions[0]; console.log(sample.id, sample.wholeness); console.log('all have wholeness:', r.declarations.every(d => d.wholeness) && r.milestones.every(m => m.wholeness) && r.actions.every(a => a.wholeness));"` — should show a node with a wholeness value and "all have wholeness: true".
  </verify>
  <done>Every node in the runLoadGraph response has a wholeness field with value "whole", "partial", or "broken".</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild bundle and verify API response</name>
  <files>dist/declare-tools.cjs</files>
  <action>
Run `node esbuild.config.js` to rebuild the CJS bundle. Then verify the wholeness field appears in the API output by running `node -e` against the built bundle, confirming the graph response includes wholeness on all node types.
  </action>
  <verify>
Start server briefly and curl: `node -e "const {startServer}=require('./dist/declare-tools.cjs'); startServer(process.cwd(),0).then(({url,server})=>{fetch(url+'/api/graph').then(r=>r.json()).then(d=>{const ok=d.declarations.every(n=>n.wholeness)&&d.milestones.every(n=>n.wholeness)&&d.actions.every(n=>n.wholeness);console.log('wholeness in API:',ok);server.close()}).catch(e=>{console.error(e);server.close()})})"` — should print "wholeness in API: true".
  </verify>
  <done>The /api/graph endpoint returns wholeness field on every node. Bundle is rebuilt and working.</done>
</task>

</tasks>

<verification>
1. `runLoadGraph()` returns declarations/milestones/actions each with a `wholeness` field
2. Wholeness values are computed from the DAG (not hardcoded)
3. /api/graph HTTP response includes wholeness on all node types
4. No changes needed to server/index.js — it passes through load-graph output
5. Bundle rebuilt cleanly
</verification>

<success_criteria>
GET /api/graph returns every node (declaration, milestone, action) with a `wholeness` field valued "whole", "partial", or "broken", computed server-side from the DAG structure.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-31-wholeness-state-computed-per-node/A-66-SUMMARY.md`
</output>
