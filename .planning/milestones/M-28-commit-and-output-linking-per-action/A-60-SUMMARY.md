---
milestone: M-28-commit-and-output-linking-per-action
action: A-60
subsystem: ui
tags: [dashboard, commits, git-sha, clipboard, summary-parsing]

requires:
  - milestone: M-28
    provides: "getActionCommits() returning commits array in /api/action/:id"
provides:
  - "Commits section in action detail panel with clickable SHAs and copy-to-clipboard"
  - "Files produced section parsed from SUMMARY.md content"
  - "relativeDate() and extractProducedFiles() helper functions"
affects: []

tech-stack:
  added: []
  patterns: [clipboard-api-for-sha-copy, summary-content-parsing-for-produced-files]

key-files:
  created: []
  modified:
    - src/server/public/app.js
    - dist/public/app.js

key-decisions:
  - "Copy-to-clipboard instead of opening URL since git remotes may vary"
  - "1.5s feedback duration for Copied! text before reverting to shortSha"
  - "extractProducedFiles parses multiple heading variants (Files, Key Files, Files Created/Modified/Produced)"
  - "Produced file badges use done-bg/done-border/done-color to distinguish from planned files"

duration: 5min
completed: 2026-02-22
---

# Milestone M-28 Action A-60: Commit and Output Display in Dashboard Summary

**Clickable commit SHAs with copy-to-clipboard, relative dates, and SUMMARY.md-derived produced file badges in the action detail panel**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T01:05:00Z
- **Completed:** 2026-02-22T01:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added Commits section showing blue monospace SHAs, commit messages, and relative dates
- Click-to-copy full SHA with 1.5s "Copied!" feedback using navigator.clipboard API
- Added Files produced section parsing SUMMARY.md for backtick-wrapped file paths
- Produced file badges styled with done-color theme to distinguish from planned files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add commits and output links to action detail panel** - `c148cfc` (feat)
2. **Task 2: Copy built assets to dist/public** - `346eef2`, `1e10891` (chore)

## Files Created/Modified
- `src/server/public/app.js` - Added relativeDate(), extractProducedFiles(), commits rendering, produced files rendering, clipboard click handlers
- `dist/public/app.js` - Identical copy of source for distribution serving

## Decisions Made
- Used navigator.clipboard.writeText() for SHA copying instead of opening remote URLs, since git remotes vary across projects
- extractProducedFiles() matches multiple heading patterns to handle varied SUMMARY.md formats
- Commits section only renders when data.commits array is non-empty (clean UI for pending actions)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Action Readiness
- D-08 "commit outputs are linked" requirement is now fully satisfied
- Both API (A-59) and UI (A-60) layers complete for commit/output linking

## Self-Check: PASSED

- FOUND: src/server/public/app.js
- FOUND: dist/public/app.js
- FOUND: A-60-SUMMARY.md
- FOUND: c148cfc (Task 1 commit)
- FOUND: 346eef2 (Task 2 initial commit)
- FOUND: 1e10891 (Task 2 full sync commit)
- VERIFIED: src and dist files identical

---
*Action: M-28-A-60*
*Completed: 2026-02-22*
