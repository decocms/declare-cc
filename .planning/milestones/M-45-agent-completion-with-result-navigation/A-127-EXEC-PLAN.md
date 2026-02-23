---
milestone: M-45-agent-completion-with-result-navigation
action: A-127
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/process-manager.js
  - src/server/derivation-runner.js
  - src/server/action-derivation-runner.js
  - src/server/revision-runner.js
  - src/server/pipeline-runner.js
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "Execution agents record the SUMMARY path and action ID in their result metadata on completion"
    - "Derivation agents record the array of milestone IDs they created in result metadata"
    - "Action-derivation agents record the milestone ID and action count in result metadata"
    - "Revision agents record the revised plan path in result metadata"
    - "Pipeline agents record the report path, completed count, and failed count in result metadata"
  artifacts:
    - path: "src/server/process-manager.js"
      provides: "Result metadata for single-action execution"
      contains: "registry.complete"
    - path: "src/server/derivation-runner.js"
      provides: "Result metadata for milestone derivation"
      contains: "registry.complete"
    - path: "src/server/pipeline-runner.js"
      provides: "Result metadata for pipeline execution"
      contains: "registry.complete"
  key_links:
    - from: "src/server/process-manager.js"
      to: "agent-registry"
      via: "registry.complete with structured result object"
      pattern: "registry\\.complete.*actionId|registry\\.complete.*path"
    - from: "src/server/derivation-runner.js"
      to: "agent-registry"
      via: "registry.complete with milestones array"
      pattern: "registry\\.complete.*milestones"
    - from: "src/server/pipeline-runner.js"
      to: "agent-registry"
      via: "registry.complete with report metadata"
      pattern: "registry\\.complete.*reportPath|completed|failed"
---

<objective>
Ensure every runner passes meaningful structured result metadata to registry.complete() so that completed agent cards can display what was produced and navigate to it.

Purpose: A-120 (M-43) wires registry.spawn/complete/fail into all runners, but the `result` object passed to `registry.complete()` needs to contain the right artifact metadata for each agent type. This action enriches those completion calls with structured data the client can use for navigation.
Output: All 5 runners pass type-specific result objects on completion.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-119-EXEC-PLAN.md
@.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-120-EXEC-PLAN.md
@src/server/process-manager.js
@src/server/derivation-runner.js
@src/server/action-derivation-runner.js
@src/server/revision-runner.js
@src/server/pipeline-runner.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enrich registry.complete() calls with structured result metadata in all runners</name>
  <files>
    src/server/process-manager.js
    src/server/derivation-runner.js
    src/server/action-derivation-runner.js
    src/server/revision-runner.js
    src/server/pipeline-runner.js
  </files>
  <action>
This task modifies the registry.complete() calls that A-120 (M-43) adds. Since M-43 hasn't executed yet, plan against the interface: each runner will have `if (registry) registry.complete(agentId, result)` calls. This task specifies what the `result` object shape should be for each runner type.

IMPORTANT: If M-43 A-120 has already executed when this runs, modify the existing registry.complete() calls. If A-120 hasn't run yet, note this in the SUMMARY and the executor should add the result shapes as comments/documentation that A-120 can reference, OR if A-120 has been executed, update the actual calls.

**Strategy:** Read each runner file. Find every `registry.complete()` call (added by A-120). Replace the result argument with a structured object. If A-120 hasn't run, add the result-enrichment logic as a clearly-marked block that A-120's executor can incorporate.

**Result shapes by runner type:**

1. **process-manager.js** (type: "execution"):
   ```js
   registry.complete(agentId, {
     actionId: actionId,
     milestoneId: milestoneId,
     summaryPath: logPath ? logPath.replace('execution.log', actionId + '-SUMMARY.md') : null,
     logPath: logPath || null
   })
   ```
   The summaryPath is derived from the execution log path — the SUMMARY is always at `{milestoneFolder}/{actionId}-SUMMARY.md`. Use the logPath (which points to `{milestoneFolder}/execution.log`) to derive the folder, then construct the summary path.

2. **derivation-runner.js** (type: "derivation"):
   ```js
   registry.complete(agentId, {
     milestones: extractedMilestoneIds  // array of milestone IDs that were created
   })
   ```
   The derivation runner already parses the Claude output looking for milestone proposals. After derivation completes successfully, the milestones created should be available from the proposals array or the MILESTONES.md diff. If the runner doesn't currently track which milestones were created, pass `{ milestones: [] }` as a baseline — the client can still navigate to the declaration.

3. **action-derivation-runner.js** (type: "action-derivation"):
   ```js
   registry.complete(agentId, {
     milestoneId: milestoneId,
     actionCount: extractedActionCount  // number of actions derived
   })
   ```
   The action-derivation runner knows the milestoneId from its `current.milestoneId`. Pass it through. If action count isn't readily available, use `null`.

4. **revision-runner.js** (type: "revision"):
   ```js
   registry.complete(agentId, {
     nodeId: nodeId,
     planPath: null  // set if the revised plan path is known
   })
   ```
   The revision runner knows the nodeId (the declaration or milestone being revised). Pass it through.

5. **pipeline-runner.js** (type: "pipeline"):
   For the pipeline-level agent:
   ```js
   registry.complete(pipelineAgentId, {
     completed: completedCount,
     failed: failedCount,
     reportPath: reportPath  // path to the pipeline report
   })
   ```
   For individual action agents within the pipeline:
   ```js
   registry.complete(actionAgentId, {
     actionId: actionId,
     milestoneId: milestoneId,
     logPath: logPath || null
   })
   ```

Guard all additions with `if (registry)` matching the existing pattern from A-120.
  </action>
  <verify>
All runner self-tests still pass (registry is null in self-tests):
- `node -e "require('./src/server/process-manager.js')"` — no throw
- `node src/server/derivation-runner.js` — prints OK
- `node src/server/action-derivation-runner.js` — prints OK
- `node src/server/revision-runner.js` — prints OK
- `node -e "require('./src/server/pipeline-runner.js')"` — no throw

Grep confirms structured result objects:
- `grep -n "registry.complete" src/server/process-manager.js` shows actionId in result
- `grep -n "registry.complete" src/server/derivation-runner.js` shows milestones in result
- `grep -n "registry.complete" src/server/pipeline-runner.js` shows completed/failed in result
  </verify>
  <done>
All 5 runners pass structured result metadata to registry.complete(). Each result object contains the type-specific artifact references the client needs for navigation: execution -> actionId + summaryPath, derivation -> milestones[], action-derivation -> milestoneId + actionCount, revision -> nodeId, pipeline -> completed + failed + reportPath.
  </done>
</task>

</tasks>

<verification>
- All runner files contain registry.complete() calls with structured result objects (not empty/null)
- Each result shape matches the documented contract above
- No regressions — runners still function when registry is null
- Result data is sufficient for client-side navigation (each has enough info to route to the right view)
</verification>

<success_criteria>
Every agent type records what it produced in its result metadata. Execution agents record actionId and summaryPath. Derivation agents record milestone IDs. Pipeline agents record completion stats. The result field on completed AgentRecords is never null — it always contains structured navigation metadata.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-45-agent-completion-with-result-navigation/A-127-SUMMARY.md`
</output>
