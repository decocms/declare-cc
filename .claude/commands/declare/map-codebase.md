---
name: declare:map-codebase
description: Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

<objective>
Analyze existing codebase using parallel declare-codebase-mapper agents to produce structured codebase documents.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
</objective>

<context>
Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized

**This command can run:**
- Before /declare:init (brownfield codebases) - creates codebase map first
- After /declare:init (greenfield codebases) - updates codebase map as code evolves
- Anytime to refresh codebase understanding
</context>

<when_to_use>
**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase map after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)
- When STATE.md references outdated codebase info

**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)
</when_to_use>

<process>

## Step 1: Check existing map

```bash
ls .planning/codebase/ 2>/dev/null
```

If `.planning/codebase/` already exists and contains documents, ask the user:
- **Refresh** — re-run all 4 agents and overwrite existing documents
- **Update** — re-run only specific focus areas (ask which ones)
- **Skip** — use existing map as-is and proceed

If directory doesn't exist or is empty, proceed directly to Step 2.

## Step 2: Create directory structure

```bash
mkdir -p .planning/codebase
```

## Step 3: Secret scan

Before spawning agents, verify no secrets are in scope:

```bash
# Check for .env files in working directory
ls .env* 2>/dev/null && echo "WARNING: .env files present - agents will note existence only, never read contents"
```

Remind yourself: agents must never read `.env`, credentials, keys, or any file listed in `<forbidden_files>` within the mapper agent definition.

## Step 4: Spawn 4 parallel mapper agents

Spawn all four agents simultaneously using the Task tool:

```
Agent 1: declare-codebase-mapper
  Focus: tech
  Task: Analyze technology stack and external integrations. Write STACK.md and INTEGRATIONS.md to .planning/codebase/

Agent 2: declare-codebase-mapper
  Focus: arch
  Task: Analyze architecture and file structure. Write ARCHITECTURE.md and STRUCTURE.md to .planning/codebase/

Agent 3: declare-codebase-mapper
  Focus: quality
  Task: Analyze coding conventions and testing patterns. Write CONVENTIONS.md and TESTING.md to .planning/codebase/

Agent 4: declare-codebase-mapper
  Focus: concerns
  Task: Identify technical debt and issues. Write CONCERNS.md to .planning/codebase/
```

Wait for all 4 agents to complete. Collect only their confirmation messages (NOT document contents).

## Step 5: Verify output

```bash
wc -l .planning/codebase/*.md 2>/dev/null
```

Confirm all 7 documents exist:
- `.planning/codebase/STACK.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

If any document is missing, re-spawn the relevant agent for that focus area.

## Step 6: Commit codebase map

```bash
git add .planning/codebase/
git commit -m "docs: add codebase map (.planning/codebase/)"
```

If git is not initialized, skip this step and note it.

## Step 7: Report and next steps

Report a summary of what was mapped:
- Documents created and their line counts
- Key findings surfaced (from agent confirmations only — do NOT read document contents)

Offer next steps based on context:
- If no .planning/STATE.md: suggest `/declare:init` to initialize project planning
- If .planning/STATE.md exists: suggest `/declare:plan-phase` to plan next work using the map
- If significant concerns were found: highlight that CONCERNS.md has issues worth reviewing before planning

</process>

<success_criteria>
- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written by mapper agents
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] Codebase map committed to git
- [ ] User knows next steps
</success_criteria>
