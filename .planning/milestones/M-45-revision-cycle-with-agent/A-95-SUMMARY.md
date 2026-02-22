---
milestone: M-45-revision-cycle-with-agent
action: A-95
subsystem: ui, api
tags: [claude-cli, subprocess, sse, revision, annotations, streaming]

requires:
  - action: A-96
    provides: "Revision round tracking in annotation metadata, increment-round endpoint"
  - action: A-93
    provides: "Annotation panel with line-numbered artifacts and inline comments"
provides:
  - "POST /api/node/:id/revise endpoint spawning Claude CLI revision subprocess"
  - "POST /api/revise/stop endpoint for stopping active revision"
  - "Request Revision button in annotation panel when annotations exist"
  - "Streaming revision output panel with SSE"
  - "Artifact versioning (.vN.md) before overwrite"
  - "Automatic review state transition to in_review after revision"
affects: [M-45-revision-cycle-with-agent, A-97]

tech-stack:
  added: []
  patterns:
    - "revision-runner follows same singleton + SSE broadcast pattern as derivation-runner"
    - "onComplete callback injection for cross-module state transitions"

key-files:
  created:
    - src/server/revision-runner.js
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "Passed setReviewState and broadcastChange via onComplete callback to revision-runner to avoid circular deps"
  - "Strip markdown fencing from agent output since Claude may wrap response in code blocks"
  - "Version backup uses .vN.md suffix based on current revisionRound before incrementing"

patterns-established:
  - "revision-runner pattern: createRevisionRunner(sseClients, cwd, onComplete) with revise/stop/running interface"

requirements-completed: []

duration: 4min
completed: 2026-02-22
---

# Milestone [M-45] Action [A-95]: Build Revision Request Flow Summary

**Claude CLI revision subprocess with annotation-bundled prompt, SSE streaming output, artifact versioning, and round tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T11:57:31Z
- **Completed:** 2026-02-22T12:01:31Z
- **Tasks:** 2 (auto) + 1 (checkpoint skipped)
- **Files modified:** 4

## Accomplishments
- Revision runner module spawns Claude CLI with annotations bundled into revision prompt
- POST /api/node/:id/revise endpoint resolves artifact path for D/M/A nodes and triggers revision
- Request Revision button appears in annotation panel when annotations exist with count hint
- SSE streaming of revision output to dark-themed output panel with stop button
- Artifact versioned to .vN.md before overwrite, revision round incremented on success
- Review state automatically transitions to in_review after successful revision

## Task Commits

Each task was committed atomically:

1. **Task 1: Create revision-runner.js and wire API endpoint** - `905cb54` (feat)
2. **Task 2: Add Request Revision button and streaming output panel to UI** - `848c187` (feat)

## Files Created/Modified
- `src/server/revision-runner.js` - Claude CLI subprocess manager for plan revision with SSE streaming
- `src/server/index.js` - handleRevise/handleReviseStop handlers, revision runner singleton, route wiring
- `src/server/public/app.js` - Request Revision button, showRevisionPanel, SSE listeners for revision events
- `src/server/public/index.html` - CSS for revision button, output panel, stop button

## Decisions Made
- Used onComplete callback pattern to inject setReviewState into revision-runner without coupling modules
- Strips markdown fencing from Claude output since the agent may wrap responses in code blocks
- Artifact path resolution handles D (FUTURE.md), M (PLAN.md), and A (A-XX-EXEC-PLAN.md) node types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Revision flow is complete and ready for manual testing
- A-97 (diff between revision rounds) can now use the .vN.md backup files created by this action

## Self-Check: PASSED

All files created/modified exist on disk. All commit hashes verified in git log.

---
*Action: A-95*
*Completed: 2026-02-22*
