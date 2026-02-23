---
milestone: M-34-declare-global-binary
action: A-71
subsystem: infra
tags: [npm, bin, cli, package-json]

# Dependency graph
requires: []
provides:
  - "bin.declare entry in package.json pointing to bin/declare.js"
  - "npm binary resolution target for global declare command"
affects: [A-72, M-34-declare-global-binary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-binary pattern: declare-cc (installer) and declare (CLI) both registered in bin field"

key-files:
  created: []
  modified:
    - "package.json"

key-decisions:
  - "Added declare entry alongside existing declare-cc without removing the installer binary"
  - "bin/declare.js path matches the script A-72 will create — wave-1 parallel execution pattern"

patterns-established:
  - "bin field supports multiple named binaries; both entries coexist independently"

requirements-completed: [D-11]

# Metrics
duration: 1min
completed: 2026-02-21
---

# Milestone M-34 Action A-71: Add declare bin entry to package.json Summary

**npm bin field updated with dual-binary entries: declare-cc (installer) and declare (CLI entry point for bin/declare.js)**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-21T13:58:17Z
- **Completed:** 2026-02-21T13:58:32Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `"declare": "bin/declare.js"` to the `bin` field in package.json
- Preserved existing `"declare-cc": "bin/install.js"` entry unchanged
- All three verification checks pass (valid JSON, bin.declare correct, bin.declare-cc correct)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add declare bin entry to package.json** - `89790ac` (feat)

## Files Created/Modified
- `/Users/guilherme/Projects/declare-cc/package.json` - Added bin.declare entry pointing to bin/declare.js

## Decisions Made
- Did not modify the `files` array — `bin/` directory is already included, so bin/declare.js will be packaged automatically when A-72 creates it.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- package.json bin field is ready; A-72 can now create bin/declare.js independently (wave 1 parallel)
- After both A-71 and A-72 complete, `npm link` or `npm install -g .` will wire the global `declare` command

---
*Milestone: M-34-declare-global-binary*
*Completed: 2026-02-21*

## Self-Check: PASSED
- package.json: FOUND
- A-71-SUMMARY.md: FOUND
- commit 89790ac: FOUND
