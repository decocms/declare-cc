---
milestone: M-45-agent-completion-with-result-navigation
action: A-127
subsystem: server
tags: [agent-registry, result-metadata, sse, navigation]

requires:
  - milestone: M-43
    provides: "AgentRegistry with spawn/complete/fail methods wired into all 5 runners"
provides:
  - "Structured result metadata in registry.complete() for all runner types"
  - "Navigation-ready result objects: actionId+summaryPath, milestones[], milestoneId+actionCount, nodeId+planPath, completed+failed+reportPath"
affects: [A-128, A-129, agent-cards-ui, completion-navigation]

tech-stack:
  added: []
  patterns:
    - "Result metadata contract: each runner type passes type-specific structured object to registry.complete()"

key-files:
  created: []
  modified:
    - src/server/process-manager.js
    - src/server/derivation-runner.js
    - src/server/action-derivation-runner.js
    - src/server/revision-runner.js
    - src/server/pipeline-runner.js

key-decisions:
  - "Derive summaryPath from logPath directory rather than re-resolving milestone folder"
  - "Extract milestone IDs from parsed JSON proposals using id or title fallback"
  - "Include artifactPath as planPath in revision results for direct file navigation"

patterns-established:
  - "Result metadata contract: execution -> {actionId, milestoneId, summaryPath, logPath}"
  - "Result metadata contract: derivation -> {milestones: string[]}"
  - "Result metadata contract: action-derivation -> {milestoneId, actionCount}"
  - "Result metadata contract: revision -> {nodeId, planPath, revisionRound}"
  - "Result metadata contract: pipeline -> {completed, failed, reportPath} (pipeline-level), {actionId, milestoneId, logPath, durationMs} (per-action)"

requirements-completed: []

duration: 1min
completed: 2026-02-23
---

# Milestone M-45 Action A-127: Enrich Result Metadata Summary

**Structured result metadata in all 5 runners so completed agent cards carry actionId, summaryPath, milestones, and report paths for client-side navigation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-23T03:04:31Z
- **Completed:** 2026-02-23T03:05:44Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Enriched process-manager completion with actionId, milestoneId, summaryPath, and logPath
- Enriched derivation-runner completion with extracted milestone ID array
- Enriched action-derivation-runner completion with milestoneId and actionCount
- Enriched revision-runner completion with nodeId, planPath, and revisionRound
- Enriched pipeline-runner per-action completion with actionId, milestoneId, logPath (pipeline-level already had completed/failed/reportPath)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich registry.complete() calls with structured result metadata in all runners** - `83cf92b` (feat)

## Files Created/Modified
- `src/server/process-manager.js` - Added actionId, milestoneId, summaryPath, logPath to completion result
- `src/server/derivation-runner.js` - Extract milestone IDs from parsed proposals into milestones array
- `src/server/action-derivation-runner.js` - Added milestoneId and actionCount to completion result
- `src/server/revision-runner.js` - Added nodeId and planPath to completion result
- `src/server/pipeline-runner.js` - Added actionId, milestoneId, logPath to per-action completion result

## Decisions Made
- Derived summaryPath from logPath directory (path.dirname) rather than re-resolving milestone folder, since logPath is already resolved and available in the process entry
- For derivation milestones array, extract `id` or fall back to `title` from parsed JSON proposals since the proposal schema may vary
- Pipeline-level registry.complete already had the right shape (completed/failed/reportPath) from A-120, so only per-action calls needed enrichment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Action Readiness
- A-128 (completion result display) can now read structured result metadata from AgentRecords
- A-129 (click-to-navigate) can use summaryPath, milestoneId, nodeId, reportPath for routing

## Self-Check: PASSED

- FOUND: A-127-SUMMARY.md
- FOUND: 83cf92b (task 1 commit)

---
*Action: A-127*
*Completed: 2026-02-23*
