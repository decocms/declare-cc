---
milestone: M-32-integrity-visualization-in-the-dashboard
action: A-68
subsystem: ui
tags: [dashboard, wholeness, integrity, css, visualization]

requires:
  - action: A-67
    provides: "Integrity CSS variables and integrity dots in buildNodeEl"
  - action: A-66
    provides: "Wholeness field computed per node in API response"
provides:
  - "Wholeness-colored left borders on all node cards (green/amber/red)"
  - "Wholeness badge with breakdown counts in detail panel"
  - "Project-wide integrity percentage in status bar"
affects: [M-32]

tech-stack:
  added: []
  patterns:
    - "Wholeness CSS classes (.wholeness-whole/partial/broken) for left-border indicators"
    - "Wholeness badge component (.wholeness-badge.wb-*) for detail panel"
    - "Integrity percentage computed client-side from node wholeness counts"

key-files:
  created: []
  modified:
    - src/server/public/index.html
    - src/server/public/app.js
    - dist/public/index.html
    - dist/public/app.js

key-decisions:
  - "Compute integrity percentage client-side from wholeness counts rather than relying on server rollup.integrity.level which showed undefined"
  - "Use CSS classes for wholeness left-border rather than inline styles for cleaner separation"
  - "Show breakdown counts (N/M actions done, N/M milestones done) only for milestones and declarations respectively"

duration: 2min
completed: 2026-02-21
---

# Milestone M-32 Action A-68: Integrity Visualization Summary

**Wholeness-colored left borders on node cards, wholeness badge with breakdown counts in detail panel, and computed integrity percentage in status bar**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T19:18:35Z
- **Completed:** 2026-02-21T19:20:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Every node card displays a 3px left border colored by wholeness state (green=whole, amber=partial, red=broken)
- Detail panel shows wholeness badge with breakdown: "N/M actions done" for milestones, "N/M milestones done" for declarations
- Status bar shows "Integrity: NN%" computed from whole-node count across all node types, replacing the old "Integrity: undefined" text

## Task Commits

Each task was committed atomically:

1. **Task 1: Add wholeness CSS and update buildNodeEl + renderStatusBar** - `6cc0227` (feat)
2. **Task 2: Add wholeness section to detail panel + copy to dist** - `31675a5` (feat)

## Files Created/Modified
- `src/server/public/index.html` - Added --wholeness-* CSS variables, .wholeness-* left-border classes, .wholeness-badge styles
- `src/server/public/app.js` - Added wholeness class in buildNodeEl, integrity percentage in renderStatusBar, wholeness badge with breakdown in renderPanelChain
- `dist/public/index.html` - Production copy synced from src
- `dist/public/app.js` - Production copy synced from src

## Decisions Made
- Computed integrity percentage client-side from node wholeness counts rather than relying on rollup.integrity.level (which was undefined)
- Used CSS classes for wholeness borders for cleaner separation of concerns
- Breakdown counts use raw status comparisons against DONE/KEPT/HONORED for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- M-32 integrity visualization is fully implemented
- Wholeness data from M-31 is now visually accessible in the dashboard
- Node cards, detail panel, and status bar all reflect wholeness state

## Self-Check: PASSED

All files exist and all commit hashes verified.

---
*Action: A-68*
*Completed: 2026-02-21*
