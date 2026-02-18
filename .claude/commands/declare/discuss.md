---
description: Gather milestone context through adaptive questioning before execution
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
argument-hint: "<M-XX> [--auto]"
---

Extract implementation decisions that downstream agents need — the planner and executor will use CONTEXT.md to know what choices are locked.

**How it works:**
1. Analyze the milestone to identify gray areas (behavior, output, flow, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create CONTEXT.md with decisions that guide planning and execution

**Output:** `CONTEXT.md` in the milestone folder — decisions clear enough that downstream agents can act without asking the user again.

**Step 1: Load the graph.**

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. If it contains an `error` field, tell the user to run `/declare:init` first and stop.

Extract milestone data. Identify the milestone matching `$ARGUMENTS` (e.g., `M-01`). If no milestone ID is provided, tell the user to provide one (e.g., `/declare:discuss M-01`) and stop.

If the milestone ID is not found in the graph, tell the user and stop:
```
Milestone [M-XX] not found.

Use /declare:status to see available milestones.
```

**Step 2: Follow the discuss workflow.**

Read and follow all steps in:

@workflows/discuss.md

Pass the loaded graph state and milestone data into the workflow.

The milestone directory is: `.planning/milestones/[M-XX]-[slug]/`

CONTEXT.md is written to: `.planning/milestones/[M-XX]-[slug]/CONTEXT.md`

**Step 3: Commit context.**

After CONTEXT.md is written, commit it:

```bash
node dist/declare-tools.cjs commit "docs(M-XX): capture milestone context" --files ".planning/milestones/[M-XX]-[slug]/CONTEXT.md"
```

Replace `M-XX` and `[M-XX]-[slug]` with the actual milestone ID and slug.

**Step 4: Handle auto-advance.**

Check for `--auto` in `$ARGUMENTS` and follow the auto-advance step in the workflow.
