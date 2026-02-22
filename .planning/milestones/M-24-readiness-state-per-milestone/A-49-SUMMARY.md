---
milestone: M-24
action: A-49
subsystem: commands
tags: [readiness, dag, computation]
dependency-graph:
  requires: [milestones.js, build-dag.js]
  provides: [readiness.js, readiness-in-load-graph]
  affects: [load-graph.js]
tech-stack:
  added: []
  patterns: [per-milestone-state-map]
key-files:
  created:
    - src/commands/readiness.js
  modified:
    - src/commands/load-graph.js
decisions:
  - Readiness uses DONE/KEPT/HONORED as completed statuses for dependency checks
  - hasPlan=false with zero actions yields no-actions state, hasPlan=true yields ready
metrics:
  completed: 2026-02-22
---

# Milestone M-24 Action A-49: Implement readiness computation Summary

Readiness state machine (ready/blocked/done/no-actions) computed from milestone dependency graph and action counts, wired into load-graph output.

## What Was Done

### Task 1: Create readiness.js module
Created `src/commands/readiness.js` exporting `computeReadiness(graph)` that:
- Iterates all milestones, checks dependsOn edges against completed status set
- Computes per-milestone action progress (done/total counts)
- Returns map of milestoneId to `{ state, blockedBy, progress }`

### Task 2: Wire into load-graph
Modified `src/commands/load-graph.js` to:
- Import and call `computeReadiness()` after building enriched milestones/actions
- Attach `readiness` field to each milestone object in the response
- Add top-level `readiness` map to the graph response for API consumers

## Deviations from Plan

None - plan executed exactly as written.

## Commits
- `c15fd01`: feat(M-24-A-49): implement readiness computation for milestones
