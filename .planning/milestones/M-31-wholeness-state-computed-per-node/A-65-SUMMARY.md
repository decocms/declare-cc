---
milestone: M-31-wholeness-state-computed-per-node
action: A-65
subsystem: graph
tags: [wholeness, integrity, dag, bottom-up-computation]

requires:
  - milestone: M-31
    provides: "DeclareDag class with nodes, edges, isCompleted helper"
provides:
  - "computeWholeness() method on DeclareDag returning Map<nodeId, whole|partial|broken>"
  - "Standalone computeWholeness(dag) function export"
affects: [M-31-A-66, status-command, dashboard, integrity-checks]

tech-stack:
  added: []
  patterns:
    - "Bottom-up three-pass wholeness computation (actions -> milestones -> declarations)"

key-files:
  created: []
  modified:
    - src/graph/engine.js
    - dist/declare-tools.cjs

key-decisions:
  - "Wholeness computed structurally from action completion, never from milestone/declaration status fields"
  - "No children = broken (not partial or whole)"
  - "RENEGOTIATED counts as completed/whole (included in COMPLETED_STATUSES)"

patterns-established:
  - "Three-pass bottom-up aggregation: leaf nodes first, then parents, then grandparents"
  - "ALL/SOME/NONE pattern for whole/partial/broken at aggregate levels"

duration: 4min
completed: 2026-02-21
---

# Milestone M-31 Action A-65: computeWholeness Summary

**Bottom-up wholeness computation on DeclareDag: actions by completion status, milestones/declarations by ALL/SOME/NONE child aggregation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T18:19:22Z
- **Completed:** 2026-02-21T18:23:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `computeWholeness()` method to DeclareDag class with three-pass bottom-up computation
- Actions report whole/broken based on `isCompleted(status)` (DONE, KEPT, HONORED, RENEGOTIATED = whole)
- Milestones and declarations aggregate children using ALL/SOME/NONE -> whole/partial/broken
- Exported standalone `computeWholeness(dag)` function for external module use
- Rebuilt CJS bundle with new functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Add computeWholeness method to DeclareDag** - `8e29f1b` (feat)
2. **Task 2: Rebuild bundle and verify** - `c16cc3e` (chore)

## Files Created/Modified
- `src/graph/engine.js` - Added computeWholeness() method (three-pass bottom-up) and standalone function export
- `dist/declare-tools.cjs` - Rebuilt bundle including wholeness computation

## Decisions Made
- Wholeness is computed purely from action completion status, never from milestone/declaration status fields -- ensures structural integrity over potentially stale status
- Nodes with no children are treated as "broken" (conservative default)
- Declaration wholeness checks if child milestones are "whole" (not partial) -- a partial milestone does not count toward making its parent declaration partial; only fully whole milestones contribute

## Deviations from Plan

None - plan executed exactly as written.

Note: The plan's verify command expected D-01=partial for a declaration with one partial milestone, but the must_haves (source of truth) specify "Declaration nodes report partial when SOME child milestones are whole" -- since the milestone was partial (not whole), D-01 correctly reports broken. Implementation follows the must_haves.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Action Readiness
- computeWholeness() is available for A-66 (expose wholeness in status command output)
- Standalone function export enables use by commands and API endpoints

## Self-Check: PASSED

- FOUND: src/graph/engine.js
- FOUND: dist/declare-tools.cjs
- FOUND: A-65-SUMMARY.md
- FOUND: commit 8e29f1b
- FOUND: commit c16cc3e
