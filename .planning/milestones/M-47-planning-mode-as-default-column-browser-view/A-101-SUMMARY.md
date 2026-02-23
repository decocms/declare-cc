---
milestone: M-47-planning-mode-as-default-column-browser-view
action: A-101
subsystem: ui
tags: [readiness-banner, review-state, column-browser, sse, navigation]

requires:
  - action: A-100
    provides: "Column browser as default view"
provides:
  - "renderReadinessBanner() function for global approval tracking"
  - "Clickable navigation from banner to unapproved nodes"
  - "Live-updating readiness counts via SSE refresh"
affects: [A-102, M-44]

tech-stack:
  added: []
  patterns: ["Banner component rendered inside renderColumnBrowser cycle for SSE-driven updates"]

key-files:
  created: []
  modified:
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "Banner placed above column-browser div in DOM, toggled via .active class"
  - "Limit unapproved node links to 8 to prevent overflow, showing '+ N more' for remainder"
  - "Node type detection uses ID prefix convention (D-, M-, A-) matching existing patterns"

patterns-established:
  - "Readiness banner pattern: aggregate review state across all node types, render inline links"

requirements-completed: []

duration: 1min
completed: 2026-02-22
---

# Milestone M-47 Action A-101: Add Global Readiness Indicator Summary

**Readiness banner above column browser showing N/M approved with clickable unapproved-node navigation, live-updating via SSE**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T12:08:55Z
- **Completed:** 2026-02-22T12:10:08Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Readiness banner shows accurate count of approved vs total nodes across all types (declarations, milestones, actions)
- Clicking unapproved node IDs navigates column browser to that node (sets declaration and milestone context correctly)
- Banner updates live on every SSE-triggered graph refresh (called at end of renderColumnBrowser)
- Banner hidden in DAG view, visible only in column browser mode
- Shows "All N nodes approved" with success styling when everything is approved

## Task Commits

Each task was committed atomically:

1. **Task 1: Add readiness banner container to HTML and implement renderReadinessBanner()** - `40f19a5` (feat)

## Files Created/Modified
- `src/server/public/index.html` - Added #readiness-banner div and CSS styles for banner, links, progress indicators
- `src/server/public/app.js` - Added $readinessBanner DOM ref, renderReadinessBanner() function, integration into renderColumnBrowser() and switchView()

## Decisions Made
- Placed banner as a sibling above #column-browser inside #main, controlled via .active class toggle
- Used the same node-type detection pattern as topbar click handler (find milestone.realizes for declaration, action.causes for milestone)
- Capped clickable links at 8 to prevent visual overflow with large projects

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Action Readiness
- A-102 can build on this: the readiness banner provides context for review/annotation panel integration
- Banner navigation pattern can be reused for other aggregate indicators

## Self-Check: PASSED

All files exist, all commits verified.

---
*Action: A-101*
*Completed: 2026-02-22*
