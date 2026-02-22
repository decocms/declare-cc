---
milestone: M-50-execution-order-configuration
action: A-108
subsystem: ui
tags: [execution-view, wave-order, kahn-algorithm, confirm-flow]

requires:
  - milestone: M-41-execute-actions-from-dashboard
    provides: execution view with pipeline layout and play controls
provides:
  - pre-execution wave order view with confirm gate
  - computeWaveOrder() shared helper extracted from Kahn's algorithm
  - orderConfirmed state gating execution controls
affects: [M-50-A-109, M-50-A-110]

tech-stack:
  added: []
  patterns: [pre-execution confirmation gate, shared wave computation helper]

key-files:
  created: []
  modified:
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "Extract computeWaveOrder() as shared helper used by both pre-execution and live views"
  - "orderConfirmed boolean resets on every execution mode entry, ensuring review each time"
  - "SSE handlers guarded to show pre-execution view when order not yet confirmed"

patterns-established:
  - "Confirmation gate pattern: boolean state variable gates UI transitions between review and live modes"

requirements-completed: []

duration: 2min
completed: 2026-02-22
---

# Milestone M-50 Action A-108: Build Pre-execution Wave Order View Summary

**Pre-execution confirmation view with wave-grouped milestone/action list gating Play controls via orderConfirmed state**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T12:40:37Z
- **Completed:** 2026-02-22T12:43:03Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Extracted `computeWaveOrder()` shared helper from inline Kahn's algorithm in `renderExecutionView()`
- Added `renderPreExecutionView()` displaying wave-grouped milestones and actions with status dots and a Confirm Order button
- Gated all execution controls (Play, Stop, SSE-driven renders) behind `orderConfirmed` boolean
- Added CSS for `.exec-preorder-*` classes and `.exec-confirm-btn` styling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pre-execution wave order view with confirm step** - `e4f7d01` (feat)

## Files Created/Modified
- `src/server/public/app.js` - Added `orderConfirmed` state, `computeWaveOrder()` helper, `renderPreExecutionView()`, modified `switchView()`, `updateExecTopbar()`, `startPlay()`, and SSE handlers
- `src/server/public/index.html` - Added CSS for pre-execution view classes (exec-preorder-list, exec-preorder-wave, exec-preorder-milestone, exec-preorder-action, exec-confirm-btn)

## Decisions Made
- Extracted `computeWaveOrder()` as shared helper to avoid duplicating Kahn's algorithm between pre-execution and live views
- Reset `orderConfirmed = false` on every execution mode entry so users always review order before executing
- Guard SSE handlers to render pre-execution view when not yet confirmed, preventing live pipeline from appearing prematurely

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pre-execution view ready; A-109 (drag-to-reorder within waves) can build on the wave list structure
- A-110 (persist execution manifest) can serialize the confirmed wave order from `computeWaveOrder()`

---
*Action: A-108*
*Completed: 2026-02-22*

## Self-Check: PASSED
