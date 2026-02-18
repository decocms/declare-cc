---
phase: M-07
plan: A-15
subsystem: lifecycle
tags: [new-milestone, reset, declarations, slash-command]
dependency_graph:
  requires: [commands/declare/complete-milestone.md, .planning/FUTURE.md, .planning/MILESTONES.md]
  provides: [commands/declare/new-milestone.md]
  affects: [.claude/commands/declare/new-milestone.md]
tech_stack:
  added: []
  patterns: [slash-command, archive pattern, FUTURE-ARCHIVE append-only]
key_files:
  created:
    - commands/declare/new-milestone.md
    - .claude/commands/declare/new-milestone.md
  modified: []
decisions:
  - PROJECT.md and STATE.md are project memory and are NEVER reset -- persist across all cycles
  - FUTURE.md and MILESTONES.md are milestone-scoped and reset every cycle
  - FUTURE-ARCHIVE.md is append-only -- previous declarations are never deleted
  - New milestone asks for focus but does not create declarations -- that is /declare:future
metrics:
  duration: 3min
  completed: 2026-02-18
---

# Milestone M-07: New Milestone Cycle Summary

**One-liner:** /declare:new-milestone resets FUTURE.md and MILESTONES.md for next cycle, archives previous declarations to FUTURE-ARCHIVE.md, and preserves PROJECT.md and STATE.md as persistent project memory

## What Was Built

### A-15: /declare:new-milestone slash command

`commands/declare/new-milestone.md` (synced to `.claude/commands/declare/`):

- Step 0: determine milestone focus from `$ARGUMENTS` or ask
- Step 1: load and display current project context (PROJECT.md, STATE.md, FUTURE.md, MILESTONES.md summary)
- Step 2: archive current declarations — append to `.planning/FUTURE-ARCHIVE.md` with versioned header (create if absent)
- Step 3: reset `.planning/FUTURE.md` to empty template with project name and guidance comment
- Step 4: reset `.planning/MILESTONES.md` to empty table structure
- Step 5: update `.planning/STATE.md` session fields (Last session, Stopped at) while preserving all other content
- Step 6: atomic git commit of all reset files
- Step 7: completion summary with explicit next steps: `/declare:future` -> `/declare:milestones` -> `/declare:actions` -> `/declare:execute`

Key design: warns if MILESTONES.md still has PENDING/ACTIVE milestones (suggests running `/declare:complete-milestone` first), warns if FUTURE.md is empty (nothing to archive).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] commands/declare/new-milestone.md exists
- [x] .claude/commands/declare/new-milestone.md exists
- [x] Commit 8b5e2b5 (A-15) exists
