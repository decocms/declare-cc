---
milestone: M-19-browser-based-milestone-derivation
action: A-37
subsystem: server
tags: [child_process, sse, claude-cli, derivation, subprocess]

requires:
  - milestone: M-41
    provides: process-manager.js pattern for subprocess management
provides:
  - createDerivationRunner factory for spawning scoped derivation subprocesses
  - SSE streaming of derivation output (derivation-output, derivation-complete events)
  - JSON milestone parsing from Claude CLI output
affects: [M-19-A-38, M-19-A-39]

tech-stack:
  added: []
  patterns: [session-based subprocess tracking, scoped prompt building, accumulated stdout JSON parsing]

key-files:
  created:
    - src/server/derivation-runner.js
  modified: []

key-decisions:
  - "Session IDs use deriv-${Date.now()} format for simplicity and uniqueness"
  - "Stderr lines are streamed to SSE but not included in JSON parse accumulator"
  - "On JSON parse failure, milestones field is null so UI can fall back to raw output"
  - "Included self-test guard (require.main === module) for quick smoke testing"

patterns-established:
  - "Session-based subprocess tracking: single active process tracked by session ID instead of action ID"
  - "Prompt builder as separate testable function"

requirements-completed: []

duration: 4min
completed: 2026-02-22
---

# Milestone M-19 Action A-37: Derivation Runner Summary

**Claude CLI subprocess manager for milestone derivation with scoped prompts, line-buffered SSE streaming, and JSON result parsing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T01:00:52Z
- **Completed:** 2026-02-22T01:05:00Z
- **Tasks:** 2
- **Files created:** 1

## Accomplishments
- Created derivation-runner.js following process-manager.js patterns adapted for derivation
- Scoped prompt builder filters declarations by ID or by missing milestones
- Line-buffered SSE streaming with derivation-output and derivation-complete events
- Accumulated stdout parsing attempts JSON extraction on exit code 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Create derivation-runner.js module** - `0a910ca` (feat)
2. **Task 2: Add unit-level smoke test** - included in `0a910ca` (self-test guard was part of module creation)

## Files Created/Modified
- `src/server/derivation-runner.js` - Derivation subprocess manager: spawn, stream, parse results

## Decisions Made
- Combined Tasks 1 and 2 into a single commit since the self-test code is naturally part of the module file
- Used a separate `buildPrompt` function (not inlined) for testability
- Stderr is streamed to SSE clients but excluded from the stdout accumulator used for JSON parsing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Action Readiness
- derivation-runner.js is ready for A-38 (API endpoint) to import and wire up
- Module exports match documented API: derive, stop, running

## Self-Check: PASSED

- FOUND: src/server/derivation-runner.js
- FOUND: commit 0a910ca
- FOUND: A-37-SUMMARY.md

---
*Action: M-19-A-37*
*Completed: 2026-02-22*
