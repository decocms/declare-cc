---
milestone: M-34-declare-global-binary
action: A-72
subsystem: cli
tags: [node, cjs, binary, global-cli]

requires:
  - action: A-71
    provides: "bin field in package.json pointing to bin/declare.js"
provides:
  - "bin/declare.js — executable CLI entry point that delegates to declare-tools.cjs"
affects: [M-35-A-73, M-35-A-74]

tech-stack:
  added: []
  patterns: ["CJS bin wrapper with __dirname-relative bundle resolution"]

key-files:
  created:
    - bin/declare.js
  modified: []

key-decisions:
  - "In-process require() instead of child_process spawn — simpler, no exit-code plumbing"
  - "Guard check with fs.existsSync before require to give clear error when bundle missing"

patterns-established:
  - "bin/ scripts are CJS with shebang, resolve dist/ via __dirname-relative path"

requirements-completed: []

duration: 1min
completed: 2026-02-21
---

# Milestone M-34 Action A-72: Create bin/declare.js Entry Script Summary

**Thin CJS wrapper script that locates and requires declare-tools.cjs via __dirname-relative path**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-21T13:59:18Z
- **Completed:** 2026-02-21T14:00:06Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created `bin/declare.js` as the global `declare` CLI entry point
- Script resolves `../dist/declare-tools.cjs` relative to `__dirname` (stable across npm global, npm link, local)
- Guards against missing bundle with helpful error message and exit code 1
- File is executable (mode 755) with correct shebang

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bin/declare.js entry script** - `63ac10e` (feat)

## Files Created/Modified
- `bin/declare.js` - Global CLI entry point; resolves and requires declare-tools.cjs bundle

## Decisions Made
- Used `require()` (in-process) rather than `child_process.spawn` for simplicity and correct argv forwarding
- No business logic in the wrapper — all behavior lives in declare-tools.cjs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `bin/declare.js` is ready; M-35 actions (A-73 server start, A-74 browser open) can build on this entry point
- The bundle at `dist/declare-tools.cjs` must exist for the script to work (build step required)

---
*Action: M-34-A-72*
*Completed: 2026-02-21*

## Self-Check: PASSED
- bin/declare.js: FOUND
- A-72-SUMMARY.md: FOUND
- Commit 63ac10e: FOUND
