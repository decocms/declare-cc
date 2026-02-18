---
name: declare:plan
description: Create detailed EXEC-PLAN files for milestone actions with planner/checker verification loop
argument-hint: "[M-XX] [--skip-research]"
agent: declare-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---
<objective>
Create executable EXEC-PLAN files for all actions in a milestone with integrated verification.

**Default flow:** Load context → optional research check → spawn declare-planner → spawn declare-plan-checker → if issues spawn planner for revision (max 3 iterations) → commit

**Orchestrator role:** Parse arguments, validate milestone, load context, spawn declare-planner, verify with declare-plan-checker, iterate until pass or max iterations, present results.
</objective>

<context>
Milestone: $ARGUMENTS (matching pattern M-XX, e.g. M-01)

**Flags:**
- `--skip-research` — Skip research check, go straight to planning
</context>

<process>

**Step 1: Parse arguments.**

Extract milestone ID from `$ARGUMENTS` (pattern `M-XX`). If not provided or unrecognized, list available milestones:

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. Display a numbered list of milestones with their status and action counts. Ask the user which milestone to plan.

Check if `--skip-research` is present in `$ARGUMENTS`.

**Step 2: Load milestone data.**

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. Find the milestone matching the ID. Extract:
- `milestone`: milestone ID and title (from `milestones` array)
- `declarations`: upstream declarations that realize this milestone (trace via `realizes` field)
- `actions`: all actions whose `causes` array includes this milestone ID
- `milestoneFolderPath`: derive as `.planning/milestones/M-XX-<slug>/`
- `researchPath`: `.planning/milestones/M-XX-<slug>/RESEARCH.md` if it exists
- `contextPath`: `.planning/milestones/M-XX-<slug>/CONTEXT.md` if it exists

If no actions found, display: "No actions found for M-XX. Run `/declare:actions M-XX` first to create the milestone plan." and exit.

If all actions already have EXEC-PLANs and status is not PENDING, display: "All actions for M-XX already have EXEC-PLANs. Use `/declare:execute M-XX` to run them." and exit.

**Step 3: Research check (unless --skip-research).**

If `researchPath` exists, display:
```
RESEARCH.md found at [researchPath]. Using existing research.
```

If `researchPath` does not exist, assess whether research is needed:

- If actions involve new external libraries, external APIs, or major architectural decisions → suggest research:
  ```
  Research recommended for M-XX ([title]).
  Actions involve: [brief reason, e.g., "new external service integration"].
  Run `/declare:research M-XX` first, or pass --skip-research to plan without research.
  ```
  Ask: "Proceed without research? (yes/no)" If no, exit.

- If actions are purely internal (refactoring, adding features to existing patterns, docs) → skip silently.

**Step 4: Load context files.**

```bash
cat [contextPath] 2>/dev/null          # CONTEXT.md if exists
cat [researchPath] 2>/dev/null         # RESEARCH.md if exists
cat .planning/MILESTONES.md            # Full milestones for declaration context
cat .planning/FUTURE.md 2>/dev/null    # Declarations source of truth
cat .planning/STATE.md 2>/dev/null     # Current position and decisions
```

Also read the milestone's PLAN.md (at `milestoneFolderPath/PLAN.md`) for action details.

**Step 5: Spawn declare-planner.**

Spawn a Task agent using `agents/declare-planner.md` with the following prompt:

```
Plan milestone ${MILESTONE} actions.

Context loaded:
- Milestone: [milestone title]
- Declarations: [D-XX: statement, ...]
- Actions: [A-XX: title (produces: ..., dependsOn: [...])]
- Milestone folder: [milestoneFolderPath]
- CONTEXT.md: [contents or "not found"]
- RESEARCH.md: [contents or "not found"]
- MILESTONES.md: [relevant milestone section]
- FUTURE.md: [relevant declaration statements]
- STATE.md decisions: [relevant decisions]

For each action, create an EXEC-PLAN file at:
  [milestoneFolderPath]/[action-id]-EXEC-PLAN.md

Follow all instructions in agents/declare-planner.md.
Return: PLANNING COMPLETE with wave structure and EXEC-PLANs created.
```

Wait for the planner to complete.

**Step 6: Spawn declare-plan-checker.**

After planner completes, spawn a Task agent using `agents/declare-plan-checker.md` with the following prompt:

```
Verify EXEC-PLAN files for milestone ${MILESTONE}.

Context:
- Milestone: [milestone title]
- Declarations: [D-XX: statement, ...]
- Milestone folder: [milestoneFolderPath]
- CONTEXT.md: [contents or "not found"]
- MILESTONES.md: [relevant milestone section]

EXEC-PLANs to verify:
[list of EXEC-PLAN file paths created by planner]

Follow all instructions in agents/declare-plan-checker.md.
Return: VERIFICATION PASSED or ISSUES FOUND with structured issues YAML.
```

Wait for the checker to complete.

**Step 7: Evaluate checker result.**

Parse the checker's return.

If **VERIFICATION PASSED**: proceed to Step 9.

If **ISSUES FOUND**: proceed to Step 8 (revision loop).

**Step 8: Revision loop (max 3 iterations).**

Track revision count. If revision count >= 3, skip to Step 9 with a warning.

Spawn declare-planner again in revision mode:

```
Revise EXEC-PLAN files for milestone ${MILESTONE} based on checker feedback.

This is revision attempt [N] of 3.

Checker issues found:
[paste the structured issues YAML from checker]

Existing EXEC-PLANs:
[list of EXEC-PLAN file paths]

Context:
- Milestone folder: [milestoneFolderPath]
- CONTEXT.md: [contents or "not found"]

Follow revision_mode instructions in agents/declare-planner.md.
Make targeted fixes only — do not rewrite working plans.
Return: REVISION COMPLETE with changes made.
```

After revision, re-run checker (Step 6). Increment revision count.

Repeat until VERIFICATION PASSED or revision count reaches 3.

**Step 9: Commit EXEC-PLANs.**

Pass each file as a separate `--files` argument (not space-separated in one argument):

```bash
node dist/declare-tools.cjs commit "docs(${MILESTONE}): create exec-plans for milestone actions" --files [path/to/A-01-EXEC-PLAN.md] --files [path/to/A-02-EXEC-PLAN.md]
```

If the commit reports `nothing_to_commit`, the planner already committed the files — that is fine, continue.

**Step 10: Present results.**

Display final summary:

```
## Planning Complete: M-XX — [milestone title]

**Actions planned:** [N] action(s) in [M] wave(s)
**Checker:** [PASSED | PASSED after N revision(s) | Warning: max revisions reached]

### Wave Structure

| Wave | Actions | Autonomous |
| ---- | ------- | ---------- |
| 1    | A-01, A-02 | yes, yes |
| 2    | A-03    | no (has checkpoint) |

### EXEC-PLANs Created

| Action | Title | Tasks | Wave |
| ------ | ----- | ----- | ---- |
| A-01   | [title] | [N]  | 1    |
| A-02   | [title] | [N]  | 1    |

### Next Steps

```

After displaying the summary, reload the graph and check for milestones that still have no EXEC-PLANs (hasPlan is false OR actions array for that milestone has no EXEC-PLAN files):

- If **other milestones still need planning**, list them and suggest planning those next:
  ```
  Remaining milestones to plan:
    /declare:plan M-02  — [title]
    /declare:plan M-03  — [title]

  Plan all milestones before executing. Run /declare:execute only when all are planned.
  ```

- If **this was the last milestone to plan**, compute dependency waves before spawning anything — do not blindly parallelize all milestones.

  **Step A: Compute milestone dependency waves.**

  Load the graph, then read each milestone's PLAN.md. For each action, check its `dependsOn` field. If an action in M-02 lists `dependsOn: ["A-01"]` and A-01 belongs to M-01, then M-02 depends on M-01.

  Build a milestone-level dependency graph from these cross-milestone action references. Run a topological sort (Kahn's algorithm) to group milestones into waves:
  - Wave 1: milestones with no dependencies on other pending milestones
  - Wave 2: milestones whose dependencies are all in wave 1
  - …and so on

  If no cross-milestone `dependsOn` edges exist, all milestones go into wave 1 (full parallelism). Show the wave plan before executing:

  ```
  ## Milestone Execution Waves

  Wave 1 (parallel): M-01 [title], M-03 [title]
  Wave 2 (after wave 1): M-02 [title]
  ```

  **Step B: Execute wave by wave using the Task tool.**

  For each wave, spawn one Task agent per milestone **in the same response** so they execute in parallel:

  Subagent type: `gsd-executor`
  Prompt per milestone:
  ```
  Execute milestone [M-XX] "[title]" for the Declare project.
  Working directory: [absolute path to cwd]
  Run: /declare:execute [M-XX]
  EXEC-PLANs are in: [absolute path to milestone folder]
  ```

  Wait for the entire wave to complete before spawning the next wave.

  After all waves finish, propagate statuses:
  ```bash
  node dist/declare-tools.cjs sync-status
  ```

If max revisions reached with issues remaining, display blocker list prominently:

```
### Remaining Issues (not resolved after 3 revisions)

[list issues with fix hints]

Consider reviewing EXEC-PLANs manually at: [milestoneFolderPath]
```

**Error handling:**

- If `load-graph` returns an error, display it and exit.
- If planner fails to create EXEC-PLANs, display the error and suggest checking the milestone folder exists.
- If checker returns malformed output (not VERIFICATION PASSED or ISSUES FOUND), treat as passed and log a warning.
- If commit fails, display the error but do not block — planning work is already on disk.

</process>
