---
description: Archive a completed Declare milestone — snapshot graph, tag release, and prepare for next cycle
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[vX.Y]"
---

Archive a completed Declare milestone: snapshot the graph, check milestone statuses, update PROJECT.md, create a git tag, and prepare for the next cycle.

**Step 0: Determine version.**

Parse `$ARGUMENTS` for a version string matching `vX.Y` or `X.Y`.

If no version in `$ARGUMENTS`, ask: "What version are we completing? (e.g., v1.0)"

Normalize to `vX.Y` format (prepend `v` if absent).

**Step 1: Pre-flight check — verify milestone statuses.**

Load the full graph:

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. If it contains an `error` field, tell the user to run `/declare:init` first and stop.

For each milestone in the graph, check its `status` field. A milestone is complete when its status is `DONE`, `KEPT`, `HONORED`, or `RENEGOTIATED`.

Milestones are NOT complete if their status is `PENDING`, `ACTIVE`, or `BROKEN`.

Present a status table:

```
## Pre-flight Check: vX.Y

| Milestone | Title                          | Status  | Complete? |
| --------- | ------------------------------ | ------- | --------- |
| M-01      | Context capture per milestone  | KEPT    | YES       |
| M-02      | Milestone research pipeline    | PENDING | NO        |
```

If any milestones are NOT complete, show a warning:

```
Warning: [N] milestone(s) not yet complete:
- M-XX: [title] (PENDING)
- M-YY: [title] (BROKEN)

Options:
1. Proceed anyway — mark version complete with known incomplete milestones
2. Stop — complete remaining milestones first, then re-run
```

If the user chooses to stop, end here.

If the user proceeds with incomplete milestones, note them as known gaps in Step 5.

If ALL milestones are complete, display:

```
All [N] milestones complete. Proceeding with vX.Y completion.
```

**Step 2: Gather stats from git log.**

```bash
git log --oneline | wc -l
git log --oneline --since="$(git log --format='%ai' | tail -1)" | wc -l
git diff --stat HEAD~$(git log --oneline | wc -l | tr -d ' ')..HEAD 2>/dev/null | tail -1 || echo "stats unavailable"
git log --format="%ai" | tail -1
git log --format="%ai" | head -1
```

If a previous git tag exists, calculate stats since that tag:

```bash
# Check for existing tags
git tag --list "v*" | sort -V | tail -1

# If previous tag exists (e.g., v0.9), use it as the range start
PREV_TAG=$(git tag --list "v*" | sort -V | tail -1)
if [ -n "$PREV_TAG" ]; then
  git log --oneline "$PREV_TAG"..HEAD | wc -l
  git diff --stat "$PREV_TAG"..HEAD | tail -1
  git log --format="%ai" "$PREV_TAG"..HEAD | tail -1
fi
```

Present:

```
## Milestone Stats: vX.Y

- Milestones: [N] total ([N complete] complete, [N incomplete] incomplete)
- Commits since last tag: [N] commits
- Files changed: [M] files, [+N/-N] lines
- Timeline: [Start date] → [End date] ([N] days)
```

**Step 3: Archive graph snapshot.**

Run the complete-milestone CJS command to snapshot the current graph state:

```bash
node dist/declare-tools.cjs complete-milestone --version vX.Y
```

Parse the JSON output.

If it contains an `error` field, display it and stop.

On success, display:

```
## Archive Complete

Snapshot saved to .planning/milestones/vX.Y/

Files archived:
- .planning/milestones/vX.Y/FUTURE.md
- .planning/milestones/vX.Y/MILESTONES.md
- .planning/milestones/vX.Y/M-XX-*/PLAN.md  (for each milestone folder)
```

**Step 4: Update PROJECT.md "Current State" section.**

Read `.planning/PROJECT.md`:

```bash
cat .planning/PROJECT.md
```

Locate or create a `## Current State` section. Update it to reflect the completed version:

```markdown
## Current State

**Version shipped:** vX.Y (YYYY-MM-DD)
**Milestones completed:** [N] ([M-01, M-02, ...])
**Known gaps:** [list incomplete milestones, or "None"]
**Next step:** Run /declare:new-milestone to start vX.Z cycle
```

If the section already exists, update it in place. If it does not exist, append it after the last section.

Write the updated PROJECT.md back.

**Step 5: Create git tag.**

```bash
git tag -a vX.Y -m "$(cat <<'TAGMSG'
Declare vX.Y

Milestones shipped:
- M-XX: [title]
- M-YY: [title]

[Brief one-line summary of what this version delivers]

See .planning/milestones/vX.Y/ for full graph snapshot.
TAGMSG
)"
```

Confirm: "Tagged: vX.Y"

**Step 6: Commit archived files.**

Stage and commit all archive files and updated documents:

```bash
git add .planning/milestones/vX.Y/ .planning/PROJECT.md
git commit -m "chore: archive vX.Y milestone snapshot

- Snapshot: .planning/milestones/vX.Y/
- PROJECT.md: updated Current State section
"
```

**Step 7: Show completion summary.**

```
## vX.Y Complete

**Milestones shipped:** [N]
**Archive:** .planning/milestones/vX.Y/
**Git tag:** vX.Y
**PROJECT.md:** Updated

---

Next: Start the next milestone cycle.

Run /declare:new-milestone
```

**Error handling:**

- If `node dist/declare-tools.cjs load-graph` returns an error, suggest running `/declare:init` first.
- If `node dist/declare-tools.cjs complete-milestone` returns an error containing "already exists", ask the user if they want to delete the existing archive and retry.
- If git is not initialized, inform the user that git tagging requires `git init` and a prior commit.

**Key patterns:**

- Pre-flight check surfaces incomplete milestones before archiving — never silently proceed.
- Archive is a snapshot, not a destructive operation — FUTURE.md and MILESTONES.md remain in place.
- PROJECT.md is the persistent memory across versions — always update it.
- Git tag marks the historical release point for the snapshot.
- This command archives only — use /declare:new-milestone to reset for the next cycle.
