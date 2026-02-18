---
phase: M-06
plan: A-13,A-14
subsystem: lifecycle
tags: [complete-milestone, archiving, cjs-command, slash-command]
dependency_graph:
  requires: [src/commands/parse-args.js, dist/declare-tools.cjs]
  provides: [src/commands/complete-milestone.js, commands/declare/complete-milestone.md]
  affects: [src/declare-tools.js, dist/declare-tools.cjs]
tech_stack:
  added: []
  patterns: [CJS module, argument parsing, directory copy, file archival]
key_files:
  created:
    - src/commands/complete-milestone.js
    - commands/declare/complete-milestone.md
    - .claude/commands/declare/complete-milestone.md
  modified:
    - src/declare-tools.js
    - dist/declare-tools.cjs
decisions:
  - Archive is a snapshot not destructive -- FUTURE.md and MILESTONES.md stay in place after archiving
  - Pre-flight check surfaces incomplete milestones before archiving -- warn then proceed/stop choice
  - complete-milestone CJS handles file I/O; slash command handles git tag and PROJECT.md update
metrics:
  duration: 5min
  completed: 2026-02-18
---

# Milestone M-06: Milestone Completion and Archiving Summary

**One-liner:** complete-milestone CJS command snapshots graph to vX.Y archive dir, slash command handles pre-flight checks, stats, PROJECT.md update, and git tag creation

## What Was Built

### A-13: complete-milestone CJS command

`src/commands/complete-milestone.js` exports `runCompleteMilestone(cwd, args)`:

- Accepts `--version vX.Y` (normalizes `1.0` to `v1.0`)
- Validates `.planning/` exists and archive dir does not already exist
- Creates `.planning/milestones/vX.Y/` directory
- Copies `FUTURE.md` to `.planning/milestones/vX.Y/FUTURE.md`
- Copies `MILESTONES.md` to `.planning/milestones/vX.Y/MILESTONES.md`
- Recursively copies all `M-XX-*` plan folders from `.planning/milestones/` to archive
- Returns `{ version, archivedFiles, gitTagReady: true }`

Registered in `src/declare-tools.js` as `'complete-milestone'` case. Rebuilt bundle.

### A-14: /declare:complete-milestone slash command

`commands/declare/complete-milestone.md` (synced to `.claude/commands/declare/`):

- Step 0: version parsing and normalization from `$ARGUMENTS` or prompt
- Step 1: pre-flight check via `load-graph` — milestone status table (KEPT/HONORED/RENEGOTIATED = complete; PENDING/ACTIVE/BROKEN = not complete) with proceed/stop choice for incomplete milestones
- Step 2: git stats (commits since last tag, files changed, timeline)
- Step 3: archive snapshot via `node dist/declare-tools.cjs complete-milestone --version vX.Y`
- Step 4: update `.planning/PROJECT.md` Current State section
- Step 5: create annotated git tag `vX.Y` with milestone summary
- Step 6: commit all archived files
- Step 7: completion summary with `/declare:new-milestone` suggestion

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] src/commands/complete-milestone.js exists
- [x] commands/declare/complete-milestone.md exists
- [x] .claude/commands/declare/complete-milestone.md exists
- [x] src/declare-tools.js updated with complete-milestone case
- [x] dist/declare-tools.cjs rebuilt and smoke-tested
- [x] Commits 9c2897c (A-13) and cec5bfc (A-14) exist
