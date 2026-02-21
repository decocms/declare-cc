---
name: declare:resume
description: Restore full project context from a previous session and route to the next action
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

Restore project context from a previous session and route to the appropriate next action.

**Step 1: Check for handoff file.**

Check whether `.continue-here.md` exists at the project root:

```bash
ls .continue-here.md 2>/dev/null && echo "found" || echo "not found"
```

**Step 2a: If `.continue-here.md` exists — restore from handoff.**

Read `.continue-here.md`.

Display its contents in a clean, structured format:

```
## Resuming from Saved Context

**Paused at:** [Paused timestamp from file]
**Position:** [Position from file]

### Active Milestone

[Active milestone details from file]

### Remaining Actions

[Remaining actions list from file]

### Decisions Made Last Session

[Decisions from file]

### Blockers

[Blockers from file]
```

Then run `load-graph` to get fresh action statuses (actions may have changed since the pause):

```bash
node dist/declare-tools.cjs load-graph
```

If graph loads successfully, cross-reference: if any actions listed as PENDING in `.continue-here.md` are now DONE in the graph, note that:

```
Note: Since pausing, [A-XX] has been completed.
```

Proceed to Step 3 (routing).

**Step 2b: If `.continue-here.md` does not exist — load from STATE.md.**

Run:

```bash
node dist/declare-tools.cjs get-state
```

```bash
node dist/declare-tools.cjs load-graph
```

If `get-state` returns an error (STATE.md not found):

```
No project state found. Run /declare:new-project to initialize.
```

Then stop.

Display the state context:

```
## Resuming from STATE.md

**Current Position:** [currentPosition]
**Last Activity:** [most recent session history entry, if any]

### Recent Work

[recentWork from STATE.md]

### Decisions

[decisions from STATE.md, or "(none recorded)"]
```

Proceed to Step 3 (routing).

**Step 3: Route to next action.**

Evaluate the current project state and present the most relevant next step:

**Route A — Pending actions on active milestone:**
- "Ready to continue [M-XX] — [N] actions remaining."
- Offer: "`/declare:execute [M-XX]` to continue"

**Route B — Active milestone fully complete, not yet verified:**
- "[M-XX] has all actions done but is not yet verified."
- Offer: "`/declare:verify [M-XX]` to verify milestone truth"

**Route C — Blocker recorded:**
- "A blocker was recorded: [blocker text]"
- Offer options: "Resolve it manually, then run `/declare:execute [M-XX]`" or "`/declare:status` to review the graph"

**Route D — No active milestone:**
- "No active milestone found."
- Offer: "`/declare:new-cycle` to plan next milestone" or "`/declare:status` to review graph"

**Route E — No project initialized:**
- "Project not initialized."
- Offer: "`/declare:new-project` to initialize"

Present the route as a clear, single recommendation with an alternative if applicable.

**Step 4: Record session resumption.**

```bash
node dist/declare-tools.cjs record-session --stopped-at "Resumed — [currentPosition]"
```

Do not display the output of this command.

**Step 5: Clean up handoff file (if used).**

If `.continue-here.md` was used in Step 2a and routing shows work is continuing normally, offer:

```
The .continue-here.md handoff file can be removed once you are fully resumed.
Run: git rm .continue-here.md && git commit -m "chore: resume work — remove handoff file"
```

Do not remove it automatically — leave that to the user.
