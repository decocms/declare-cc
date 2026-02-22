---
milestone: M-28-commit-and-output-linking-per-action
action: A-59
subsystem: api
tags: [git-log, commits, action-metadata]

requires:
  - milestone: null
    provides: null
provides:
  - "getActionCommits() function extracting git commits by M-XX-A-YY pattern"
  - "commits array in /api/action/:id response with sha, shortSha, message, date"
affects: [M-28-A-60-frontend-commit-display]

tech-stack:
  added: []
  patterns: [git-log-grep-for-commit-extraction]

key-files:
  created: []
  modified:
    - src/commands/get-exec-plan.js
    - dist/declare-tools.cjs

key-decisions:
  - "Used git log --grep with extended-regexp to match (M-XX-A-YY) pattern in commit messages"
  - "5-second timeout on execSync to prevent hanging on large repos"
  - "Empty array fallback on any error for graceful degradation"

duration: 4min
completed: 2026-02-22
---

# Milestone M-28 Action A-59: Commit Metadata Extraction Summary

**Git commit extraction via M-XX-A-YY pattern matching in git log, returned as structured data in action API**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T01:04:00Z
- **Completed:** 2026-02-22T01:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `getActionCommits()` function that extracts commits matching action patterns from git log
- Enhanced both return paths in `runGetExecPlan` to include `commits` array
- Rebuilt CJS bundle with new functionality
- Verified: A-79 returns 1 commit, A-59 returns empty array (no prior commits)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getActionCommits() to get-exec-plan.js** - `29ffe44` (feat)
2. **Task 2: Rebuild CJS bundle** - `f2e7d31` (chore)

## Files Created/Modified
- `src/commands/get-exec-plan.js` - Added getActionCommits() function and commits field in API response
- `dist/declare-tools.cjs` - Rebuilt bundle with new commit extraction logic

## Decisions Made
- Used `git log --extended-regexp --grep="(M-XX-A-YY)"` pattern to match conventional commit format like `feat(M-28-A-59):`
- 5-second timeout on execSync prevents hanging on very large repositories
- Returns empty array on any error (no git, no matches, timeout) for graceful degradation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Action Readiness
- API now returns commits data, ready for A-60 (frontend commit display)
- Every /api/action/:id response includes a commits array

---
*Action: M-28-A-59*
*Completed: 2026-02-22*
