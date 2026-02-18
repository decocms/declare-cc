---
description: Update declare-cc to the latest npm version with local-patch preservation
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<purpose>
Check whether a newer version of declare-cc is available on npm, show the version diff, back up any locally-modified files before the update runs, execute the install, reapply patches, and confirm the result.
</purpose>

<process>

## Step 1: Get the installed version

Run the declare-tools help command and parse the version field from its JSON output:

```bash
node dist/declare-tools.cjs help
```

Parse the JSON. The version is in the `version` field.

If the command fails or returns no version:
```
Could not read installed version.
Make sure you are running this command from the declare-cc project root (the directory containing dist/declare-tools.cjs).
```
Exit.

Store as `INSTALLED_VERSION`.

## Step 2: Check the latest npm version

```bash
npm view declare-cc version 2>/dev/null
```

If the command fails or returns empty output:
```
Could not check for updates (offline or npm unavailable).

To update manually: npx declare-cc@latest
```
Exit.

Store as `LATEST_VERSION`.

## Step 3: Compare versions

Parse both as semver (split on `.`, compare major/minor/patch numerically).

**If installed == latest:**
```
declare-cc is up to date (v{INSTALLED_VERSION})
```
Exit.

**If installed > latest:**
```
## Declare Update

**Installed:** v{INSTALLED_VERSION}
**Latest:** v{LATEST_VERSION}

You are ahead of the latest npm release (development build?). No update needed.
```
Exit.

**If installed < latest:** proceed to Step 4.

## Step 4: Show version diff and confirm

Display the pending update:

```
## Declare Update Available

**Installed:** v{INSTALLED_VERSION}
**Latest:**    v{LATEST_VERSION}
```

Use AskUserQuestion:
- Question: "Update to v{LATEST_VERSION}?"
- Options:
  - "Yes, update now"
  - "No, cancel"

If the user cancels: exit.

## Step 5: Scan for local modifications

Before updating, check whether any files inside `.claude/commands/declare/` differ from what the package originally installed.

**5a. Locate the baseline manifest.**

The installer writes a manifest at install time. Check for it:

```bash
# repo-relative path
cat .claude/commands/declare/.install-manifest.json 2>/dev/null
```

If the manifest exists, parse it. It contains an array of `{ path, hash }` entries where `hash` is the SHA-256 of the file at install time.

If the manifest does not exist, skip the diff scan and proceed directly to Step 6 with a note:
```
No install manifest found — skipping local-modification scan.
(Patches will not be backed up automatically.)
```

**5b. Hash each tracked file and compare.**

For each entry in the manifest:

```bash
# compute current hash
shasum -a 256 ".claude/commands/declare/{entry.path}" 2>/dev/null | awk '{print $1}'
```

If the current hash differs from the manifest hash, the file has been locally modified.

**5c. If modifications found, back them up.**

Create the backup directory (repo-relative):

```bash
mkdir -p .planning/declare-local-patches
```

Write a backup metadata file `.planning/declare-local-patches/backup-meta.json`:

```json
{
  "from_version": "{INSTALLED_VERSION}",
  "backup_date": "{ISO timestamp}",
  "files": [
    { "path": ".claude/commands/declare/{file}", "backup_name": "{safe-filename}" }
  ]
}
```

Copy each modified file:

```bash
cp ".claude/commands/declare/{file}" ".planning/declare-local-patches/{safe-filename}"
```

Display a summary:

```
## Local Modifications Detected

The following files differ from the original installation and have been backed up:

| File | Backup |
|------|--------|
| .claude/commands/declare/{file} | .planning/declare-local-patches/{safe-filename} |

These will be reapplied automatically after the update.
Run /declare:reapply-patches manually at any time to review or re-merge them.
```

**5d. If no modifications found:**
```
No local modifications detected. Proceeding with clean update.
```

## Step 6: Run the update

```bash
npx declare-cc@latest
```

Capture stdout and stderr. If the command exits non-zero:
```
## Update Failed

The installer returned an error:

{stderr}

You can retry manually:  npx declare-cc@latest
Your patch backups (if any) are preserved in .planning/declare-local-patches/
```
Exit.

## Step 7: Reapply patches (if any were backed up)

If patches were backed up in Step 5, reapply them automatically.

Read `.planning/declare-local-patches/backup-meta.json`.

For each backed-up file:

1. Read the backed-up (user's modified) version from `.planning/declare-local-patches/{safe-filename}`.
2. Read the newly installed version from `.claude/commands/declare/{file}`.
3. If the files are identical (the upstream incorporated the change): report `Skipped (already upstream)` and continue.
4. If the files differ: apply the user's version directly over the newly installed file.
   - Write the backed-up content to `.claude/commands/declare/{file}`.
   - Report `Reapplied`.

Display result table:

```
## Patches Reapplied

| File | Result |
|------|--------|
| .claude/commands/declare/{file} | Reapplied |
| .claude/commands/declare/{file} | Skipped (already upstream) |
```

If any reapplied file differs significantly from the new upstream version (the file changed in a way that may conflict), display:
```
Note: {file} was reapplied from your backup but the upstream also changed this file.
Run /declare:reapply-patches to review the diff and resolve conflicts manually.
```

## Step 8: Confirm completion

```
## Declare Updated

v{INSTALLED_VERSION} -> v{LATEST_VERSION}

Restart Claude Code to pick up the new commands.
```

If patches were reapplied:
```
Your local modifications have been reapplied. Run /declare:reapply-patches to verify or adjust.
```

</process>

<success_criteria>
- [ ] Installed version read from node dist/declare-tools.cjs help
- [ ] Latest version checked via npm view declare-cc version
- [ ] No-op if already up to date
- [ ] Version diff shown and user confirms before proceeding
- [ ] Local modifications scanned against install manifest
- [ ] Modified files backed up to .planning/declare-local-patches/
- [ ] Update run via npx declare-cc@latest
- [ ] Patches reapplied after update
- [ ] Completion confirmed with restart reminder
</success_criteria>
