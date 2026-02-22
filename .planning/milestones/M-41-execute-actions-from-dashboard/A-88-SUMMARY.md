---
milestone: M-41
action: A-88
subsystem: dashboard-ui
tags: [ui, dashboard, execution, sse-client, live-output]
dependency_graph:
  requires: [execute-endpoint, stop-endpoint, running-endpoint, process-manager]
  provides: [execute-button, stop-button, output-panel, running-indicators]
  affects: []
tech_stack:
  added: []
  patterns: [sse-subscription, event-streaming-ui, action-lifecycle-visualization]
key_files:
  created:
    - app/components/ActionDetail.jsx
  modified:
    - app/components/ActionDetail.jsx
    - dist/declare-tools.cjs
decisions:
  - Execute button visible only when action status is PENDING and exec-plan exists — matches intent (user can only run unexecuted actions)
  - Live output panel immediately appears on execution start — provides immediate feedback
  - Running indicator shows in action list alongside action status — quick scan of active operations
  - SSE connection reused across action detail views — persistent streaming
  - Output log auto-scrolls to bottom on new messages — follows user focus
metrics:
  duration: 12m
  completed: 2026-02-21T19:27:00Z
---

# Milestone M-41 Action A-88: Execute Actions from Dashboard (Frontend) Summary

**One-liner:** Execute button, stop button, and live output panel in dashboard that call backend endpoints and stream action execution output via SSE.

## What Was Built

### Execute/Stop Buttons
Added execute and stop buttons to the action detail panel:
- Execute button visible only when action status is PENDING and has exec-plan
- Stop button visible only when action is currently running
- Both buttons disabled while request is in flight
- Button states reflect action lifecycle (pending → running → complete)

### Live Output Panel
Implemented live output log that subscribes to SSE action events:
- Displays real-time output streamed from `POST /api/action/:id/execute` endpoint
- Shows output lines as they arrive from the Claude CLI process
- Preserves output history across multiple execution attempts
- Auto-scrolls to bottom as new lines arrive
- Displays completion/failure messages

### Running Indicators
Added visual indicators showing execution status:
- Action list shows running badge next to active actions
- Action detail panel shows current status (pending/running/complete/failed)
- SSE connection remains open to receive real-time updates
- Status updates propagate immediately without polling

## Verification Results

All checks passed:
- Execute button renders correctly when action has PENDING status and exec-plan
- Execute button hidden when action is already completed or has no exec-plan
- Click execute button → calls `POST /api/action/:id/execute` → receives 202
- Output panel appears and subscribes to SSE events
- Lines of output appear in real-time as streamed
- Stop button visible during execution → calls `POST /api/action/:id/stop`
- Running badge appears in action list during execution
- Status updates when process completes
- No console errors or missing dependencies

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 6f82a13 | feat(M-41-A-88): add execute button and live output panel to dashboard |

## Self-Check: PASSED

All files and commits verified present.
