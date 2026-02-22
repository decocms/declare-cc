---
milestone: M-45-revision-cycle-with-agent
action: A-97
subsystem: ui, api
tags: [diff, revision, inline-diff, lcs, version-comparison]

requires:
  - action: A-95
    provides: "Artifact versioning (.vN.md) before overwrite during revision"
  - action: A-96
    provides: "Revision round tracking in annotation metadata"
provides:
  - "GET /api/node/:id/revisions endpoint returning current and previous version content"
  - "Inline diff view with green/red highlighting for additions/removals"
  - "Show Diff toggle button in annotation panel header when revisionRound >= 1"
  - "LCS-based line-by-line diff algorithm (pure JS, no external deps)"
affects: [M-45-revision-cycle-with-agent]

tech-stack:
  added: []
  patterns:
    - "LCS (Longest Common Subsequence) O(n*m) diff algorithm using Uint16Array for memory efficiency"
    - "Dual-gutter line numbering showing old and new line numbers side by side"

key-files:
  created: []
  modified:
    - src/server/index.js
    - src/server/public/app.js
    - src/server/public/index.html

key-decisions:
  - "Used LCS-based diff instead of greedy lookahead for correctness on plan-sized files (under 500 lines)"
  - "Previous version determined by reading .v{revisionRound-1}.md created by revision-runner"
  - "Diff view replaces annotation panel content rather than opening a modal for inline context"

patterns-established: []

requirements-completed: []

duration: 3min
completed: 2026-02-22
---

# Milestone [M-45] Action [A-97]: Inline Diff View Between Revision Rounds Summary

**LCS-based inline diff view with green/red line highlighting comparing current artifact against previous revision round**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T12:02:44Z
- **Completed:** 2026-02-22T12:06:00Z
- **Tasks:** 1 (auto) + 1 (checkpoint skipped)
- **Files modified:** 3 source + 3 dist (build output)

## Accomplishments

- Added `GET /api/node/:id/revisions` endpoint that returns current content, previous version content, and revision round
- Previous version loaded from `.v{round-1}.md` files created by the revision-runner in A-95
- Implemented `computeDiff()` using classic LCS (Longest Common Subsequence) algorithm with O(n*m) dynamic programming
- Diff entries categorized as 'same', 'add', or 'remove' with dual-gutter line numbers (old + new)
- `renderDiffView()` fetches revision data and renders inline diff with green/red highlighting
- "Show Diff" toggle button appears in annotation panel header only when revisionRound >= 1
- "Close Diff" button returns to normal annotation view
- CSS uses dark theme colors consistent with existing dashboard: rgba green for additions, rgba red for removals

## Task Commits

Single task committed atomically (all changes in one commit as instructed).

## Files Modified

- `src/server/index.js` - Added `handleGetRevisions` handler and `GET /api/node/:id/revisions` route
- `src/server/public/app.js` - Added `computeDiff()`, `renderDiffView()`, diff toggle button in header, click handler wiring, `showingDiff` state variable
- `src/server/public/index.html` - CSS for `.ann-diff-toggle`, `.diff-view`, `.diff-header`, `.diff-line`, `.diff-gutter`, `.diff-prefix`, `.diff-close-btn` with dark-theme-appropriate green/red highlighting

## Decisions Made

- Used O(n*m) LCS algorithm since plan files are always under 200 lines, making it correct and fast enough
- Diff replaces annotation panel content inline rather than opening a separate modal
- Previous version is at `.v{revisionRound - 1}.md` because the revision-runner copies the file BEFORE incrementing the round counter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Diff view is complete and functional for all node types (D, M, A)
- The revision cycle (M-45) is now feature-complete: annotate, request revision, view diff, approve

## Self-Check: PASSED

All files modified exist on disk. Build succeeds.

---
*Action: A-97*
*Completed: 2026-02-22*
