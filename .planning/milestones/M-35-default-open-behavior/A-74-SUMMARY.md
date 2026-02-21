---
milestone: M-35-default-open-behavior
action: A-74
subsystem: cli
tags: [open-command, guard, ux, initialization]

requires:
  - action: A-73
    provides: runOpen implementation in src/commands/open.js

provides:
  - ".planning/ existence guard at entry of runOpen"
  - "Friendly init prompt with npx declare-cc instruction on missing .planning/"
  - "Rebuilt dist/declare-tools.cjs bundle containing the guard"

affects: [M-35-default-open-behavior, open-command, cli-ux]

tech-stack:
  added: []
  patterns:
    - "Guard pattern: check precondition at function entry, exit 0 with guidance if unmet"

key-files:
  created: []
  modified:
    - src/commands/open.js
    - dist/declare-tools.cjs

key-decisions:
  - "Exit 0 (not 1) for missing .planning/ — absence is a usage-guide moment, not an error"
  - "Guard placed before port read so no fs/network operations occur on uninitialized projects"
  - "Print to stdout (not stderr) for friendly UX"

patterns-established:
  - "Guard pattern: check .planning/ at runOpen entry before any I/O"

requirements-completed: [D-11]

duration: 1min
completed: 2026-02-21
---

# Milestone M-35 Action A-74: Add .planning/ guard to runOpen Summary

**.planning/ existence guard added to runOpen so `declare` in an uninitialized directory prints a friendly npx init prompt and exits 0 instead of hanging**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-21T14:03:59Z
- **Completed:** 2026-02-21T14:04:35Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added guard at the top of `runOpen` that checks for `.planning/` before any port read, server liveness check, or browser open
- Guard exits 0 with a friendly message telling the user to run `npx declare-cc` or `declare-cc`
- Rebuilt `dist/declare-tools.cjs` bundle with the guard included and verified it works

## Task Commits

1. **Task 1: Add .planning/ guard to runOpen and rebuild** - `fe2f7ce` (feat)

## Files Created/Modified

- `src/commands/open.js` - Added 14-line guard block at top of runOpen before port read
- `dist/declare-tools.cjs` - Rebuilt bundle containing the guard

## Decisions Made

- Exit 0 for missing `.planning/` — this is a usage guide moment, not an error condition
- Guard fires before all I/O (port file read, HTTP check, server spawn, browser open) so nothing hangs
- Print to stdout so the message appears cleanly without shell error formatting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- M-35 complete: `declare` now gracefully handles uninitialized directories
- D-11 "prompting to initialize if empty" is fully implemented
- No blockers for downstream work

---
*Milestone: M-35-default-open-behavior*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: src/commands/open.js
- FOUND: dist/declare-tools.cjs
- FOUND: .planning/milestones/M-35-default-open-behavior/A-74-SUMMARY.md
- FOUND: commit fe2f7ce
