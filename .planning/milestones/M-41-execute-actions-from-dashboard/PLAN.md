# Plan: M-41 -- Execute actions from dashboard

**Milestone:** M-41
**Realizes:** D-08
**Status:** DONE
**Derived:** 2026-02-21

## Actions

### A-87: Add execute endpoint and process manager to server
**Status:** DONE
**Produces:** POST /api/action/:id/execute endpoint that spawns `claude -p` with the action's exec-plan prompt, tracks running processes, streams output via SSE tagged by action ID, and POST /api/action/:id/stop to kill a running process

### A-88: Add execute button and live output panel to dashboard
**Status:** DONE
**Produces:** Execute button on action detail panel (visible when action is PENDING and has exec-plan), live output log that subscribes to SSE action events, status indicator showing running/complete/failed state
