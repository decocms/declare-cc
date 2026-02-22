---
milestone: M-25
action: A-51
subsystem: commands
tags: [play, waves, topological-sort, execution]
dependency-graph:
  requires: [load-graph, process-manager, milestone-folders]
  provides: [computePlayOrder, createPlayRunner]
  affects: [server/index.js]
tech-stack:
  added: []
  patterns: [wave-based-execution, kahn-topological-sort]
key-files:
  created:
    - src/commands/play.js
  modified: []
decisions:
  - Play runner spawns Claude processes directly instead of going through process-manager (avoids 1-at-a-time limit)
  - Wave grouping uses Kahn's algorithm: wave N = milestones whose deps are all in earlier waves or DONE
  - All actions within a wave execute concurrently via Promise.all
metrics:
  duration: ~3m
  completed: 2026-02-22
---

# Milestone M-25 Action A-51: Implement play command in CJS layer Summary

Wave-based topological executor for agent milestones using Kahn's algorithm, spawning concurrent Claude subprocesses per wave with SSE progress streaming.

## What Was Built

### computePlayOrder(graph)
Filters milestones by `classification === 'agent'` and `status !== DONE`, builds dependency adjacency from `dependsOn` edges, then groups into waves where wave N contains milestones whose dependencies are all in earlier waves or already DONE.

Returns `{ waves: Array<Array<{ milestoneId, actions: string[] }>> }`.

### createPlayRunner(sseClients, cwd)
Singleton factory returning `{ start, stop, running, status }`:
- `start()` computes play order, then runs waves sequentially (async). Within each wave, all actions execute concurrently.
- `stop()` sets stop flag and SIGTERMs all active processes.
- SSE events emitted: `play-start`, `play-wave-start`, `play-wave-complete`, `play-complete`.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Commit | Description |
|--------|-------------|
| d6dfb57 | feat(M-25-A-51): implement play command with wave-based execution |
