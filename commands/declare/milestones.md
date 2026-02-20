---
description: Derive milestones backward from declared futures
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[D-XX]"
---

Derive milestones by working backward from declared futures.

**Step 1: Load current graph state.**

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. If the output contains an `error` field, tell the user to run `/declare:init` first and stop.

If no declarations exist in the graph, tell the user to run `/declare:future` first and stop.

Note all declarations and milestones from the graph -- the workflow needs full context.

**Step 2: Scope review (first-time derivation only).**

Skip this step if `$ARGUMENTS` contains a specific declaration ID (e.g., `D-01`) — targeted re-derivation skips scope review.

Otherwise, check if any milestones already exist in the graph. If milestones already exist, this is a re-derivation — skip scope review and proceed to Step 3.

If this is the first time deriving milestones (no milestones in the graph yet), run the scope review workflow before deriving anything:

@workflows/scope.md

Pass all declarations from the loaded graph into the scope workflow. After the scope is confirmed, continue to Step 3.

**Step 3: Determine derivation scope.**

- If `$ARGUMENTS` contains a declaration ID (e.g., `D-01`), derive only for that specific declaration.
- Otherwise, derive for all declarations that have no milestones yet (declarations with empty milestones arrays in the graph).

**Step 4: Follow the milestone derivation workflow.**

Read and follow the full workflow instructions:

@workflows/milestones.md

Pass the loaded graph state into the workflow so it knows about existing declarations and milestones.

**Step 5: Per-declaration milestone confirmation with checkboxes.**

After the workflow proposes milestones for a declaration, present them using AskUserQuestion with multi-select checkboxes:

```
Use AskUserQuestion to present proposed milestones as a checklist. The user checks which milestones to accept. Format:

Which of these milestones should we create for D-XX?
- [ ] Milestone A -- because [reason]
- [ ] Milestone B -- because [reason]
- [ ] Milestone C -- because [reason]
```

**Step 6: Persist all accepted milestones in one batch call.**

Build a JSON array of the checked milestones, then create them all at once:

```bash
node dist/declare-tools.cjs add-milestones --json '[{"title":"Milestone A","realizes":"D-XX"},{"title":"Milestone B","realizes":"D-XX"}]'
```

This creates all milestones and makes a single git commit. Parse the JSON output — it returns `{ milestones: [{ id, title, realizes, status }], committed, hash }`.

**Step 7: Inconsistency flagging.**

If milestones already exist for a declaration being processed (re-derivation case):
- Show existing milestones for that declaration
- Ask the user if they still align with the declaration
- Offer to keep, re-derive, or adjust
- Do NOT auto-reconcile -- the user decides what to update

**Step 8: Show summary and suggest next step.**

After all declarations processed:

1. Reload the graph to get final counts:
```bash
node dist/declare-tools.cjs load-graph
```

2. Start the dashboard if not already running (dashboard updates live when files change):
```bash
curl -sf http://localhost:3847/api/graph -o /dev/null || (node dist/declare-tools.cjs serve --port 3847 > /tmp/declare-dashboard.log 2>&1 & sleep 1 && open http://localhost:3847 2>/dev/null || true)
```

3. Show summary: declarations processed, milestones derived.
4. Suggest: "Milestones are live in the dashboard → http://localhost:3847 — Run `/declare:actions` to derive action plans."
