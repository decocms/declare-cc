---
milestone: M-44-inline-annotation-ux-in-column-browser
action: A-94
subsystem: ui, api
tags: [review-state, annotations, approval-workflow, sse]

requires:
  - action: A-92
    provides: POST/GET/DELETE /api/node/:id/annotations endpoints, readAnnotations/writeAnnotations helpers
  - action: A-93
    provides: Annotation panel rendering in column browser detail pane
provides:
  - setReviewState(cwd, nodeId, reviewState) reusable helper function
  - Auto-transition to revision_needed on annotation creation
  - Approve button in annotation panel when all annotations resolved
  - Immediate badge update on annotation add and approve
affects: [M-44, review-workflow, annotation-system]

tech-stack:
  added: []
  patterns:
    - "Extracted setReviewState helper for DRY review state writes across handlers"
    - "Optimistic UI update pattern: badge updates before SSE refresh"

key-files:
  created: []
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "Extracted setReviewState as synchronous helper returning result object rather than using req/res -- cleaner reuse from annotation handler"
  - "Always set revision_needed on annotation add (idempotent) rather than checking current state first"
  - "Approve button shows for both revision_needed and in_review states with different messaging"

patterns-established:
  - "setReviewState helper: reusable review state writer for any server-side handler"

requirements-completed: []

duration: 3min
completed: 2026-02-22
---

# Milestone [M-44] Action [A-94]: Wire Annotations to Review State Transitions Summary

**Auto-transition to revision_needed on annotation add, approve button when all annotations resolved, immediate badge updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T11:41:29Z
- **Completed:** 2026-02-22T11:44:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extracted `setReviewState(cwd, nodeId, reviewState)` helper from `handleUpdateReviewState` for DRY reuse
- Adding an annotation auto-transitions the node to `revision_needed` server-side
- Annotation panel shows "Approve" button when all annotations are resolved and node is `revision_needed` or `in_review`
- Review badge updates immediately in the DOM after adding an annotation or clicking Approve

## Task Commits

Each task was committed atomically:

1. **Task 1: Add auto-transition to revision_needed on annotation creation** - `65c0931` (feat)
2. **Task 2: Add approve button when all annotations resolved** - `80f0244` (feat)

## Files Created/Modified
- `src/server/index.js` - Extracted setReviewState helper, added auto-transition call in handleAddAnnotation
- `src/server/public/app.js` - Added approve button rendering, approve click handler, immediate badge updates on add/approve
- `src/server/public/index.html` - Added CSS styles for .ann-approve-section, .ann-approve-msg, .ann-approve-btn

## Decisions Made
- Extracted setReviewState as a synchronous function returning a result object (`{ok, id, reviewState}` or `{error, status}`) rather than taking req/res -- enables clean reuse from annotation handler without mocking HTTP objects
- Always set revision_needed on annotation add regardless of current state (idempotent write is simpler than conditional check)
- Show approve button for both `revision_needed` (after resolving annotations) and `in_review` (no annotations yet) with distinct messaging
- Update local graphData in-memory alongside DOM badge update so re-renders pick up the new state without waiting for SSE refresh

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full review cycle now works: draft -> in_review -> add annotation -> revision_needed -> resolve all -> approve
- The setReviewState helper is available for any future server-side code that needs to programmatically change review states

## Self-Check: PASSED

All files exist, all commits verified.

---
*Action: A-94*
*Completed: 2026-02-22*
