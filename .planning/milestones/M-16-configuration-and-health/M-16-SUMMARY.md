---
milestone: M-16
title: Configuration and health
status: COMPLETE
completed: 2026-02-18
duration: 8min
actions_completed: 2
files_created: 10
files_modified: 3
commits:
  - hash: 71919f0
    message: "feat(M-16): add config-get, config-set, health-check CJS subcommands"
  - hash: 9cd17aa
    message: "feat(M-16): add settings, set-profile, health slash commands"
key_decisions:
  - "health-check returns fixable flag per issue so slash command can selectively run --repair"
  - "config-set uses auto-parse for boolean/number values to avoid quoting issues at call site"
  - "health-check --repair uses runHealthCheckRepair which re-runs check after repair for accurate final state"
tech_stack:
  added: []
  patterns:
    - "dotted-path config access (getAtPath/setAtPath) consistent with GSD's config-get pattern"
    - "repair-then-recheck pattern for health-check --repair"
key_files:
  created:
    - src/commands/config-get.js
    - src/commands/config-set.js
    - src/commands/health-check.js
    - commands/declare/settings.md
    - commands/declare/set-profile.md
    - commands/declare/health.md
    - .claude/commands/declare/settings.md
    - .claude/commands/declare/set-profile.md
    - .claude/commands/declare/health.md
  modified:
    - src/declare-tools.js
    - dist/declare-tools.cjs
dependency_graph:
  requires:
    - src/artifacts/future.js (parseFutureFile)
    - src/artifacts/milestones.js (parseMilestonesFile)
    - src/artifacts/milestone-folders.js (findMilestoneFolder, ensureMilestoneFolder)
  provides:
    - node dist/declare-tools.cjs config-get <path>
    - node dist/declare-tools.cjs config-set --key <path> --value <value>
    - node dist/declare-tools.cjs health-check [--repair]
    - /declare:settings slash command
    - /declare:set-profile slash command
    - /declare:health slash command
  affects:
    - All slash commands that read model_profile or workflow.* settings
---

# M-16: Configuration and Health Summary

**One-liner:** config-get/config-set/health-check CJS subcommands plus settings, set-profile, and health slash commands for Declare.

## What Was Built

### Action A-31: CJS Subcommands

Three new subcommands added to `src/declare-tools.js` and rebuilt into `dist/declare-tools.cjs`:

**`config-get <path.to.key>`**
- Reads `.planning/config.json` and returns the value at a dotted path
- Returns `{ key, value }` or `{ error }` if key not found or file missing
- Example: `node dist/declare-tools.cjs config-get workflow.research` → `{"key":"workflow.research","value":true}`

**`config-set --key <path> --value <value>`**
- Reads `.planning/config.json`, sets value at dotted path, writes back
- Auto-parses "true"/"false" → boolean, numeric strings → number
- Creates intermediate objects as needed for nested paths
- Example: `node dist/declare-tools.cjs config-set --key workflow.auto_advance --value false`

**`health-check [--repair]`**
- Validates `.planning/` structure: FUTURE.md exists/parseable, MILESTONES.md exists/parseable, config.json exists/parseable, milestone folders present for all referenced milestones, no orphaned milestone folders
- Returns `{ healthy: boolean, issues: [{type, message, path, fixable}] }`
- With `--repair`: auto-creates missing milestone folders, returns `{ ..., repaired: string[] }`

### Action A-32: Slash Commands

**`/declare:settings`**
- Interactive 4-question workflow using AskUserQuestion
- Reads current config before presenting each question (shows current value)
- Configures: model_profile (1/2/3 → quality/balanced/budget), workflow.research, workflow.plan_check, workflow.auto_advance
- Persists each changed setting via config-set
- Shows confirmation table at end

**`/declare:set-profile <profile>`**
- Accepts `quality`, `balanced`, or `budget` from `$ARGUMENTS`
- Shows model assignment table per profile
- Applies via config-set
- Displays before/after confirmation

**`/declare:health [--repair]`**
- Runs health-check tool, formats results by issue type (MISSING, PARSE ERROR, MISSING FOLDER, ORPHAN)
- Shows fixable/unfixable status per issue
- With --repair: shows repaired items and remaining issues
- Provides actionable next steps for unfixable issues

## Verification

```bash
node dist/declare-tools.cjs config-get workflow.research
# → {"key":"workflow.research","value":true}

node dist/declare-tools.cjs config-set --key workflow.auto_advance --value false
# → {"key":"workflow.auto_advance","value":false,"updated":true}

node dist/declare-tools.cjs health-check
# → {"healthy":true,"issues":[]}

node dist/declare-tools.cjs health-check --repair
# → {"healthy":true,"issues":[],"repaired":[]}
```

## Deviations from Plan

None - both actions executed exactly as specified.

## Self-Check: PASSED

All files verified present:
- FOUND: src/commands/config-get.js
- FOUND: src/commands/config-set.js
- FOUND: src/commands/health-check.js
- FOUND: commands/declare/settings.md
- FOUND: commands/declare/set-profile.md
- FOUND: commands/declare/health.md
- FOUND: .claude/commands/declare/settings.md
- FOUND: .claude/commands/declare/set-profile.md
- FOUND: .claude/commands/declare/health.md
- FOUND: dist/declare-tools.cjs

Commits verified:
- 71919f0: feat(M-16): add config-get, config-set, health-check CJS subcommands
- 9cd17aa: feat(M-16): add settings, set-profile, health slash commands
