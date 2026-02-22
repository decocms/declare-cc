---
milestone: M-25
action: A-53
subsystem: server, dashboard
tags: [play, ui, sse, routes]
dependency-graph:
  requires: [createPlayRunner, server/index.js, app.js, index.html]
  provides: [POST /api/play, POST /api/play/stop, GET /api/play/status, play-ui]
  affects: [server/index.js, public/app.js, public/index.html]
tech-stack:
  added: []
  patterns: [sse-event-driven-ui, progress-banner]
key-files:
  created: []
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html
    - dist/declare-tools.cjs
    - dist/public/app.js
    - dist/public/index.html
decisions:
  - Play button placed in status bar next to Declaration button for discoverability
  - Progress banner appears below workflow banner showing wave/action state
  - Action tags colored by state: active (yellow), done (green), failed (red)
metrics:
  duration: ~3m
  completed: 2026-02-22
---

# Milestone M-25 Action A-53: Add play trigger to UI Summary

Dashboard Play All button with wave progress banner, server routes, and SSE event wiring for live play execution monitoring.

## What Was Built

### Server Routes
- `POST /api/play` - starts play sequence, returns `{ ok, waves }` or error
- `POST /api/play/stop` - stops running play, kills active processes
- `GET /api/play/status` - returns `{ running, status }` for polling

### Dashboard UI
- **Play All button** in status bar with green accent matching action color theme
- Pulse animation when play is active
- **Play progress banner** below workflow banner showing:
  - Current wave / total waves
  - Action tags with color-coded state (active=yellow, done=green, failed=red)
  - Stop button to abort play
- SSE event handlers: `play-start`, `play-wave-start`, `play-wave-complete`, `play-complete`
- Banner auto-hides 3 seconds after play completes

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Commit | Description |
|--------|-------------|
| a489a3b | feat(M-25-A-53): add Play All button and play progress UI to dashboard |
