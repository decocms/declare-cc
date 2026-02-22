---
milestone: M-20
action: A-40
subsystem: server
tags: [api, derivation, actions, sse]
dependency-graph:
  requires: [derivation-runner.js, load-graph, milestone-folders, plan.js]
  provides: [action-derivation-runner, action-derive-routes]
  affects: [index.js]
tech-stack:
  added: []
  patterns: [subprocess-runner, sse-broadcast, session-tracking]
key-files:
  created:
    - src/server/action-derivation-runner.js
  modified:
    - src/server/index.js
decisions:
  - Modeled after existing derivation-runner.js with separate SSE event names (action-derivation-output, action-derivation-complete)
  - Accept endpoint writes to PLAN.md in the milestone folder, creating folder if needed
  - Action IDs computed globally across all existing actions to avoid collisions
metrics:
  duration: ~10min
  completed: 2026-02-22
---

# Milestone [M-20] Action [A-40]: Add action derivation API endpoint Summary

Action derivation API with Claude CLI subprocess spawner, SSE streaming, and PLAN.md persistence.

## What Was Built

### action-derivation-runner.js
New module analogous to `derivation-runner.js` but scoped to per-milestone action derivation:
- Builds a prompt from milestone context and existing actions
- Spawns `claude -p` subprocess with `--output-format text --no-input`
- Streams stdout/stderr line-by-line via `action-derivation-output` SSE events
- On completion, parses JSON array of proposed actions and broadcasts `action-derivation-complete`
- Session-based tracking (one derivation at a time)

### API Routes (in index.js)
- `POST /api/milestones/:id/actions/derive` -- starts derivation for a milestone
- `POST /api/milestones/:id/actions/derive/stop` -- kills running derivation
- `POST /api/milestones/:id/actions/derive/accept` -- persists selected actions to PLAN.md
- `GET /api/milestones/:id/actions/derive/running` -- returns running session ID

### Accept Flow
The accept handler:
1. Loads existing actions from the milestone's PLAN.md (if any)
2. Computes next action IDs globally to avoid collisions
3. Merges new actions into PLAN.md using `writePlanFile`
4. Ensures milestone folder exists via `ensureMilestoneFolder`
5. Updates MILESTONES.md `Plan` column to YES

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

- `b500e00`: feat(M-20-A-40): add action derivation API endpoint

## Self-Check: PASSED
