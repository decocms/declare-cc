---
milestone: M-41
action: A-87
subsystem: server
tags: [api, process-management, sse, execution]
dependency_graph:
  requires: [get-exec-plan, load-graph]
  provides: [execute-endpoint, stop-endpoint, running-endpoint, process-manager]
  affects: [dashboard-ui]
tech_stack:
  added: []
  patterns: [lazy-singleton, line-buffered-streaming, sse-broadcast]
key_files:
  created:
    - src/server/process-manager.js
  modified:
    - src/server/index.js
    - dist/declare-tools.cjs
decisions:
  - One-at-a-time execution cap (processes.size > 0 returns 409) — simplest safe default
  - Lazy process manager singleton — avoids initialization before server is ready
  - Line-buffered streaming — accumulate chunks, split on newline, emit complete lines
metrics:
  duration: 2m
  completed: 2026-02-21T19:15:43Z
---

# Milestone M-41 Action A-87: Execute Actions from Dashboard (Backend) Summary

**One-liner:** POST execute/stop endpoints and process manager that spawn Claude CLI, stream output via SSE, and track running actions.

## What Was Done

### Task 1: Process Manager Module
Created `src/server/process-manager.js` exporting `createProcessManager(sseClients, cwd)` with three methods:
- `execute(actionId, milestoneId)` — spawns `claude -p <prompt> --no-input` with FORCE_COLOR=0, pipes stdout/stderr line-by-line as SSE `action-output` events, broadcasts `action-complete` on exit
- `stop(actionId)` — sends SIGTERM to running process
- `running()` — returns array of active action IDs

One-at-a-time cap: if any process is running, new execute requests return 409.

### Task 2: Server Route Integration
Modified `src/server/index.js` to add three new endpoints:
- `POST /api/action/:id/execute` — validates action has exec-plan via `runGetExecPlan`, then delegates to process manager (returns 202 or 400/409)
- `POST /api/action/:id/stop` — kills running process (returns 200 or 404)
- `GET /api/running` — returns `{running: [...actionIds]}`

Also updated:
- CORS preflight and sendJson to allow POST method
- Method filter: GET and POST pass through, others get 405
- Added lazy `getProcessManager(cwd)` singleton pattern
- Rebuilt CJS bundle

## Verification Results

All checks passed:
- `node -e "require('./src/server/process-manager.js')"` — module loads, exports correct types
- `npm test` — all 24 existing tests pass (no regressions)
- `POST /api/action/A-99999/execute` returns 400 (action not found)
- `GET /api/running` returns `{"running":[]}`
- `POST /api/action/A-01/stop` returns 404 (not running)
- `GET /api/graph` returns 200 (existing routes unaffected)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | d15021d | feat(M-41-A-87): add process manager for Claude CLI execution |
| 2 | 1155526 | feat(M-41-A-87): wire execute/stop/running routes into server |

## Self-Check: PASSED

All files and commits verified present.
