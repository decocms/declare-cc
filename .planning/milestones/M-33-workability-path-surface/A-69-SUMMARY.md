---
milestone: M-33-workability-path-surface
action: A-69
subsystem: graph-engine
tags: [dag, wholeness, workability, api, integrity]

requires:
  - milestone: M-31
    provides: computeWholeness function in engine.js
provides:
  - computeWorkabilityPath function tracing broken leaf actions blocking wholeness
  - GET /api/workability/:id endpoint returning workability path JSON
affects: [M-33-A-70, dashboard, integrity-surface]

tech-stack:
  added: []
  patterns: [bottom-up DAG traversal with impact scoring, upstream unblock counting]

key-files:
  created: []
  modified:
    - src/graph/engine.js
    - src/graph/engine.test.js
    - src/server/index.js

key-decisions:
  - "Impact classification thresholds: high >= 3, medium >= 1, low = 0 non-whole ancestors"
  - "Workability route placed before milestone route to avoid URL conflicts"
  - "Used buildDagFromDisk for endpoint (fresh DAG per request, consistent with server patterns)"

patterns-established:
  - "Workability traversal: walk downEdges for non-whole children, collect broken leaf actions"
  - "Impact scoring: recursive upEdges walk counting non-whole ancestors"

duration: 2min
completed: 2026-02-22
---

# Milestone M-33 Action A-69: Workability Path Computation Summary

**Bottom-up DAG traversal algorithm finding broken leaf actions blocking node wholeness, with impact scoring and REST endpoint**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T00:44:19Z
- **Completed:** 2026-02-22T00:46:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- computeWorkabilityPath traces non-whole paths to root-cause broken/pending actions
- Impact scoring counts unique non-whole upstream ancestors (high/medium/low classification)
- GET /api/workability/:id returns workability path JSON with 404 for unknown nodes
- 6 new tests (25-30) covering whole nodes, broken leaves, impact, multi-level traversal, errors, sorting
- All 30 engine tests and 22 command tests pass (zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement computeWorkabilityPath and add tests** - `93b8eb0` (feat)
2. **Task 2: Add GET /api/workability/:id endpoint** - `c0d02af` (feat)

## Files Created/Modified
- `src/graph/engine.js` - Added computeWorkabilityPath function with downward traversal and impact scoring
- `src/graph/engine.test.js` - Added 6 tests (25-30) for workability path computation
- `src/server/index.js` - Added handleWorkability handler and /api/workability/:id route

## Decisions Made
- Impact thresholds set at >= 3 (high), >= 1 (medium), 0 (low) based on non-whole ancestor count
- Route /api/workability/:id placed before /api/milestone/:id in routing to prevent conflicts
- Used buildDagFromDisk (same as load-graph) for fresh DAG construction per request

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- computeWorkabilityPath available for dashboard integration (A-70)
- API endpoint ready for frontend consumption
- All tests green, build passing

## Self-Check: PASSED

- All 3 source files exist
- A-69-SUMMARY.md exists
- Commit 93b8eb0 found (Task 1)
- Commit c0d02af found (Task 2)
- computeWorkabilityPath exported as function

---
*Action: M-33-A-69*
*Completed: 2026-02-22*
