---
description: Review and reapply locally-modified declare-cc files after an update
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<purpose>
After a declare-cc update wipes and reinstalls .claude/commands/declare/ files, this command lets you review each locally-modified file that was backed up, preview what changed, and selectively merge your modifications into the new installed version.
</purpose>

<process>

## Step 1: Detect backed-up patches

Read the backup metadata file (repo-relative):

```bash
cat .planning/declare-local-patches/backup-meta.json 2>/dev/null
```

**If the file does not exist or the directory is empty:**
```
No local patches found. Nothing to reapply.

Local patches are saved automatically when you run /declare:update
and locally-modified files are detected before the update runs.
```
Exit.

Parse the JSON. It contains:
- `from_version`: the version that was installed when the backup was made
- `backup_date`: ISO timestamp of the backup
- `files`: array of `{ path, backup_name }` entries

## Step 2: Show patch summary

Read the current installed version:

```bash
node dist/declare-tools.cjs help
```

Parse the version field.

Display:

```
## Local Patches to Reapply

**Backed up from:** v{from_version}
**Backed up on:**   {backup_date}
**Current version:** v{current_version}
**Files backed up:** {count}

| # | File | Status |
|---|------|--------|
| 1 | {path} | Pending |
| 2 | {path} | Pending |
```

## Step 3: Process each file

Iterate over each entry in `files`.

### 3a. Read both versions

Read the backed-up (user's modified) copy:

```bash
cat ".planning/declare-local-patches/{backup_name}"
```

Read the current installed copy:

```bash
cat "{path}"
```

### 3b. Compare

If the two files are identical: report `Skipped (already upstream)` and continue to the next file.

If they differ: proceed to 3c.

### 3c. Show diff preview and ask

Display a diff preview. Describe the key differences in plain language (do not dump raw diff output). For example:

```
--- Diff preview: {path} ---

Your backed-up version adds/changes:
- [describe what the user's version has that the new version does not, in plain language]

The new installed version adds/changes:
- [describe what the new upstream version has that the backup does not]
```

Use AskUserQuestion:
- Question: "What would you like to do with .claude/commands/declare/{filename}?"
- Options:
  - "Keep my version (overwrite installed file with backup)"
  - "Keep new version (discard backup for this file)"
  - "Merge manually (I will edit the file after this command)"

**If user chooses "Keep my version":**
- Write the backed-up content to `{path}`.
- Report: `Reapplied — your version is active`.

**If user chooses "Keep new version":**
- Do not modify `{path}`.
- Report: `Kept new version — backup preserved in .planning/declare-local-patches/`.

**If user chooses "Merge manually":**
- Do not modify `{path}`.
- Display:
  ```
  Backed-up copy: .planning/declare-local-patches/{backup_name}
  Installed copy: {path}
  Edit {path} manually, using the backup as reference.
  ```
- Report: `Deferred — manual merge required`.

## Step 4: Update status table

After processing all files, display the final status table:

```
## Reapply Complete

| # | File | Result |
|---|------|--------|
| 1 | {path} | Reapplied |
| 2 | {path} | Skipped (already upstream) |
| 3 | {path} | Kept new version |
| 4 | {path} | Deferred (manual merge) |

{reapplied_count} file(s) reapplied. {skipped_count} skipped. {deferred_count} deferred.
```

## Step 5: Cleanup option

Ask:

Use AskUserQuestion:
- Question: "What would you like to do with the backup files in .planning/declare-local-patches/?"
- Options:
  - "Keep backups (preserve for reference)"
  - "Remove backups (clean up patch directory)"

**If user chooses "Remove backups":**

```bash
rm -rf .planning/declare-local-patches
```

Display: `Backup directory removed.`

**If user chooses "Keep backups":**
Display: `Backups preserved at .planning/declare-local-patches/`

</process>

<success_criteria>
- [ ] backup-meta.json located and parsed
- [ ] Version comparison shown (backed-up from vs current)
- [ ] Each file diff previewed in plain language
- [ ] User confirms action per file (keep mine / keep new / manual)
- [ ] Chosen versions written correctly
- [ ] Final status table shown
- [ ] Cleanup option offered
</success_criteria>
