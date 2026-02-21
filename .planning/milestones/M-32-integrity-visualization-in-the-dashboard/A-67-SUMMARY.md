---
milestone: M-32-integrity-visualization-in-the-dashboard
action: A-67
subsystem: ui
tags: [css, dashboard, integrity, wholeness, visualization]

requires:
  - milestone: M-31-wholeness-state-computed-per-node
    provides: "wholeness field in API response for every node"
provides:
  - "CSS variables --integrity-whole, --integrity-partial, --integrity-broken for reuse"
  - "Integrity dot rendering in DAG node elements"
  - "Wholeness display in side panel for focused nodes"
affects: [M-32-A-68, dashboard-visualization]

tech-stack:
  added: []
  patterns:
    - "Integrity dot: small colored circle next to status badge, driven by item.wholeness"
    - "Panel wholeness section: colored dot + label, skipped for pending state"

key-files:
  created: []
  modified:
    - src/server/public/index.html
    - src/server/public/app.js

key-decisions:
  - "Integrity dot is 7px circle with glow shadow, placed inline after status badge"
  - "Broken dot only shown for nodes with children (milestones with actions, declarations with milestones, all actions)"
  - "Nodes with no children show no dot at all (neutral/pending treatment)"
  - "Wholeness section in panel placed before exec-plan placeholder for natural reading flow"

patterns-established:
  - "Integrity visual language: green=whole, amber=partial, red=broken, no dot=pending"
  - "CSS variables with glow variants for consistent integrity styling"

requirements-completed: []

duration: 3min
completed: 2026-02-21
---

# Milestone M-32 Action A-67: Integrity Visualization in Dashboard Summary

**Integrity dot indicators on DAG nodes (green/amber/red) with wholeness display in side panel, using CSS custom properties for the visual language**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T19:13:54Z
- **Completed:** 2026-02-21T19:16:17Z
- **Tasks:** 2
- **Files modified:** 4 (2 source + 2 dist copies)

## Accomplishments
- Established integrity visual language with CSS variables (--integrity-whole, --integrity-partial, --integrity-broken) and glow variants
- Every DAG node now renders a small colored integrity dot next to its status badge reflecting computed wholeness
- Side panel shows an "Integrity" section with colored dot and label for the focused node
- Nodes with no children correctly show no dot (neutral/pending treatment)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add integrity CSS variables and integrity-dot styles to index.html** - `777bf0b` (feat)
2. **Task 2: Render integrity dots in buildNodeEl and show wholeness in side panel** - `a935491` (feat)

## Files Created/Modified
- `src/server/public/index.html` - Added CSS custom properties for integrity colors and .integrity-dot class rules
- `src/server/public/app.js` - Added integrity dot rendering in buildNodeEl and wholeness section in renderPanelChain
- `dist/public/index.html` - Dist copy of index.html
- `dist/public/app.js` - Dist copy of app.js

## Decisions Made
- Integrity dot is a 7px inline-block circle with subtle glow box-shadow, visually distinct from the status badge
- Broken dot is conditionally shown only when the node has children (avoids misleading "broken" on empty milestones)
- For declarations, child presence is determined by checking if any milestone realizes that declaration
- Wholeness panel section uses inline styles consistent with existing panel rendering pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree path mismatch: initial edits were applied to the main project directory instead of the worktree directory. Detected via empty git status and re-applied correctly.

## Next Action Readiness
- CSS variables (--integrity-whole, --integrity-partial, --integrity-broken) are defined and ready for A-68 to consume
- The integrity dot pattern is established for any future node decoration needs

## Self-Check: PASSED

All files exist, all commits verified (777bf0b, a935491).

---
*Action: M-32-A-67*
*Completed: 2026-02-21*
