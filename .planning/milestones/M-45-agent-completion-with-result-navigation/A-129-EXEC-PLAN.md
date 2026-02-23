---
milestone: M-45-agent-completion-with-result-navigation
action: A-129
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/app.js
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "navigateToResult(agent) navigates to the correct dashboard view for each agent type"
    - "Execution agents navigate to the milestone's action list (drillLevel=actions)"
    - "Derivation agents navigate to the declaration's milestone list (drillLevel=milestones)"
    - "Action-derivation agents navigate to the milestone's action list (drillLevel=actions)"
    - "Revision agents navigate to the revised node (declaration or milestone level)"
    - "Pipeline agents navigate to the milestone's action list for the pipeline target"
    - "Unknown agent types gracefully fall back to declarations level"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "navigateToResult function for agent result routing"
      contains: "function navigateToResult"
  key_links:
    - from: "src/server/public/app.js navigateToResult"
      to: "src/server/public/app.js drillLevel/drillDeclId/drillMileId"
      via: "Sets drill state variables and calls renderDrillView()"
      pattern: "drillLevel.*=.*drillDeclId.*=.*renderDrillView"
---

<objective>
Create a navigateToResult(agent) function in app.js that maps an agent's type and result metadata to the correct dashboard navigation action, using the existing drill browser state model.

Purpose: When a user clicks "View Result" on a completed agent card, this function routes them to the relevant dashboard view — the action list for an execution, the milestone list for a derivation, etc.
Output: navigateToResult() function in app.js, ready for A-128 to wire into card click handlers.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement navigateToResult function</name>
  <files>src/server/public/app.js</files>
  <action>
Add a `navigateToResult(agent)` function to app.js. Place it near the drill navigation helpers (around the `drillGoDeeper`/`drillGoBack` functions, roughly line 1120 area).

The function receives an agent record object with shape:
```
{
  id: string,
  type: "execution" | "derivation" | "action-derivation" | "revision" | "pipeline",
  target: string,       // e.g., "A-119", "D-16", "M-43"
  milestoneId: string,  // parent milestone if applicable
  status: "complete" | "failed",
  result: {             // type-specific, set by A-127
    actionId?: string,
    milestoneId?: string,
    milestones?: string[],
    nodeId?: string,
    summaryPath?: string,
    logPath?: string,
    completed?: number,
    failed?: number,
    reportPath?: string,
    actionCount?: number
  } | null
}
```

Implementation:

```js
/**
 * Navigate the drill browser to the result of a completed agent.
 * Maps agent type + result metadata to the correct drill state.
 * @param {object} agent - AgentRecord from the registry
 */
function navigateToResult(agent) {
  if (!graphData) return;
  const result = agent.result || {};
  const milestones = graphData.milestones || [];
  const declarations = graphData.declarations || [];

  switch (agent.type) {
    case 'execution': {
      // Navigate to the milestone's action list
      const mileId = result.milestoneId || agent.milestoneId;
      if (mileId) {
        const mile = milestones.find(m => m.id === mileId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = mileId;
        drillLevel = 'actions';
      }
      break;
    }
    case 'derivation': {
      // Navigate to the declaration's milestone list
      // The target is the declaration ID (e.g., "D-16") or "all"
      const declId = agent.target !== 'all' ? agent.target : null;
      if (declId) {
        drillDeclId = declId;
        drillLevel = 'milestones';
      } else {
        // "all" derivation — go to declarations list
        drillDeclId = null;
        drillMileId = null;
        drillLevel = 'declarations';
      }
      drillMileId = null;
      break;
    }
    case 'action-derivation': {
      // Navigate to the milestone's action list
      const mileId = result.milestoneId || agent.milestoneId || agent.target;
      if (mileId) {
        const mile = milestones.find(m => m.id === mileId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = mileId;
        drillLevel = 'actions';
      }
      break;
    }
    case 'revision': {
      // Navigate to the revised node — could be declaration or milestone
      const nodeId = result.nodeId || agent.target;
      if (nodeId && nodeId.startsWith('M-')) {
        // Milestone revision — navigate to its action list
        const mile = milestones.find(m => m.id === nodeId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = nodeId;
        drillLevel = 'actions';
      } else if (nodeId && nodeId.startsWith('D-')) {
        // Declaration revision — navigate to its milestone list
        drillDeclId = nodeId;
        drillMileId = null;
        drillLevel = 'milestones';
      }
      break;
    }
    case 'pipeline': {
      // Navigate to the milestone targeted by the pipeline
      // Pipeline target is typically a milestone ID
      const mileId = agent.milestoneId || agent.target;
      if (mileId && mileId.startsWith('M-')) {
        const mile = milestones.find(m => m.id === mileId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = mileId;
        drillLevel = 'actions';
      } else {
        drillDeclId = null;
        drillMileId = null;
        drillLevel = 'declarations';
      }
      break;
    }
    default: {
      // Unknown agent type — fall back to declarations
      drillDeclId = null;
      drillMileId = null;
      drillLevel = 'declarations';
      break;
    }
  }

  // Switch to columns view if not already there and render
  if (viewMode !== 'columns') switchView('columns');
  pushDrillHash();
  renderDrillView();
}
```

Key behaviors:
- Uses the SAME drill state variables and navigation functions that exist throughout app.js (drillLevel, drillDeclId, drillMileId, pushDrillHash, renderDrillView, switchView)
- For milestones, resolves the parent declaration via `mile.realizes[0]` — matching the exact pattern used in the existing code (see lines ~1803, ~6233)
- Falls back gracefully if result metadata is missing (uses agent.target and agent.milestoneId)
- Switches to columns view if currently in DAG or execution view
- Creates a browser history entry via pushDrillHash so back button works
  </action>
  <verify>
Grep for `function navigateToResult` in app.js — should find exactly one definition.
Grep for `drillLevel` inside the function — should appear in each case branch.
Grep for `renderDrillView` inside the function — should appear once at the end.
The function should be callable: open browser console, type `typeof navigateToResult` — should return "function".
  </verify>
  <done>
navigateToResult(agent) function exists in app.js. It handles all 5 agent types (execution, derivation, action-derivation, revision, pipeline) plus unknown fallback. Each type maps to the correct drill browser state. The function uses existing navigation primitives (drillLevel, drillDeclId, drillMileId, pushDrillHash, renderDrillView, switchView).
  </done>
</task>

</tasks>

<verification>
- navigateToResult function exists and handles all 5 agent types
- Each agent type navigates to a meaningful view (not just declarations root)
- Unknown types gracefully fall back to declarations
- Uses existing drill browser state model — no new navigation system
- Browser history entry created for back-button support
</verification>

<success_criteria>
navigateToResult(agent) correctly routes each agent type to its result view: execution -> action list, derivation -> milestone list, action-derivation -> action list, revision -> revised node, pipeline -> pipeline target. Function is callable from card click handlers (A-128).
</success_criteria>

<output>
After completion, create `.planning/milestones/M-45-agent-completion-with-result-navigation/A-129-SUMMARY.md`
</output>
