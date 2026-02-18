---
milestone: M-03-planner-plan-checker-loop
actions_completed: [A-06, A-07, A-08]
subsystem: planning-agents
tags: [planner, plan-checker, orchestration, exec-plans, verification-loop]
dependency_graph:
  requires: [M-02]
  provides: [declare-planner, declare-plan-checker, /declare:plan command]
  affects: [milestone-planning-workflow]
tech_stack:
  patterns: [agent-fork, goal-backward-methodology, planner-checker-loop]
key_files:
  created:
    - agents/declare-planner.md
    - agents/declare-plan-checker.md
    - commands/declare/plan.md
  modified:
    - .planning/milestones/M-03-planner-plan-checker-loop/PLAN.md
    - .planning/MILESTONES.md
decisions:
  - Forked gsd-planner/gsd-plan-checker verbatim with Declare-specific terminology replacements rather than rewriting from scratch
  - EXEC-PLAN files replace PLAN.md files as the output artifact (one per action vs one per phase-plan)
  - declarations field replaces requirements field for declaration-to-action coverage tracking
  - /declare:plan orchestrates 3-iteration planner/checker loop with structured YAML issue feedback
  - .claude/commands/declare/plan.md sync delegated to installer (bin/install.js copyWithPathReplacement)
metrics:
  duration: ~15min
  completed_date: 2026-02-18
  tasks_completed: 3
  files_created: 3
---

# Phase M-03: Planner + Plan-Checker Loop Summary

**One-liner:** Declare planning pipeline with goal-backward EXEC-PLAN generation, 7-dimension verification, and 3-iteration revision loop via `/declare:plan M-XX`

## What Was Built

### A-06: `agents/declare-planner.md`

Forked from `gsd-planner.md` and adapted for Declare's milestone/action model:

- Produces EXEC-PLAN files at `.planning/milestones/M-XX-name/A-XX-EXEC-PLAN.md`
- Uses `node dist/declare-tools.cjs load-graph --milestone` for context loading
- `declarations` frontmatter field replaces `requirements` — links actions to D-XX declarations
- Frontmatter: `milestone`, `action`, `declarations`, `wave`, `depends_on`, `must_haves`
- Revision mode: receives `<revision_context>` with structured YAML issues, makes targeted fixes
- Commit format: `feat(M-XX-A-XX): implement [feature]` for TDD cycles
- History digest via `node dist/declare-tools.cjs history-digest`
- All GSD patterns preserved: goal-backward methodology, wave assignment, discovery levels, TDD integration

### A-07: `agents/declare-plan-checker.md`

Forked from `gsd-plan-checker.md` and adapted:

- Verifies EXEC-PLAN files instead of PLAN.md files
- 7 verification dimensions: declaration_coverage, task_completeness, dependency_correctness, key_links_planned, scope_sanity, verification_derivation, context_compliance
- **Dimension 1 renamed:** requirement_coverage → declaration_coverage (checks D-XX IDs in `declarations` frontmatter)
- Context loading: `node dist/declare-tools.cjs load-graph --milestone`
- Returns structured YAML issues with `action` field (was `plan` field)
- Structured returns: VERIFICATION PASSED or ISSUES FOUND with YAML issues list
- Returns result to `/declare:plan` orchestrator (not `/gsd:plan-phase`)

### A-08: `commands/declare/plan.md`

New slash command `/declare:plan [M-XX] [--skip-research]`:

- **10-step orchestration flow:**
  1. Parse arguments (M-XX pattern, --skip-research flag)
  2. Load milestone data via `node dist/declare-tools.cjs load-graph --milestone M-XX`
  3. Research check (detects RESEARCH.md, assesses need for external library research)
  4. Load context files (CONTEXT.md, RESEARCH.md, MILESTONES.md, FUTURE.md, STATE.md, PLAN.md)
  5. Spawn `agents/declare-planner.md` via Task tool
  6. Spawn `agents/declare-plan-checker.md` via Task tool
  7. Evaluate checker result (PASSED → step 9, ISSUES FOUND → revision loop)
  8. Revision loop (max 3 iterations): re-spawn planner with YAML issues, re-run checker
  9. Commit EXEC-PLANs via `node dist/declare-tools.cjs commit`
  10. Present wave structure + EXEC-PLANs table + next steps

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notable Context

The files for A-06, A-07, and A-08 were already committed in `d5ee6ae` (docs(M-02) commit) as those actions were implemented during M-02 milestone execution. The M-03 PLAN.md action statuses were PENDING on disk but the output files existed. This summary records the completion and updates PLAN.md/MILESTONES.md accordingly.

### .claude/commands/declare/plan.md Sync

Write tool access to `.claude/` was denied during execution. The `.claude/commands/declare/plan.md` file is synced by `bin/install.js` when running `npx declare-cc --claude --local`. The `commands/declare/plan.md` is the canonical source.

## Self-Check

- [x] `agents/declare-planner.md` exists (1015+ lines)
- [x] `agents/declare-plan-checker.md` exists (600+ lines)
- [x] `commands/declare/plan.md` exists (236+ lines)
- [x] All three files committed in d5ee6ae
- [x] PLAN.md action statuses updated to DONE
- [x] MILESTONES.md M-03 updated to DONE
