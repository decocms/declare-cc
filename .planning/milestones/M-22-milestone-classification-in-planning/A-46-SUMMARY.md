---
milestone: M-22
action: A-46
subsystem: ui
tags: [dashboard, classification, toggle, icons, dependencies]

requires:
  - action: A-45
    provides: classification and dependsOn fields in milestone schema
provides:
  - classification toggle UI in milestone detail panel
  - PUT /api/milestones/:id/classify API route
  - PUT /api/milestones/:id/depends-on API route
  - visual classification icons on milestone nodes
  - dependency editor with add/remove
  - dashed M->M dependency edges in DAG
affects: [M-23, M-24, M-25]

tech-stack:
  added: []
  patterns: [inline toggle buttons for enum fields, tag-based dependency editor]

key-files:
  created: []
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "Robot emoji for agent, person emoji for human classification"
  - "Dependency edges rendered as dashed curves between milestones"
  - "Dependencies validated: no self-deps, all referenced milestones must exist"

completed: 2026-02-22
---

# Milestone [M-22] Action [A-46]: Build classification UI in dashboard Summary

**Classification toggle (agent/human) with emoji icons, dependency editor with add/remove tags, and dashed M->M dependency edges in DAG view**

## Accomplishments
- PUT /api/milestones/:id/classify route for toggling agent/human
- PUT /api/milestones/:id/depends-on route for setting dependencies
- Robot/person emoji icons on milestone nodes based on classification
- Classification toggle buttons in milestone detail panel
- Dependency editor with dropdown add and click-to-remove tags
- Dashed dependency edges drawn between milestones in DAG view
- Dependency indicator badges in column browser

## Task Commits

1. **A-46: Classification and dependency UI** - `745e929` (feat)
2. **Plans and build** - `3e386cd` (chore)

## Files Modified
- `src/server/index.js` - Added classify and depends-on PUT routes
- `src/server/public/app.js` - Classification toggle, dependency editor, dep edges, helper functions
- `src/server/public/index.html` - Styles for classify buttons, dep tags, dep edges

## Deviations from Plan

Combined A-46, A-47, and A-48 implementation into unified commits since the server routes (A-47) and UI (A-46, A-48) are tightly coupled.

---
*Milestone: M-22*
*Completed: 2026-02-22*
