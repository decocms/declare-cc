---
phase: v2
plan: M-12/M-13
subsystem: dashboard
tags: [frontend, visualization, dag, dashboard, slash-command]
dependency-graph:
  requires: [M-11]
  provides: [interactive-dag-ui, dashboard-command]
  affects: [src/server/public/, commands/declare/dashboard.md]
tech-stack:
  added: [vanilla-js-frontend, svg-edges, css-custom-properties]
  patterns: [polling, side-panel-detail-view, layered-dag-layout]
key-files:
  created:
    - src/server/public/index.html
    - src/server/public/app.js
    - commands/declare/dashboard.md
  modified: []
decisions:
  - Pure vanilla JS/HTML/CSS with zero external dependencies — matches M-11 zero-deps philosophy
  - SVG bezier curves for edges instead of Canvas — easier DOM-coordinate math and accessibility
  - 5-second polling instead of WebSocket — simpler server, adequate for file-change latency
  - Side panel toggle pattern — click same node again to dismiss, keeps canvas uncluttered
  - nohup background start in dashboard command — user keeps their shell; PID echo enables kill
metrics:
  duration: ~15min
  completed: 2026-02-17
  tasks: 3 (A-24, A-25, A-26)
  files: 3
---

# Phase v2 Plan M-12/M-13: Interactive DAG Visualizer + Dashboard Command Summary

Layered SVG DAG web UI with dark theme, node click side panel, live polling, and a /declare:dashboard slash command that starts the server and opens the browser.

## What Was Built

### A-24: Frontend DAG Visualization (`src/server/public/`)

**`index.html`** — Shell page with three structural zones:

- Status bar (top): project name, counts, health badge, performance rollup, Last updated timestamp, Refresh button
- Canvas area: scrollable container with `#edges-svg` (absolute-positioned SVG) overlaid on three `.layer-section` divs — Declarations / Milestones / Actions
- Side panel (right): collapsible, shows full detail of clicked node

**`app.js`** — Visualization engine:

- Fetches `/api/graph` and `/api/status` in parallel on load and every 5 seconds
- Builds `.node` elements per layer with ID, truncated title, status badge
- Color coding: declarations = blue (`#4a9eff`), milestones = purple (`#a66bff`), actions = green (`#34d399`); DONE/HONORED/KEPT = muted gray; BROKEN = red; RENEGOTIATED = orange
- SVG bezier edge drawing using DOM `getBoundingClientRect()` relative to canvas container — redraws on scroll and resize
- Click-to-select: highlights node, redraws edges with highlight, populates side panel
- Side panel renders: ID, title, status badge, type-specific fields (produces, realizes, causes, integrity, wave), clickable tags for connected nodes
- Error overlay with retry button when server is unreachable
- Loading spinner on initial fetch

### A-25: API Wiring (embedded in `app.js`)

- `GET /api/graph` provides `declarations`, `milestones`, `actions`, `stats`
- `GET /api/status` provides `project`, `health`, `performance.rollup` for status bar
- Status gracefully degrades if `/api/status` fails (graph renders without it)
- All status field names match the actual `runStatus()` return shape
- Performance pill shows `alignment.level`, `integrity.level`, `performance` from rollup

### A-26: Dashboard Command (`commands/declare/dashboard.md`)

Five-step slash command:
1. `curl -sf http://localhost:3847/api/graph` to check running state
2. `nohup node dist/declare-tools.cjs serve --port 3847 > /tmp/declare-dashboard.log 2>&1 &` + echo PID
3. Wait 1s, verify started, tail log on failure
4. `open http://localhost:3847` (macOS) or `xdg-open` (Linux)
5. Show URL, PID, log path, stop instructions; optional `--tail` flag to stream log

Note: `.claude/commands/declare/dashboard.md` could not be written in this session due to sandbox restrictions on the `.claude/` path. Sync manually:
```
cp commands/declare/dashboard.md .claude/commands/declare/dashboard.md
git add .claude/commands/declare/dashboard.md
git commit -m "chore: sync dashboard command to .claude/commands/declare/"
```

## Commits

| Hash    | Action | Description                                               |
|---------|--------|-----------------------------------------------------------|
| 5dcebc7 | A-24+A-25 | feat(M-12): build interactive DAG visualizer frontend |
| fa049f7 | A-26   | feat(M-13): add /declare:dashboard command                |

## Deviations from Plan

### Auto-merged Issues

**A-24 and A-25 executed as a single commit** — The API wiring (A-25) is structurally inseparable from the frontend fetch logic (A-24). Both live in `app.js`. Committing them together avoids a broken intermediate state where the HTML exists but the JS has no API calls.

### Out-of-scope note

**`.claude/commands/declare/dashboard.md` not synced** — Write tool denied access to `.claude/` directory paths in this session (sandbox restriction). The authoritative source at `commands/declare/dashboard.md` was committed. Manual sync required (see instructions above).

## Self-Check: PASSED

- FOUND: src/server/public/index.html
- FOUND: src/server/public/app.js
- FOUND: commands/declare/dashboard.md
- FOUND: commit 5dcebc7 (A-24+A-25)
- FOUND: commit fa049f7 (A-26)
- MISSING (sandbox restriction): .claude/commands/declare/dashboard.md — manual sync required
