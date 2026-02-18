---
description: Diagnose .planning/ directory health and optionally repair issues
argument-hint: [--repair]
allowed-tools:
  - Read
  - Bash
  - Write
---

Validate `.planning/` directory integrity and report actionable issues.

**Step 1: Parse arguments.**

Check `$ARGUMENTS` for the `--repair` flag.

**Step 2: Run health check.**

If `--repair` was passed:

```bash
node dist/declare-tools.cjs health-check --repair
```

Otherwise:

```bash
node dist/declare-tools.cjs health-check
```

Parse the JSON output. It contains:
- `healthy`: boolean — whether all checks passed
- `issues`: array of `{ type, message, path, fixable }` objects
- `repaired`: array of strings describing what was fixed (only present when `--repair` was used)

**Step 3: Display results.**

**If healthy (no issues):**

```
.planning/ health: OK

All checks passed:
  FUTURE.md            — exists and parseable
  MILESTONES.md        — exists and parseable
  config.json          — exists and parseable
  Milestone folders    — all referenced milestones have folders
  Orphan check         — no orphaned milestone folders
```

**If there are issues:**

Show a header with the count:

```
.planning/ health: [N] issue(s) found
```

Then list each issue clearly:

```
  [type indicator] [message]
  Path: [path]
  Fixable: yes / no
```

Use these type indicators:
- `missing_file` → "MISSING"
- `parse_error` → "PARSE ERROR"
- `missing_folder` → "MISSING FOLDER"
- `orphaned_folder` → "ORPHAN"

**If `--repair` was used and repairs were made:**

```
Repaired [N] issue(s):
  - [repair description]
  ...

Remaining issues: [N] (require manual intervention)
```

**Step 4: Suggest next steps.**

If there are unfixable issues, suggest:
- Missing FUTURE.md or MILESTONES.md: "Run `/declare:init` to recreate missing files"
- Parse errors: "Manually inspect and fix the file at [path]"
- Orphaned folders: "Remove or reconnect the folder: [path]"

If there are fixable issues and `--repair` was NOT passed:
```
Run `/declare:health --repair` to automatically fix [N] fixable issue(s).
```
