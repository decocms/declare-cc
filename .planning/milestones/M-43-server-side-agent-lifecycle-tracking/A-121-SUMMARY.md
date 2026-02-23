---
milestone: M-43-server-side-agent-lifecycle-tracking
action: A-121
subsystem: api
tags: [rest, http, agent-lifecycle, sse]

requires:
  - action: A-119
    provides: "AgentRegistry with getAll/get methods"
  - action: A-120
    provides: "Registry singleton via getAgentRegistry(cwd), SSE broadcast wiring"
provides:
  - "GET /api/agents endpoint returning active and recent agents"
  - "GET /api/agents/:id endpoint returning single agent or 404"
  - "Documented SSE event types for agent lifecycle"
affects: [M-44-live-activity-cards]

tech-stack:
  added: []
  patterns: ["REST query surface for registry singleton"]

key-files:
  created: []
  modified:
    - src/server/index.js

key-decisions:
  - "Placed agent routes after /api/running for logical grouping with other status endpoints"
  - "Exact /api/agents match before regex /api/agents/:id to prevent path consumption"

patterns-established:
  - "Agent API follows existing sendJson + getAgentRegistry(cwd) pattern"

duration: 1min
completed: 2026-02-23
---

# Milestone M-43 Action A-121: Agent Lifecycle HTTP API Summary

**REST endpoints GET /api/agents and GET /api/agents/:id for querying agent state, with SSE event type documentation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-23T02:43:22Z
- **Completed:** 2026-02-23T02:43:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added GET /api/agents returning `{ active: AgentRecord[], recent: AgentRecord[] }` from registry
- Added GET /api/agents/:id returning single agent detail or 404
- Documented SSE event types (agent-start, agent-update, agent-complete) in code comments

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/agents and GET /api/agents/:id routes** - `4134688` (feat)

## Files Created/Modified
- `src/server/index.js` - Added agent lifecycle API routes and SSE event documentation

## Decisions Made
- Placed routes after `/api/running` block for logical grouping with status endpoints
- Used exact path match for `/api/agents` before regex match for `/api/agents/:id` to prevent the pattern from consuming the base path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- M-44 (live activity cards) can now fetch agent state on page load via GET /api/agents
- M-44 can query individual agents via GET /api/agents/:id
- Real-time updates available via existing SSE /events stream with agent-start, agent-update, agent-complete events

---
*Action: A-121*
*Completed: 2026-02-23*

## Self-Check: PASSED
- src/server/index.js: FOUND
- Commit 4134688: FOUND
