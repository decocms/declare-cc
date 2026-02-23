---
milestone: M-31-wholeness-state-computed-per-node
action: A-66
subsystem: api
tags: [wholeness, graph, api, load-graph, bundle]

requires:
  - milestone: M-31
    provides: "computeWholeness() method on DeclareDag returning Map<nodeId, whole|partial|broken>"
provides:
  - "/api/graph response includes wholeness field on every declaration, milestone, and action node"
  - "runLoadGraph() return value includes wholeness field on all node arrays"
affects: [dashboard, status-command, integrity-checks]

tech-stack:
  added: []
  patterns:
    - "Enrich API response by mapping node arrays with computed wholeness Map lookup"

key-files:
  created: []
  modified:
    - src/commands/load-graph.js
    - dist/declare-tools.cjs

key-decisions:
  - "Default wholeness to 'broken' when node ID not in wholeness Map (defensive fallback)"
  - "No server/index.js changes needed — handleGraph passes through runLoadGraph output as-is"

patterns-established:
  - "Compute derived fields after buildDagFromDisk(), merge into response arrays via map()"

duration: 10min
completed: 2026-02-21
---

# Milestone M-31 Action A-66: Wire wholeness into /api/graph response Summary

**wholeness field (whole/partial/broken) added to every node returned by runLoadGraph() and /api/graph, computed from dag.computeWholeness() with 'broken' fallback**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-21T18:48:12Z
- **Completed:** 2026-02-21T18:58:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Modified `runLoadGraph()` to call `dag.computeWholeness()` and spread the result onto each node
- All three arrays (declarations, milestones, actions) now carry a `wholeness` field
- Defensive default of `'broken'` applied when a node ID is missing from the wholeness Map
- Rebuilt CJS bundle; verified `/api/graph` returns `wholeness` on all node types

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich graph response with wholeness field** - `462553e` (feat)
2. **Task 2: Rebuild bundle and verify API response** - `366e637` (chore)

## Files Created/Modified
- `src/commands/load-graph.js` - Added computeWholeness() call and mapping of wholeness onto returned node arrays
- `dist/declare-tools.cjs` - Rebuilt bundle including wholeness enrichment in load-graph

## Decisions Made
- Used `|| 'broken'` fallback rather than throwing, since the wholeness Map should always contain every node ID but a defensive default is cheap insurance.
- No changes to `src/server/index.js` — the `/api/graph` handler calls `runLoadGraph()` and returns its output directly; enriching load-graph is sufficient.

## Deviations from Plan

None - plan executed exactly as written.

Note: The plan's verify command for Task 2 used `startServer` exported from the bundle, but the bundle auto-starts on require and exports nothing. Verification was adapted to use `createServer` from the source (`src/server/index.js`) which exercises the same code path. Bundle correctness was confirmed by checking that `computeWholeness` appears 5 times in `dist/declare-tools.cjs`.

## Issues Encountered
The Task 2 verification command in the plan assumed `startServer` is exported from the bundle, but the bundle is an executable that auto-starts. Adapted the verification to call `createServer` from the source module directly — same code path, same result.

## User Setup Required
None - no external service configuration required.

## Next Action Readiness
- Wholeness is now in every API response; dashboard and CLI consumers can read `node.wholeness` directly
- Integrity visualization (future) has a clean data source via `/api/graph`

## Self-Check: PASSED

- FOUND: src/commands/load-graph.js
- FOUND: dist/declare-tools.cjs
- FOUND: A-66-SUMMARY.md
- FOUND: commit 462553e
- FOUND: commit 366e637
