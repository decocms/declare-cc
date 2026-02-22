---
milestone: M-21
actions: [A-42, A-43, A-44]
subsystem: ui
tags: [state-machine, workflow, dashboard, sse, vanilla-js]

requires:
  - milestone: M-11
    provides: DAG web server and /api/graph endpoint
provides:
  - computeWorkflowState(graph) function for D->M->A progression
  - GET /api/workflow/state API endpoint
  - Contextual next-step banner in dashboard UI
affects: [M-25, M-26]

tech-stack:
  added: []
  patterns: [computed-state-from-dag, contextual-ui-guidance]

key-files:
  created:
    - src/commands/workflow-state.js
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "State computed on-the-fly from DAG — no persistence needed"
  - "Six states: empty, declarations_only, milestones_pending, actions_pending, executing, complete"
  - "Banner button navigates to relevant node rather than executing actions directly"

duration: 4min
completed: 2026-02-22
---

# Milestone M-21 Actions A-42, A-43, A-44: UI Workflow State Machine Summary

**Workflow state machine with six D->M->A progression states, computed from DAG, shown as contextual next-step banner**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T01:17:09Z
- **Completed:** 2026-02-22T01:21:17Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created `computeWorkflowState(graph)` function returning state, nextStep, and progress
- Added GET /api/workflow/state endpoint that computes state from DAG + running actions
- Implemented contextual next-step banner in dashboard with progress bar and action button
- Banner adapts color and action based on workflow state (six color-coded states)

## Task Commits

Each task was committed atomically:

1. **A-42: Define workflow state machine spec** - `d43841f` (feat)
2. **A-44: Persist workflow state via API** - `4202cbe` (feat)
3. **A-43: Implement state machine in frontend** - `ea41687` (feat)

## Files Created/Modified
- `src/commands/workflow-state.js` - Core state machine with computeWorkflowState function
- `src/server/index.js` - handleWorkflowState handler + /api/workflow/state route
- `src/server/public/app.js` - Workflow banner fetch, render, and action button wiring
- `src/server/public/index.html` - Banner HTML structure and CSS styles

## Decisions Made
- State is computed from DAG on every request (no separate persistence needed)
- A-44 executed before A-43 since the frontend depends on the API endpoint
- Banner action button navigates to relevant nodes rather than triggering operations directly, keeping the UI non-destructive
- Running action detection uses both status field and process manager running set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Workflow state machine ready for use by action execution features (M-25)
- Banner provides clear D->M->A guidance for new users
- State computation can be extended with additional states if needed

---
*Milestone: M-21-ui-workflow-state-machine*
*Completed: 2026-02-22*
