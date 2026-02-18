---
description: Audit milestone completion against declarations before archiving
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
argument-hint: "[M-XX]"
---

Audit a milestone's completion by cross-referencing completed actions against its declarations.

**Step 1: Determine milestone scope.**

If `$ARGUMENTS` contains a milestone ID (e.g., `M-01`), use it directly.

Otherwise, run the milestone picker and ask the user to select:

```bash
node dist/declare-tools.cjs execute
```

Display milestones and ask: "Which milestone would you like to audit?"

**Step 2: Run the audit.**

```bash
node dist/declare-tools.cjs audit-milestone --milestone M-XX
```

Parse the JSON output.

**Step 3: Display audit results.**

```
## Milestone Audit: M-XX — [milestoneTitle]

**Declarations checked:** [declarationsChecked]
**Actions checked:** [actionsChecked] ([actionsDone] done)

### Coverage
```

For each declaration, show whether it has completed supporting actions.

For each gap, display:

```
### Gaps Found

| Severity | Type | Description |
|----------|------|-------------|
| BLOCKER  | pending-actions | A-01, A-02 not yet complete |
| WARNING  | missing-verification | No VERIFICATION.md found |
```

**Step 4: Route based on result.**

If `passed` is true (no blockers):

```
Audit passed. This milestone is ready to complete.

Run `/declare:complete-milestone` to archive and tag this milestone.
```

If `passed` is false (blockers found):

```
Audit found [N] blocker(s). Resolve these before completing the milestone.
```

For pending actions: suggest running `/declare:execute M-XX` to complete them.
For missing plan: suggest running `/declare:actions M-XX` first.
For declaration gaps: offer to derive additional actions with `/declare:actions M-XX`.
