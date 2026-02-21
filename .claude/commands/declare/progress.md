---
name: declare:progress
description: Show current project position, recent work summary, and route to the next action
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

Show project progress, summarize recent work, and route to the appropriate next action.

**Step 1: Load state and graph.**

Run both commands:

```bash
node dist/declare-tools.cjs get-state
```

```bash
node dist/declare-tools.cjs load-graph
```

Parse both JSON outputs.

If `get-state` returns an error (STATE.md not found), display:

```
No STATE.md found. Run /declare:new-project to initialize this project.
```

Then stop.

**Step 2: Determine current position.**

From the `get-state` output, extract:
- `currentPosition`: the milestone or action currently active
- `recentWork`: what was last worked on
- `decisions`: key decisions recorded
- `sessionHistory`: last session entries

From the `load-graph` output, extract:
- `milestones` array: find milestones with status `PENDING` or `ACTIVE`
- `actions` array: find actions for the active milestone with status `PENDING` or `ACTIVE`
- Count total milestones, total done milestones, total actions done

**Step 3: Display progress dashboard.**

Render a compact, scannable summary:

```
## Project Progress

**Position:** [currentPosition from STATE.md]
**Milestones:** [done count] / [total count] complete
**Graph health:** [health field from load-graph, or "unknown" if absent]

### Active Milestone

[If an ACTIVE milestone exists, show:]
**[M-XX]: [title]** — [status]
Actions: [done]/[total] complete

[pending actions listed as:]
- A-XX: [title] (PENDING)
- A-XX: [title] (DONE)

### Recent Work

[recentWork from STATE.md, or "(no recent work recorded)" if empty]

### What's Next

[See routing logic in Step 4]
```

**Step 4: Route to next action.**

Evaluate project state and present the appropriate option(s):

**Route A — Active milestone with pending actions:**
- "Actions remain for [M-XX]. Ready to continue."
- Offer: "Run `/declare:execute [M-XX]` to continue execution"

**Route B — Milestone just completed, not yet verified:**
- "[M-XX] is DONE but not yet verified."
- Offer: "Run `/declare:verify [M-XX]` to verify milestone truth"

**Route C — All milestones for active declarations complete:**
- "All milestones for the current declaration wave are complete."
- Offer: "Run `/declare:complete-milestone` or plan the next milestone with `/declare:new-cycle`"

**Route D — No active milestone:**
- "No active milestone found."
- Offer: "Run `/declare:new-cycle` to plan the next milestone, or `/declare:status` to review the full graph"

**Route E — No declarations exist:**
- "No declarations found. Start by defining what you want to be true."
- Offer: "Run `/declare:future` to add your first declaration"

**Route F — Graph load error:**
- Display the error from `load-graph`
- Offer: "Run `/declare:health` to diagnose and repair the project structure"

Present routes as a numbered list when more than one applies. Keep suggestions concise — one line per option.

**Step 5: Update session record.**

After displaying the dashboard, record the session view:

```bash
node dist/declare-tools.cjs record-session --stopped-at "Checked progress — [currentPosition]"
```

Do not display the output of this command.
