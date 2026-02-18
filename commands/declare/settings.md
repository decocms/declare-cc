---
description: Configure Declare workflow settings interactively
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

Interactive configuration of Declare workflow settings and model profile.

**Step 1: Read current config.**

```bash
node dist/declare-tools.cjs config-get model_profile
```

```bash
node dist/declare-tools.cjs config-get workflow.research
```

```bash
node dist/declare-tools.cjs config-get workflow.plan_check
```

```bash
node dist/declare-tools.cjs config-get workflow.auto_advance
```

Extract current values (use defaults if key not found: model_profile="quality", research=true, plan_check=true, auto_advance=false).

**Step 2: Ask the 5 configuration questions in sequence using AskUserQuestion.**

For each question, show the current value so the user knows what's selected now. Accept Enter to keep the current value.

**Question 1: Model profile**

```
Which model profile should Declare agents use?

  1. quality   — claude-opus-4-5 for all agents (highest quality, most spend)
  2. balanced  — claude-sonnet-4-5 for execution, opus-4-5 for planning (recommended)
  3. budget    — claude-haiku-3-5 for execution, sonnet-4-5 for planning (low spend)

Current: [current value]
Enter 1, 2, or 3 (or press Enter to keep current):
```

**Question 2: Research phase**

```
Enable research phase before milestone planning?
Research gives agents web context but takes extra time.

Current: [true/false]
Enter yes/no (or press Enter to keep current):
```

**Question 3: Plan check**

```
Enable plan-checker review loop after planning?
Plan-checker validates plans before execution starts.

Current: [true/false]
Enter yes/no (or press Enter to keep current):
```

**Question 4: Auto-advance**

```
Enable auto-advance mode?
In auto mode, checkpoints are skipped and agents continue without pausing for human verification.
Only enable if you trust the agents to proceed without review.

Current: [true/false]
Enter yes/no (or press Enter to keep current):
```

**Step 3: Parse answers and persist each changed setting.**

Map answers to values:
- Profile "1" → "quality", "2" → "balanced", "3" → "budget". Empty input → keep current.
- "yes"/"y" → true, "no"/"n" → false. Empty input → keep current.

For each setting that changed, run config-set:

```bash
node dist/declare-tools.cjs config-set --key model_profile --value <profile>
```

```bash
node dist/declare-tools.cjs config-set --key workflow.research --value <true|false>
```

```bash
node dist/declare-tools.cjs config-set --key workflow.plan_check --value <true|false>
```

```bash
node dist/declare-tools.cjs config-set --key workflow.auto_advance --value <true|false>
```

**Step 4: Display confirmation.**

Show a summary table of the final configuration:

```
Declare settings saved.

Model profile : [profile]
Research      : [enabled/disabled]
Plan check    : [enabled/disabled]
Auto-advance  : [enabled/disabled]

Quick commands:
  /declare:set-profile quality|balanced|budget   — switch profile
  /declare:health                                — check project health
  /declare:settings                              — open this menu
```
