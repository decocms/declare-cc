---
milestone: M-43-server-side-agent-lifecycle-tracking
action: A-120
subsystem: server
tags: [agent-registry, sse, lifecycle-tracking, process-management]

requires:
  - action: A-119
    provides: "AgentRegistry module with spawn/update/complete/fail/get/getActive/getRecent/getAll/markInterrupted/loadFromDisk"
provides:
  - "AgentRegistry singleton created in index.js with SSE broadcast"
  - "All 5 runner factories accept and use registry for lifecycle tracking"
  - "Every agent spawn/complete/fail event flows through the registry"
affects: [A-121, A-122]

tech-stack:
  added: []
  patterns:
    - "Registry injection pattern: registry passed as last optional parameter to factory functions"
    - "Guard pattern: all registry calls wrapped in if (registry) for backward compatibility"

key-files:
  created: []
  modified:
    - src/server/process-manager.js
    - src/server/derivation-runner.js
    - src/server/action-derivation-runner.js
    - src/server/revision-runner.js
    - src/server/pipeline-runner.js
    - src/server/index.js

key-decisions:
  - "Registry is injected, never imported -- runners remain decoupled from agent-registry module"
  - "All registry calls are guarded with if (registry) so existing callers and self-tests work without a registry"
  - "Pipeline runner tracks both the pipeline itself as an agent and each individual action execution"

patterns-established:
  - "Registry injection: factory(sseClients, cwd, ..., registry) with null default"
  - "Agent ID storage: stored on current/entry objects alongside proc reference"
  - "Lifecycle hooks: spawn before process creation, complete/fail in close/error handlers"

requirements-completed: []

duration: 4min
completed: 2026-02-23
---

# Milestone M-43 Action A-120: Wire AgentRegistry Into All Runners Summary

**AgentRegistry singleton injected into all 5 runner factories with full spawn/complete/fail lifecycle hooks and SSE broadcast**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T02:37:50Z
- **Completed:** 2026-02-23T02:42:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- All 5 runner factories (process-manager, derivation-runner, action-derivation-runner, revision-runner, pipeline-runner) accept an optional registry parameter and call registry.spawn/complete/fail at every lifecycle point
- AgentRegistry singleton created in index.js with SSE broadcastFn that relays agent-start, agent-update, agent-complete events to all connected clients
- All 5 getter functions in index.js pass the registry singleton to their respective factory functions
- Full backward compatibility preserved -- all self-tests pass without a registry

## Task Commits

Each task was committed atomically:

1. **Task 1: Add registry parameter to all runner factories and hook lifecycle calls** - `cd6fc20` (feat)
2. **Task 2: Create registry singleton in index.js and inject into all runners** - `bd4dff8` (feat)

## Files Created/Modified

- `src/server/process-manager.js` - Added registry param, spawn on execute, complete/fail on close/error
- `src/server/derivation-runner.js` - Added registry param, spawn on derive, complete/fail on close/error
- `src/server/action-derivation-runner.js` - Added registry param, spawn on derive, complete/fail on close/error
- `src/server/revision-runner.js` - Added registry param (4th after onComplete), spawn on revise, complete/fail on close/error
- `src/server/pipeline-runner.js` - Added registry param, spawn for pipeline + each action, complete/fail on close/error/stop
- `src/server/index.js` - Import createAgentRegistry, getAgentRegistry() singleton getter, pass to all 5 runner getters

## Decisions Made

- Registry is injected as last parameter (never imported) to keep runners decoupled
- All registry calls guarded with `if (registry)` for null safety and backward compatibility
- Pipeline runner tracks both the pipeline agent and per-action execution agents separately
- Pipeline agent fails with descriptive message on stop ("stopped by user") vs action failures

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AgentRegistry is now the single source of truth for all agent activity
- SSE events (agent-start, agent-update, agent-complete) broadcast automatically
- Ready for A-121 (API routes exposing agent state) and A-122 (client-side integration)

## Self-Check: PASSED

- A-120-SUMMARY.md: FOUND
- Commit cd6fc20: FOUND
- Commit bd4dff8: FOUND
- All 6 modified files: FOUND

---
*Action: A-120*
*Completed: 2026-02-23*
