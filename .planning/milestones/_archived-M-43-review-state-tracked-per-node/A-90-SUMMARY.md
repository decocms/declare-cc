---
milestone: M-43-review-state-tracked-per-node
action: A-90
subsystem: api
tags: [review-state, rest-api, sse, node-http]

requires:
  - action: A-89
    provides: "VALID_REVIEW_STATES export, reviewState field in parsers/writers, reviewState in DAG metadata"
provides:
  - "PUT /api/node/:id/review-state endpoint for updating review state on D, M, and A nodes"
  - "Review state validation against VALID_REVIEW_STATES"
  - "SSE broadcast on review state change"
affects: [A-91, M-44, M-46]

tech-stack:
  added: []
  patterns: ["line-level PLAN.md patching for action review state (preserves hand-edited content)"]

key-files:
  created: []
  modified: ["src/server/index.js", "dist/declare-tools.cjs"]

key-decisions:
  - "Line-level patch for action review state instead of full PLAN.md rewrite to preserve hand-edited content"
  - "Top-level import of parseMilestonesFile/writeMilestonesFile instead of inline require (consistency with other imports)"
  - "Route placed before declaration PUT routes in route() function"

duration: 10min
completed: 2026-02-22
---

# Milestone M-43 Action A-90: Add review state API endpoints Summary

**PUT /api/node/:id/review-state endpoint with validation, persistence to FUTURE.md/MILESTONES.md/PLAN.md, and SSE broadcast**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-22T11:20:27Z
- **Completed:** 2026-02-22T11:30:27Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- PUT endpoint accepts valid review states (draft, in_review, revision_needed, approved) for any D, M, or A node
- Declaration updates write to FUTURE.md via parseFutureFile/writeFutureFile
- Milestone updates write to MILESTONES.md via parseMilestonesFile/writeMilestonesFile
- Action updates use line-level patching on the correct milestone's PLAN.md (inserts **Review:** after **Status:** if not present)
- Returns 400 for invalid review states, 404 for unknown nodes, 400 for unknown prefixes
- Broadcasts SSE change event after successful update

## Task Commits

1. **Task 1: Add PUT /api/node/:id/review-state endpoint to server** - `9342cb3` (feat)

## Files Created/Modified
- `src/server/index.js` - Added VALID_REVIEW_STATES import, parseMilestonesFile/writeMilestonesFile import, handleUpdateReviewState function, route wiring
- `dist/declare-tools.cjs` - Rebuilt bundle

## Decisions Made
- Used line-level patch approach for action review state (similar to updateActionStatus in plan.js) to avoid reformatting entire PLAN.md files that may have hand-edited content
- Added parseMilestonesFile/writeMilestonesFile as top-level imports rather than inline requires (two existing handlers already used inline requires for these)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Review state can now be updated via API for all node types
- A-91 (Surface review badges in column browser and DAG view) can proceed - the API is ready
- GET /api/graph already includes reviewState in node metadata (from A-89)

---
*Action: A-90*
*Completed: 2026-02-22*

## Self-Check: PASSED
