---
description: Switch model profile for Declare agents (quality/balanced/budget)
argument-hint: <profile>
allowed-tools:
  - Read
  - Bash
---

Switch the model profile used by Declare agents. Controls which Claude model each agent uses, balancing output quality vs token spend.

**Step 1: Validate the profile argument.**

Parse `$ARGUMENTS` to extract the profile name. It must be one of: `quality`, `balanced`, `budget`.

If the argument is missing or invalid, display the usage error and the profile table below, then stop.

```
Usage: /declare:set-profile <profile>

Profiles:
  quality   — claude-opus-4-5 for all agents
  balanced  — claude-sonnet-4-5 for execution, claude-opus-4-5 for planning
  budget    — claude-haiku-3-5 for execution, claude-sonnet-4-5 for planning
```

**Step 2: Read current profile.**

```bash
node dist/declare-tools.cjs config-get model_profile
```

Extract the current value (default "quality" if key not found).

**Step 3: Apply the new profile.**

```bash
node dist/declare-tools.cjs config-set --key model_profile --value <profile>
```

If the command fails, display the error and stop.

**Step 4: Display confirmation.**

Show a confirmation with the model table:

```
Profile switched: [old] → [new]

Model assignments for "[new]" profile:

  Agent         Model
  ───────────────────────────────────────────────
  Planner       [planner model]
  Plan-checker  [plan-checker model]
  Executor      [executor model]
  Verifier      [verifier model]
  Researcher    [researcher model]

Use /declare:settings to configure additional workflow options.
```

Model assignments by profile:

- **quality**: all agents use `claude-opus-4-5`
- **balanced**: planner=`claude-opus-4-5`, plan-checker=`claude-opus-4-5`, executor=`claude-sonnet-4-5`, verifier=`claude-sonnet-4-5`, researcher=`claude-opus-4-5`
- **budget**: planner=`claude-sonnet-4-5`, plan-checker=`claude-sonnet-4-5`, executor=`claude-haiku-3-5`, verifier=`claude-haiku-3-5`, researcher=`claude-sonnet-4-5`
