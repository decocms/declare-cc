---
name: declare:pause
description: Capture current work state into .continue-here.md and commit it for safe resumption
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

Capture the current work state and create a `.continue-here.md` handoff file so work can be resumed cleanly in a future session.

**Step 1: Load current state.**

Run:

```bash
node dist/declare-tools.cjs get-state
```

```bash
node dist/declare-tools.cjs load-graph
```

Parse both JSON outputs.

If `get-state` returns an error, display:

```
No STATE.md found. Nothing to pause — run /declare:new-project to initialize.
```

Then stop.

**Step 2: Gather current position.**

From `get-state` extract:
- `currentPosition`: active milestone/action
- `recentWork`: what was last done
- `decisions`: recent decisions
- `blockers`: any recorded blockers

From `load-graph` find:
- The active milestone (status `ACTIVE`) and its ID/title
- Its actions: separate into DONE and PENDING lists
- Any blockers explicitly noted in the graph

**Step 3: Build the handoff file content.**

Construct `.continue-here.md` with this structure:

```markdown
# Continue Here

**Paused:** [ISO timestamp, e.g., 2026-02-17T14:30:00Z]
**Position:** [currentPosition from STATE.md]

## Active Milestone

**[M-XX]: [title]** (status: [ACTIVE/PENDING])

## Completed Actions

[List each DONE action:]
- [A-XX]: [title]

(or "None yet" if no actions are done)

## Remaining Actions

[List each PENDING action:]
- [A-XX]: [title]

(or "None — milestone may be ready for verification" if all done)

## Decisions Made This Session

[decisions content from STATE.md, or "(none recorded)"]

## Blockers

[blockers content from STATE.md, or "(none)"]

## Recent Work

[recentWork content from STATE.md]

## Resume Instructions

Run `/declare:resume` to restore this context in a new session.

Or resume manually:
1. Read this file
2. Check `.planning/STATE.md` for full project state
3. Run `node dist/declare-tools.cjs load-graph` to see the full graph
4. Continue with the first PENDING action listed above
```

Use the current UTC timestamp (from `date -u +"%Y-%m-%dT%H:%M:%SZ"` or equivalent).

**Step 4: Write the handoff file.**

Write the constructed content to `.continue-here.md` at the project root.

**Step 5: Record session in STATE.md.**

```bash
node dist/declare-tools.cjs record-session \
  --stopped-at "[currentPosition]" \
  --resume-file ".continue-here.md"
```

**Step 6: Commit the handoff file.**

```bash
node dist/declare-tools.cjs commit "chore: pause work — [currentPosition]" \
  --files .continue-here.md .planning/STATE.md
```

Parse the JSON result. If `committed` is false and `reason` is `nothing_to_commit`, that is acceptable — the state is already saved.

**Step 7: Display confirmation.**

```
## Work Paused

**Position captured:** [currentPosition]
**Handoff file:** .continue-here.md
**Session recorded:** .planning/STATE.md

Paused. Run /declare:resume to restore context in a new session.
```

**Error handling:**

- If `load-graph` returns an error: still write `.continue-here.md` using only the STATE.md data. Note "Graph data unavailable" in the Remaining Actions section.
- If commit fails for reasons other than nothing_to_commit: display the error and note the file was written but not committed. User should commit manually.
