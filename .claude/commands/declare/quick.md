---
description: Execute a quick ad-hoc task with atomic commits outside the milestone structure
argument-hint: "[task description] [--full]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

Execute a small, ad-hoc task with atomic commits. Quick tasks live in `.planning/quick/` separate from milestone-driven phases.

**Default:** Skips plan-checking and verification. Use when you know exactly what to do.

**`--full` flag:** Adds plan-review before execution and a verification step after. Use when you want quality guarantees without full milestone ceremony.

**Step 1: Get the task description.**

Parse `$ARGUMENTS` for a task description and a `--full` flag.

If `$ARGUMENTS` contains text other than `--full`, treat that text as the task description. Strip `--full` from the description.

If `$ARGUMENTS` is empty or contains only `--full`, ask:

"What would you like to do? Describe the task in one or two sentences."

Wait for the user's reply and use it as the task description.

**Step 2: Create the quick task folder.**

```bash
node dist/declare-tools.cjs quick-task --description "[task description]"
```

Parse the JSON output. It contains `id`, `folder`, `planPath`, and `committed`.

Display:

```
Quick Task [id] created: [folder]
```

**Step 3 (--full only): Plan review.**

If `--full` flag is present:

Read the QUICK-PLAN.md at `planPath`:

```bash
cat [planPath]
```

Review the plan and display a brief assessment (2-4 bullet points):

```
## Plan Review

- [Assessment of scope and approach]
- [Any potential issues or missing steps]
- [Suggested refinements if needed]
```

Ask: "Proceed with this plan? (yes/refine)"

If "refine": ask for clarification, update the QUICK-PLAN.md with the refined plan, then continue.

If "yes": proceed to Step 4.

If `--full` is NOT present, skip this step and proceed directly to Step 4.

**Step 4: Execute the task.**

Spawn a Task agent to execute the work:

```
Execute the quick task described below. Make atomic commits after each logical unit of work.

Task: [task description]
Plan file: [planPath]

Read the plan file for context. Do the work. When complete, report:
- What was done
- Files created or modified
- Commit hashes
- Any issues encountered
```

Wait for the Task agent to complete. Display its report.

**Step 5 (--full only): Verification.**

If `--full` flag is present:

Ask: "Does the completed work match what you expected? Review the agent's report above. (yes/issues)"

If "issues": describe what is missing or wrong, then re-spawn the Task agent with the correction context appended.

If "yes": proceed to Step 6.

If `--full` is NOT present, proceed directly to Step 6.

**Step 6: Report completion.**

Display:

```
## Quick Task Complete

**Task:** [task description]
**Folder:** [folder]
**Mode:** [default | full]
```

List all files created or modified and all commit hashes from the agent's report.

Suggest: "Run `/declare:status` to see overall project health."
