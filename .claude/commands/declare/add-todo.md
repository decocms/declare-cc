---
description: Capture an idea or task as a todo for later work
argument-hint: "[description]"
allowed-tools:
  - Bash
---

Capture an idea, task, or issue that surfaced during the current session as a structured todo.

**Step 1: Get the description.**

Parse `$ARGUMENTS` for a description string.

If `$ARGUMENTS` is non-empty, use it as the description directly.

If `$ARGUMENTS` is empty, infer the description from the current conversation context: look at the last few exchanges for any mentioned ideas, tasks, follow-ups, or issues the user flagged. If context is ambiguous, ask:

"What would you like to capture as a todo? Give a short description."

Wait for the user's reply.

**Step 2: Create the todo.**

```bash
node dist/declare-tools.cjs add-todo --description "[description]"
```

Parse the JSON output. It contains `id`, `path`, and `committed`.

**Step 3: Confirm capture.**

Display:

```
Todo [id] captured: [path]
"[description]"
```

If `committed` is true, mention the commit hash.

Suggest: "Run `/declare:check-todos` to see all pending todos."
