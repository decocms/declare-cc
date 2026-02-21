---
milestone: M-35-default-open-behavior
action: A-73
subsystem: cli
tags: [open, browser, spawn, daemon, default-command]

requires:
  - action: A-72
    provides: global CLI binary (bin/declare.js -> dist/declare-tools.cjs)
provides:
  - "runOpen command module (src/commands/open.js)"
  - "CLI dispatcher routing for no-subcommand, '.', and absolute-path invocations"
  - "Background server spawn with liveness polling"
affects: [A-74-dashboard-routing, M-35-default-open-behavior]

tech-stack:
  added: []
  patterns: [background-server-spawn-with-polling, platform-aware-browser-open]

key-files:
  created: [src/commands/open.js]
  modified: [src/declare-tools.js, dist/declare-tools.cjs]

key-decisions:
  - "bundlePath uses path.resolve(__dirname, 'declare-tools.cjs') — after esbuild __dirname === dist/"
  - "Liveness check via HTTP GET /api/graph with 10 retries at 100ms intervals"
  - "Platform-aware browser open: macOS open, Windows start, Linux xdg-open"
  - "isDefaultOpen routing uses early return to keep existing switch block untouched"

patterns-established:
  - "Default open pattern: no-args CLI invocation triggers server+browser flow"
  - "Background spawn pattern: detached child with stdio ignore and unref"

requirements-completed: []

duration: 2min
completed: 2026-02-21
---

# Milestone M-35 Action A-73: Default Open Behavior Summary

**Default `declare` invocation opens dashboard via background server spawn with port detection and browser launch**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T14:01:10Z
- **Completed:** 2026-02-21T14:02:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `src/commands/open.js` with full open flow: port read, liveness check, background server start, browser open
- Replaced the CLI dispatcher's `if (!command) { process.exit(1); }` guard with `isDefaultOpen` routing to `runOpen`
- Rebuilt `dist/declare-tools.cjs` bundle containing the new open command
- All existing subcommands (serve, help, load-graph, etc.) remain fully functional

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/commands/open.js** - `6d420eb` (feat)
2. **Task 2: Wire open command into CLI dispatcher and rebuild bundle** - `6a5810f` (feat)

## Files Created/Modified
- `src/commands/open.js` - Open command: resolves project root, checks/starts server, opens browser
- `src/declare-tools.js` - CLI dispatcher updated with isDefaultOpen routing before switch block
- `dist/declare-tools.cjs` - Rebuilt bundle including open command logic

## Decisions Made
- Used `path.resolve(__dirname, 'declare-tools.cjs')` for bundlePath since esbuild places everything in dist/
- Used early `return` after isDefaultOpen block to avoid wrapping entire switch in else
- HTTP liveness check targets `/api/graph` (same endpoint used by dashboard)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Open command wired and functional; ready for A-74 (dashboard routing refinements)
- `declare` (no args), `declare .`, and `declare /abs/path` all route to runOpen
- `declare serve` continues to work via else-branch dispatch

## Self-Check: PASSED

- src/commands/open.js: FOUND
- commit 6d420eb: FOUND
- commit 6a5810f: FOUND
- A-73-SUMMARY.md: FOUND

---
*Action: A-73*
*Completed: 2026-02-21*
