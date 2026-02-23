---
milestone: M-18-browser-based-declaration-capture
action: A-35
subsystem: api
tags: [http, crud, declarations, sse, cjs]

requires:
  - action: A-34
    provides: "Dashboard frontend with graph visualization"
provides:
  - "POST /api/declarations endpoint for creating declarations"
  - "PUT /api/declarations/:id endpoint for updating declarations"
  - "DELETE /api/declarations/:id endpoint for deleting declarations"
  - "update-declaration CLI command"
  - "delete-declaration CLI command"
  - "readJsonBody helper for JSON request parsing"
affects: [M-18-A-36, dashboard-frontend, declaration-management]

tech-stack:
  added: []
  patterns: ["readJsonBody Promise-based JSON parsing with 64KB cap", "declaration CRUD via command modules called from HTTP routes"]

key-files:
  created:
    - src/commands/update-declaration.js
    - src/commands/delete-declaration.js
  modified:
    - src/server/index.js
    - src/declare-tools.js
    - dist/declare-tools.cjs

key-decisions:
  - "Reused existing command module pattern (runXxx(cwd, args)) for update and delete"
  - "Extracted projectName from FUTURE.md header rather than basename(cwd) for consistency with renegotiate.js"
  - "DELETE blocks on declarations with linked milestones, directing users to renegotiate instead"

patterns-established:
  - "readJsonBody: Promise-based JSON parsing with size cap for all POST/PUT routes"
  - "Declaration mutation routes broadcast SSE change events for live dashboard refresh"

requirements-completed: []

duration: 2min
completed: 2026-02-22
---

# Milestone [M-18] Action [A-35]: Declaration CRUD API Summary

**Declaration CRUD via HTTP API (POST/PUT/DELETE /api/declarations) with git auto-commit and SSE broadcast, plus update-declaration and delete-declaration CLI commands**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T01:01:01Z
- **Completed:** 2026-02-22T01:03:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Three HTTP endpoints for full declaration lifecycle: create (POST 201), update (PUT 200), delete (DELETE 200)
- Two new CJS command modules following established add-declaration.js pattern
- All mutations auto-commit to git and broadcast SSE change events for live dashboard refresh
- Error handling: missing fields return 400, non-existent IDs return 404, linked milestones block deletion

## Task Commits

Each task was committed atomically:

1. **Task 1: Create update-declaration and delete-declaration CJS commands** - `dfb9c50` (feat)
2. **Task 2: Add declaration CRUD routes to server and wire CLI commands** - `56f5004` (feat)

## Files Created/Modified
- `src/commands/update-declaration.js` - Update declaration by ID with optional title/statement/status
- `src/commands/delete-declaration.js` - Delete declaration by ID, blocks if milestones linked
- `src/server/index.js` - Added readJsonBody helper, declaration CRUD routes, CORS for PUT/DELETE
- `src/declare-tools.js` - Wired update-declaration and delete-declaration CLI commands
- `dist/declare-tools.cjs` - Rebuilt CJS bundle

## Decisions Made
- Reused the `runXxx(cwd, args)` command pattern so HTTP routes and CLI share identical logic
- Extracted projectName from FUTURE.md header line (`# Future: ...`) rather than `basename(cwd)` to match renegotiate.js behavior
- Delete refuses declarations with linked milestones, returning a clear error directing to renegotiate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Action Readiness
- Declaration CRUD API is live; A-36 (dashboard UI for declaration management) can wire to these endpoints
- SSE change events ensure dashboard auto-refreshes after mutations

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Action: M-18-A-35*
*Completed: 2026-02-22*
