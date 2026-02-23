---
milestone: M-45-revision-cycle-with-agent
action: A-96
subsystem: api, ui
tags: [annotations, revision-round, metadata, badge]

requires:
  - action: A-93
    provides: "Annotation storage and API endpoints"
  - action: A-94
    provides: "Inline annotation UX in column browser"
provides:
  - "revisionRound field in annotation JSON metadata"
  - "POST /api/node/:id/annotations/increment-round endpoint"
  - "Round N badge in annotation panel header"
affects: [A-95, A-97]

tech-stack:
  added: []
  patterns: ["revision round counter in annotation metadata"]

key-files:
  created: []
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "revisionRound defaults to 0 and is backwards compatible with existing annotation files"
  - "Badge only shows when revisionRound >= 1 (no visual noise for fresh nodes)"
  - "increment-round is a dedicated POST endpoint, not part of general annotation CRUD"

patterns-established:
  - "Revision tracking via metadata field in annotation JSON files"

requirements-completed: []

duration: 4min
completed: 2026-02-22
---

# Milestone M-45 Action A-96: Track and Display Revision Rounds Summary

**revisionRound counter in annotation metadata with purple pill badge in panel header, exposed via dedicated increment API endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T11:55:19Z
- **Completed:** 2026-02-22T11:59:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added revisionRound field to annotation data layer with backwards compatibility (defaults to 0)
- Created POST /api/node/:id/annotations/increment-round endpoint for round progression
- Annotation panel header shows "Round N" purple pill badge when revisionRound >= 1

## Task Commits

Each task was committed atomically:

1. **Task 1: Add revisionRound to annotation storage and API** - `cad1256` (feat)
2. **Task 2: Display revision round counter in annotation panel header** - `96ec0f0` (feat)

## Files Created/Modified
- `src/server/index.js` - revisionRound in readAnnotations(), handleIncrementRevisionRound handler, route wiring
- `src/server/public/app.js` - Extract revisionRound from API response, render round badge in header
- `src/server/public/index.html` - CSS for .revision-round-badge (purple pill style)

## Decisions Made
- revisionRound defaults to 0 via `data.revisionRound || 0` for backwards compatibility
- Badge uses light purple (#e8e0ff bg, #5b21b6 text) to distinguish from other status indicators
- increment-round route placed before the general POST annotations route to avoid regex conflicts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- revisionRound field and increment endpoint ready for A-95 (revision request flow) to call
- A-97 (diff view between rounds) can read revisionRound to label versions

---
*Action: A-96*
*Completed: 2026-02-22*
