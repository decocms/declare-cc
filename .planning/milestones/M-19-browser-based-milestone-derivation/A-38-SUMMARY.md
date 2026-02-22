---
milestone: M-19-browser-based-milestone-derivation
action: A-38
subsystem: api
tags: [http, derivation, server, rest-api]

requires:
  - action: A-37
    provides: derivation-runner.js subprocess manager
provides:
  - POST /api/milestones/derive endpoint
  - POST /api/milestones/derive/stop endpoint
  - POST /api/milestones/derive/accept endpoint
  - GET /api/derivation/running endpoint
affects: [A-39, browser-derivation-ui]

tech-stack:
  added: []
  patterns: [derivation-runner singleton, async body-parsing handlers]

key-files:
  created: []
  modified: [src/server/index.js]

key-decisions:
  - "Reused existing readJsonBody helper instead of creating a new parseBody utility"
  - "handleDeriveAccept calls broadcastChange() after persisting milestones for immediate SSE refresh"

duration: 4min
completed: 2026-02-22
---

# Milestone [M-19] Action [A-38]: Add Milestone Derivation API Endpoints Summary

**Four HTTP endpoints for derivation lifecycle: trigger, stop, accept proposals, and check status -- wired to derivation-runner singleton and add-milestones-batch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T01:04:47Z
- **Completed:** 2026-02-22T01:09:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added 4 derivation API routes following existing server patterns
- Wired derivation-runner singleton with lazy initialization (same pattern as processManager)
- handleDeriveAccept persists milestones via runAddMilestonesBatch and broadcasts SSE change

## Task Commits

1. **Task 1: Add derivation API routes to server** - `f51b7d6` (feat)

## Files Created/Modified
- `src/server/index.js` - Added derivation runner imports, singleton, 3 handler functions, 4 route entries

## Decisions Made
- Reused existing readJsonBody helper (already handles 64KB limit, error handling) instead of adding a new parseBody function as plan suggested
- handleDeriveAccept calls broadcastChange() so the graph refreshes immediately on the dashboard after accepting milestones

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- All 4 derivation endpoints are live, ready for A-39 to wire the browser UI
- SSE events (derivation-output, derivation-complete) are emitted by derivation-runner from A-37

---
*Action: A-38*
*Completed: 2026-02-22*
