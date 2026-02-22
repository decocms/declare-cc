---
milestone: M-24
action: A-50
subsystem: server, dashboard
tags: [readiness, ui, api, badges]
dependency-graph:
  requires: [readiness.js, load-graph.js]
  provides: [/api/readiness, readiness-badges-ui]
  affects: [server/index.js, app.js, index.html]
tech-stack:
  added: []
  patterns: [readiness-badge-component, sort-by-readiness]
key-files:
  created: []
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html
    - dist/public/app.js
    - dist/public/index.html
    - dist/declare-tools.cjs
decisions:
  - Green READY badge, red BLOCKED badge with tooltip, gray NO ACTIONS badge
  - Sort order in both DAG and column views: ready > no-actions > blocked > done
  - Detail panel shows clickable blocker milestone tags when blocked
metrics:
  completed: 2026-02-22
---

# Milestone M-24 Action A-50: Surface readiness in API and dashboard Summary

GET /api/readiness endpoint plus green/red/gray readiness badges on DAG and column browser milestone nodes with blocker detail in side panel.

## What Was Done

### Task 1: Add /api/readiness endpoint
Added `handleReadiness()` handler and `GET /api/readiness` route in `src/server/index.js` returning the full readiness map from `computeReadiness()`.

### Task 2: Add readiness badges to DAG view
Modified `buildNodeEl()` in `app.js` to render READY (green), BLOCKED (red with tooltip), and NO ACTIONS (gray) badges next to status badges on milestone nodes.

### Task 3: Add readiness badges to column browser
Added readiness badges in the column browser milestone list items, with the same color coding and tooltip behavior.

### Task 4: Show blocked-by in detail panel
In `renderPanelContent()`, added a Readiness section for milestones showing the state badge and, when blocked, a clickable tag list of blocker milestones.

### Task 5: Sort milestones by readiness
Both DAG view and column browser now sort milestones: ready first, then no-actions, then blocked, then done -- so actionable milestones surface to the top.

### Task 6: Add CSS styling
Added readiness badge CSS in `index.html` with green/red/gray color schemes matching the existing design system.

## Deviations from Plan

None - plan executed exactly as written.

## Commits
- `55954ca`: feat(M-24-A-50): surface readiness in API and dashboard
