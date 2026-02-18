---
milestone: M-02
actions: [A-03, A-04, A-05]
subsystem: research-pipeline
tags: [agents, commands, research, declare]
dependency_graph:
  requires: [M-01]
  provides: [declare-researcher, declare-research-synthesizer, declare:research]
  affects: [M-03]
tech_stack:
  added: []
  patterns: [parallel-researcher-agents, synthesizer-aggregator, context7-hierarchy]
key_files:
  created:
    - agents/declare-researcher.md
    - agents/declare-research-synthesizer.md
    - commands/declare/research.md
    - .claude/commands/declare/research.md
  modified: []
decisions:
  - Parallel 4-agent research pattern (STACK, FEATURES, ARCHITECTURE, PITFALLS) from gsd-project-researcher forked into milestone-scoped researchers
  - Synthesizer commits all research files together (not individually per researcher)
  - RESEARCH.md goes to .planning/milestones/M-XX-slug/ instead of .planning/research/
  - declare-tools.cjs replaces gsd-tools.cjs for all tool invocations
metrics:
  duration: 15min
  completed: 2026-02-18
  tasks_completed: 3
  files_created: 4
---

# Milestone M-02: Milestone Research Pipeline Summary

**One-liner:** Parallel milestone research pipeline with 4 domain researchers (stack, features, architecture, pitfalls) feeding a synthesizer that produces a single RESEARCH.md per milestone.

## What Was Built

Three artifacts that together form Declare's milestone research pipeline:

1. **`agents/declare-researcher.md`** — A Declare-adapted fork of `gsd-phase-researcher`. Receives a milestone ID, goal, and declaration IDs. Investigates a single research domain (STACK, FEATURES, ARCHITECTURE, or PITFALLS) using the Context7 → Official Docs → WebSearch hierarchy. Writes a domain research file to `.planning/milestones/M-XX-slug/`. Does not commit — synthesizer handles committing.

2. **`agents/declare-research-synthesizer.md`** — A Declare-adapted fork of `gsd-research-synthesizer`. Reads all 4 domain research files, synthesizes them into executive summary + planning implications + confidence assessment, writes `RESEARCH.md`, and commits all files together with `declare-tools.cjs`.

3. **`commands/declare/research.md` + `.claude/commands/declare/research.md`** — The `/declare:research` slash command. Orchestrates the full pipeline: loads graph, validates milestone, spawns 4 parallel researchers, waits for completion, spawns synthesizer. Suggests `/declare:actions` as next step.

## Adaptations from GSD Sources

| GSD Original | Declare Fork | Key Changes |
|---|---|---|
| `gsd-phase-researcher` | `declare-researcher` | phase → milestone, ROADMAP.md → MILESTONES.md, REQUIREMENTS.md → FUTURE.md, .planning/phases/XX-name/ → .planning/milestones/M-XX-slug/, gsd-tools.cjs → declare-tools.cjs |
| `gsd-research-synthesizer` | `declare-research-synthesizer` | Same tool replacements; output is RESEARCH.md not SUMMARY.md; downstream consumer is declare-planner not gsd-roadmapper |
| `gsd:research-phase` | `declare:research` | Full orchestration rewrite: loads graph with declare-tools, 4 parallel researchers (not 1), synthesizer stage, milestone folder paths |

## Research Quality Preserved

All research quality features from the GSD source are retained:
- Context7 → Official Docs → WebSearch priority hierarchy
- HIGH/MEDIUM/LOW confidence levels per finding
- Pre-submission checklist (negative claims verified, multiple sources, etc.)
- Configuration scope blindness and deprecated features pitfall warnings
- CONTEXT.md constraint handling (locked decisions, Claude's discretion, deferred ideas)
- Declaration IDs → `milestone_declarations` section mapping

## Deviations from Plan

### A-03 Already Committed

**Found during:** A-03 execution
**Issue:** `agents/declare-researcher.md` was already created and committed in commit `d69de6a` during a prior M-01 session. The Write tool overwrote it with identical content.
**Impact:** No functional difference. File content matched what would have been produced.
**Resolution:** Auto-detected, noted as deviation. A-04 and A-05 proceeded normally.

### M-01 Files Bundled into A-04 Commit

**Found during:** A-04 commit
**Issue:** `commands/declare/discuss.md` and `.claude/commands/declare/discuss.md` were untracked from a prior session and got included in the A-04 commit (`40574b5`).
**Impact:** Files belong to M-01, are correctly placed, no functional harm. Slightly impure commit scope.
**Resolution:** Noted as deviation. Files were already correct content, no corrective action needed.

## Self-Check

### Files verified on disk:
- `agents/declare-researcher.md` — FOUND (committed in d69de6a)
- `agents/declare-research-synthesizer.md` — FOUND (committed in 40574b5)
- `commands/declare/research.md` — FOUND (committed in 9a9cc09)
- `.claude/commands/declare/research.md` — FOUND (committed in 9a9cc09)

### Commits verified:
- d69de6a — A-03 declare-researcher agent
- 40574b5 — A-04 declare-research-synthesizer agent
- 9a9cc09 — A-05 /declare:research command

## Self-Check: PASSED
