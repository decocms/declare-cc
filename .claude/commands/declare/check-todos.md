---
description: List pending todos and select one to work on or route to a milestone
argument-hint: ""
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---

List all pending todos, let the user select one, and offer to act on it now or plan it into the next milestone.

**Step 1: Load pending todos.**

```bash
node dist/declare-tools.cjs check-todos
```

Parse the JSON output. It contains a `todos` array with `{id, description, created, path}` objects.

If `todos` is empty:

```
No pending todos. Capture ideas with `/declare:add-todo`.
```

Stop.

**Step 2: Display the todo list.**

```
## Pending Todos ([count])

1. [id]: [description] — [created]
2. [id]: [description] — [created]
...
```

Ask: "Which todo would you like to look at? Enter the number, ID, or 'skip' to exit."

**Step 3: Load the selected todo.**

Wait for the user's response.

If "skip" or empty: exit.

Identify the selected todo by number or ID from the list.

Read the todo file at its `path`:

```bash
cat [path]
```

Display the full todo content so the user can review it.

**Step 4: Offer actions.**

Ask: "What would you like to do with this todo?"

Present these options:

```
1. Work on it now (spawn a quick task agent)
2. Add to next milestone planning
3. Mark as completed (move to completed/)
4. Skip (leave pending)
```

**Step 5: Execute the chosen action.**

**Option 1 — Work on it now:**

Spawn a Task agent:

```
Execute this todo task. Make atomic commits after each logical unit of work.

Task: [description]
Context file: [path]

Read the context file. Do the work. When complete, report what was done, files changed, and commit hashes.
```

After the agent completes, display its report, then ask: "Mark this todo as completed? (yes/no)"

If yes: run:

```bash
node dist/declare-tools.cjs complete-todo --id [id]
```

Display: "Todo [id] marked as completed."

**Option 2 — Add to next milestone planning:**

Ask: "Which milestone should this feed into? (e.g. M-14, or 'new' to create a new one)"

If the user provides a milestone ID, display:

```
Noted: "[description]" should be considered when planning [milestone-id].
```

Add this note as a reminder: suggest the user mention it when running `/declare:milestones` or `/declare:actions` for that milestone.

**Option 3 — Mark as completed:**

```bash
node dist/declare-tools.cjs complete-todo --id [id]
```

Parse the JSON output and display: "Todo [id] moved to completed/."

**Option 4 — Skip:**

Display: "Todo left pending."

**Step 6: Offer to review another todo.**

After completing any action (or skipping), ask: "Would you like to review another todo? (yes/no)"

If yes: return to Step 2 with the updated list (reload to reflect any completions).

If no: exit.
