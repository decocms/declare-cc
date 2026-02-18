---
description: Start a new Declare milestone cycle — archive declarations, reset FUTURE.md and MILESTONES.md, preserve PROJECT.md and STATE.md
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[milestone focus, e.g., 'v1.1 Web Dashboard']"
---

Start a new Declare milestone cycle. Archives the current declarations to FUTURE-ARCHIVE.md, resets FUTURE.md and MILESTONES.md for fresh declarations, and preserves project memory in PROJECT.md and STATE.md.

**Step 0: Determine milestone focus.**

Parse `$ARGUMENTS` for a milestone name or focus description.

If `$ARGUMENTS` is empty or contains no useful text, ask: "What's the focus of this next milestone? (e.g., 'v1.1 Web Dashboard', 'v2.0 Collaborative Features')"

**Step 1: Load project context.**

Read the current project state:

```bash
cat .planning/PROJECT.md
cat .planning/STATE.md
cat .planning/FUTURE.md
cat .planning/MILESTONES.md
```

If `.planning/PROJECT.md` does not exist, tell the user to run `/declare:init` first and stop.

Present a summary of what was in the current milestone:

```
## Current Milestone Summary

**Declarations ([N] total):**
- D-01: [statement snippet]
- D-02: [statement snippet]

**Milestones ([N] total):**
- M-XX: [title] ([status])
- M-YY: [title] ([status])

**About to start:** [milestone focus from Step 0]
```

**Step 2: Archive previous declarations to FUTURE-ARCHIVE.md.**

Read `.planning/FUTURE.md` to get all current declarations.

Append the current declarations to `.planning/FUTURE-ARCHIVE.md` (create if it does not exist), with a versioned header:

```markdown
---

## Archived: [previous milestone version or "v[N]"] — [today's date]

**Milestone focus:** [previous milestone focus, if known from PROJECT.md or STATE.md]

[Full content of current FUTURE.md — all declarations as-is]
```

After appending, verify the archive was written:

```bash
cat .planning/FUTURE-ARCHIVE.md | tail -20
```

Report: "Archived [N] declarations to .planning/FUTURE-ARCHIVE.md"

**Step 3: Reset FUTURE.md.**

Overwrite `.planning/FUTURE.md` with an empty template:

```markdown
# Future: [project name from PROJECT.md]

<!-- Declarations for [new milestone focus] will be added here. -->
<!-- Run /declare:future to declare the new milestone's futures. -->
```

Extract the project name from `.planning/PROJECT.md` (look for the `# Future:` or `# Project:` heading, or use the directory name as fallback).

**Step 4: Reset MILESTONES.md.**

Overwrite `.planning/MILESTONES.md` with an empty table:

```markdown
# Milestones: [project name]

## Milestones

| ID | Title | Status | Realizes | Plan |
|----|-------|--------|----------|------|
```

This table is empty — new milestones will be derived from the new declarations via `/declare:milestones`.

**Step 5: Update STATE.md session.**

Read `.planning/STATE.md` and update the session fields. Preserve all existing content (project context, decisions, todos) — only update:

- `Last session`: today's date
- `Stopped at`: "Started [new milestone focus] — awaiting new declarations"
- If there is a `## Current Position` or `## Status` section, update it to reflect the new cycle beginning

Write the updated STATE.md back.

Example update (preserve all other sections unchanged):

```markdown
## Session Continuity

Last session: [today]
Stopped at: Started [new milestone focus] — awaiting new declarations via /declare:future
```

**Step 6: Commit reset.**

Stage and commit the reset files:

```bash
git add .planning/FUTURE.md .planning/MILESTONES.md .planning/FUTURE-ARCHIVE.md .planning/STATE.md
git commit -m "chore: start new milestone cycle -- [new milestone focus]

- FUTURE-ARCHIVE.md: archived [N] declarations from previous cycle
- FUTURE.md: reset for new declarations
- MILESTONES.md: reset for new milestones
- STATE.md: updated session
"
```

**Step 7: Show next steps.**

```
## New Milestone Cycle Started

**Focus:** [new milestone focus]

**What was preserved:**
- .planning/PROJECT.md (project memory, validated requirements, decisions)
- .planning/STATE.md (session continuity, todos, blockers)

**What was reset:**
- .planning/FUTURE.md (empty — ready for new declarations)
- .planning/MILESTONES.md (empty — ready for derived milestones)
- .planning/FUTURE-ARCHIVE.md (archived [N] previous declarations)

---

**Next step:** Declare the futures for this milestone.

Run /declare:future
```

**Error handling:**

- If `.planning/FUTURE.md` is already empty or has no declarations, warn: "FUTURE.md appears to be empty — nothing to archive. Continue to reset MILESTONES.md? (yes/no)"
- If `.planning/MILESTONES.md` still has PENDING or ACTIVE milestones, warn: "Warning: [N] milestones are not yet complete. Run /declare:complete-milestone first to archive the current version, then run /declare:new-milestone."
- If git commit fails, display the error and instruct the user to commit manually.

**Key patterns:**

- PROJECT.md and STATE.md are project memory — they persist across milestone cycles and are NEVER reset.
- FUTURE.md and MILESTONES.md are milestone-scoped — they reset every cycle.
- FUTURE-ARCHIVE.md is append-only — previous declarations are never deleted, only archived.
- This command does NOT create new declarations — it resets the slate for /declare:future.
- Scope of the next milestone is set by asking "What's the focus?" not by writing declarations yet.
- After this command: /declare:future -> /declare:milestones -> /declare:actions -> /declare:execute
