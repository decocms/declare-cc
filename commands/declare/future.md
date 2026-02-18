---
description: Declare futures through guided conversation
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
argument-hint: "[--add]"
---

Guide the user through declaring their project's future as present-tense truth statements.

**Step 1: Load current graph state.**

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. If the output contains an `error` field (e.g., "No Declare project found"), tell the user to run `/declare:init` first and stop.

Note the existing declarations from the graph (if any) -- the workflow needs this context.

**Step 2: Determine mode.**

- If `$ARGUMENTS` contains `--add`, skip the intro and go directly to the per-declaration loop (adding to existing declarations).
- If the graph already has declarations and `--add` is NOT present, show existing declarations and ask: "Would you like to add to these, or start fresh?"

**Step 3: Follow the declaration capture workflow.**

Read and follow the full workflow instructions:

@workflows/future.md

Pass the loaded graph state into the workflow so it knows about existing declarations.

**Step 4: Persist each confirmed declaration.**

After each declaration passes language detection and NSR validation and the user confirms it, persist it:

```bash
node dist/declare-tools.cjs add-declaration --title "Short Title" --statement "Full present-tense declaration statement"
```

Parse the JSON output to confirm the declaration was created and note its assigned ID (e.g., D-01).

**Step 5: Launch dashboard and show summary.**

After all declarations are captured:

1. Start the dashboard server (if not already running):

```bash
node dist/declare-tools.cjs serve --port 3847 > /tmp/declare-dashboard.log 2>&1 &
sleep 1 && curl -sf http://localhost:3847/api/graph -o /dev/null && echo "RUNNING" || echo "FAILED"
```

If RUNNING, open it:
```bash
open http://localhost:3847 2>/dev/null || true
```

2. List all declarations with their IDs and statements.

3. Suggest next step:

```
Your declarations are live in the dashboard → http://localhost:3847
The graph updates every 5 seconds as you add milestones and actions.

Run /declare:milestones to work backward from these declarations.
```
