---
milestone: M-38-model-aware-agent-dispatch
action: A-80
subsystem: orchestration
tags: [model-routing, task-dispatch, claude, opus, sonnet, haiku]

requires:
  - action: A-79
    provides: modelAssignment mapping in .planning/config.json

provides:
  - Explicit model parameters on all Task spawns in plan.md, execute.md, research.md, verify.md

affects: [plan, execute, research, verify, debug]

tech-stack:
  added: []
  patterns:
    - "Model-explicit Task spawns: each orchestrator command hardcodes the appropriate model string on Task tool calls"
    - "Role-to-model mapping: planner/executor/debugger=opus, researcher/synthesizer=sonnet, checker=haiku"

key-files:
  created: []
  modified:
    - commands/declare/plan.md
    - commands/declare/execute.md
    - commands/declare/research.md
    - commands/declare/verify.md

key-decisions:
  - "Hardcode model strings inline in command files rather than runtime config lookup — simpler, explicit, no CJS dependency at orchestration time"
  - "Use consistent inline format matching surrounding prose style rather than a uniform Task() pseudocode block"
  - "debug.md left unchanged — already uses {debugger_model} variable resolved from config at runtime"

duration: 3min
completed: 2026-02-21
---

# Milestone M-38 Action A-80: Add Model Parameters to Orchestrator Task Spawns Summary

**Model-explicit Task dispatch hardcoded across all five orchestrator commands — planner/executor/debugger=opus, researcher/synthesizer=sonnet, checker=haiku — preventing session model inheritance.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-21T18:58:36Z
- **Completed:** 2026-02-21T19:01:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- plan.md: 5 Task spawn sites updated (discuss agent opus, declare-planner opus, declare-plan-checker haiku, revision planner opus, milestone executor spawns opus)
- execute.md: executor agent spawn in Step 3c updated to model opus
- research.md: 4 researcher spawns (STACK/FEATURES/ARCHITECTURE/PITFALLS) and synthesizer spawn updated to model sonnet
- verify.md: declare-debugger spawn updated to model opus

## Task Commits

1. **Task 1: plan.md and execute.md** - `8d20386` (feat)
2. **Fix: lowercase model field in plan.md Step B** - `12e9eb6` (fix)
3. **Task 2: research.md and verify.md** - `629b910` (feat)

## Files Created/Modified

- `commands/declare/plan.md` - 5 model fields added across 4 distinct Task spawn sites
- `commands/declare/execute.md` - model: "opus" added to executor spawn (Step 3c)
- `commands/declare/research.md` - model: "sonnet" added to 4 researcher headers + synthesizer spawn
- `commands/declare/verify.md` - model: "opus" added to declare-debugger spawn

## Decisions Made

- Used inline prose format ("spawn a Task agent using X with `model: "opus"`") for Step 6/7/9 spawns in plan.md, matching the existing descriptive style rather than inventing a new code block format
- Used label format ("**STACK researcher** (model: `sonnet`):") for research.md since each researcher is already identified by bold label — adds model without disrupting the visual pattern
- Added a paragraph-level note in research.md Step 5 for clarity: "Each researcher Task is spawned with `model: "sonnet"`"
- debug.md intentionally not modified — it already resolves debugger_model from config at runtime via CJS command, which is the canonical pattern for that command

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed case mismatch on plan.md Step B model field**
- **Found during:** Post-Task 1 verification run
- **Issue:** Initial edit added `Model: \`opus\`` (capital M) in Step B, which `grep -c "model"` (case-sensitive) did not count
- **Fix:** Changed to lowercase `model: \`opus\`` to match all other model fields
- **Files modified:** commands/declare/plan.md
- **Commit:** 12e9eb6

---

**Total deviations:** 1 auto-fixed (Rule 1 - case bug)
**Impact on plan:** Trivial fix. No scope change.

## Issues Encountered

None beyond the capitalization fix.

## Self-Check: PASSED

- FOUND: commands/declare/plan.md
- FOUND: commands/declare/execute.md
- FOUND: commands/declare/research.md
- FOUND: commands/declare/verify.md
- FOUND: .planning/milestones/M-38-model-aware-agent-dispatch/A-80-SUMMARY.md
- FOUND commit: 8d20386
- FOUND commit: 629b910
- FOUND commit: 12e9eb6
