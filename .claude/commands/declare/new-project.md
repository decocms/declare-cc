---
name: declare:new-project
description: Initialize a new project with deep context gathering, PROJECT.md, and STATE.md
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<context>
**Flags:**
- `--auto` — Automatic mode. After config questions, runs research without further interaction. Expects idea document via @ reference.
</context>

<objective>
Initialize a new project through a unified flow: questioning → research (optional) → PROJECT.md → STATE.md → config.

**Creates:**
- `.planning/PROJECT.md` — persistent project context document
- `.planning/STATE.md` — session memory and decision log
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional, 4 parallel agents)

**After this command:** Run `/declare:future` to declare the project's futures (desired outcomes), then `/declare:milestones` to plan how to achieve them.
</objective>

<process>

## 1. Setup

**MANDATORY FIRST STEP — Run before any user interaction:**

```bash
mkdir -p .planning
```

Check if project already exists:

```bash
[ -f ".planning/PROJECT.md" ] && echo "EXISTS" || echo "NEW"
```

**If PROJECT.md already exists:** Tell the user the project is already initialized, show the contents of `.planning/PROJECT.md`, and suggest running `/declare:status` to see current state. Exit.

Check git status:

```bash
git rev-parse --git-dir 2>/dev/null && echo "HAS_GIT" || echo "NO_GIT"
```

**If no git repo:** Initialize git:

```bash
git init
```

## 2. Auto Mode Detection

Check if `--auto` flag is present in $ARGUMENTS.

**If auto mode:**
- Skip deep questioning (extract context from provided document)
- An idea document must be present — either:
  - File reference: `/declare:new-project --auto @prd.md`
  - Pasted/written text in the prompt
- If no document content found, error:

```
Error: --auto requires an idea document.

Usage:
  /declare:new-project --auto @your-idea.md
  /declare:new-project --auto [paste or write your idea here]

The document should describe what you want to build.
```

Skip to Step 4 (auto mode skips deep questioning).

## 3. Deep Questioning

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Open the conversation:**

Ask inline (freeform, NOT AskUserQuestion):

"What do you want to build?"

Wait for their response. This gives you the context needed to ask intelligent follow-up questions.

**Follow the thread:**

Based on what they said, ask follow-up questions that dig into their response. Use AskUserQuestion with options that probe what they mentioned — interpretations, clarifications, concrete examples.

Keep following threads. Each answer opens new threads to explore. Ask about:
- What problem sparked this project
- What domain or industry it lives in
- Who uses it and what they achieve
- What's already decided (tech stack, integrations, constraints)
- What success looks like in 6 months
- What existing tools they've tried and why those fall short
- What they explicitly want to avoid building

**Surface the core value:**

Push toward articulating the ONE thing the project does better than anything else. The core value statement should be a single sentence that would make a potential user say "yes, that's exactly what I need."

**Decision gate:**

When you could write a clear PROJECT.md, use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're building. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Create PROJECT.md" selected.

## 4. Write PROJECT.md

**If auto mode:** Synthesize context from provided document. Proceed directly after writing.

Synthesize all context gathered into `.planning/PROJECT.md` using this format:

```markdown
# [Project Name]

## What This Is

[1-2 sentence description of what the project does and who it's for]

## Core Value

[The main value proposition — the ONE thing this does better than alternatives]

## Current State

[What's been built so far. For new projects: "Not yet started — planning phase."]

## Constraints

[Tech stack choices, compatibility requirements, things that must or cannot be used]

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| [First decision from questioning] | [Why] | [today] |

---
*Last updated: [date] after initialization*
```

Write the file:

```bash
# Use Write tool to create .planning/PROJECT.md
```

**Commit PROJECT.md:**

```bash
node dist/declare-tools.cjs commit "docs: initialize project context" --files .planning/PROJECT.md
```

## 5. Workflow Preferences

**If auto mode:** Use defaults — interactive mode, balanced model profile, research enabled, plan_check enabled. Skip to Step 5.5.

**Round 1 — Core settings:**

```
AskUserQuestion([
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "Interactive (Recommended)", description: "Confirm key decisions, stay in the loop" },
      { label: "Auto", description: "Execute without interruptions — trust the agents" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
])
```

**Round 2 — Workflow agents:**

```
AskUserQuestion([
  {
    header: "Research",
    question: "Research the domain before planning? (adds tokens/time, improves quality)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Discover patterns, gotchas, standard approaches" },
      { label: "No", description: "Plan directly from what we discussed" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" }
    ]
  }
])
```

Create `.planning/config.json`:

```json
{
  "mode": "interactive|auto",
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget",
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "auto_advance": false
  }
}
```

**If commit_docs = No:** Add `.planning/` to `.gitignore` (create if needed).

**Commit config.json:**

```bash
node dist/declare-tools.cjs commit "chore: add project config" --files .planning/config.json
```

## 5.5. Initialize STATE.md

Create `.planning/STATE.md` with the project initialized:

```markdown
# Project State

**Last Updated:** [today]
**Current Position:** Project initialized — ready for /declare:future

## Recent Work

Project initialized via /declare:new-project. PROJECT.md written with project context.

## Decisions Made

| Decision | Rationale | Date |
|----------|-----------|------|
| [Key decisions from questioning] | [Rationale] | [today] |

## Blockers

(none)

## Session History

| Date | Stopped At | Resume File |
|------|------------|-------------|
| [today] | Initialized project | /declare:future |
```

**Commit STATE.md:**

```bash
node dist/declare-tools.cjs commit "docs: initialize project state" --files .planning/STATE.md
```

## 6. Research Decision

**If workflow.research = false or auto mode with research disabled:** Skip to Step 7.

**If auto mode with research enabled:** Default to research. Skip the question.

**Interactive mode — ask:**

Use AskUserQuestion:
- header: "Research"
- question: "Run domain research now? (4 parallel agents, 2-5 minutes)"
- options:
  - "Research now (Recommended)" — Discover standard approaches, pitfalls, architecture patterns
  - "Skip research" — I know this domain well, proceed to next steps

**If research selected:**

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

Create research directory:
```bash
mkdir -p .planning/research
```

Spawn 4 parallel research agents:

```
Task(prompt="You are a domain researcher for the Declare project planning system.

<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<question>
What is the standard 2025-2026 stack for building [domain]? What libraries, frameworks, and tools are production-ready?
</question>

<project_context>
[PROJECT.md content — what they're building, constraints, core value]
</project_context>

<output_requirements>
Write your findings to .planning/research/STACK.md

Format:
# Stack Research: [Domain]

## Recommended Stack
[Library/framework with version, rationale, confidence level]

## What NOT to Use
[Alternatives to avoid and why]

## Key Tradeoffs
[Most important choices and their implications]

Quality bar: versions must be current (not from training data — verify with docs), rationale must explain WHY not just WHAT.
</output_requirements>
", subagent_type="general-purpose", description="Stack research for [domain]")

Task(prompt="You are a domain researcher for the Declare project planning system.

<research_type>
Project Research — Features dimension for [domain].
</research_type>

<question>
What features do [domain] products have? What is table stakes (users expect it) vs differentiating (competitive advantage)?
</question>

<project_context>
[PROJECT.md content]
</project_context>

<output_requirements>
Write your findings to .planning/research/FEATURES.md

Format:
# Features Research: [Domain]

## Table Stakes
[Features users expect — missing these causes abandonment]

## Differentiators
[Features that create competitive advantage]

## Anti-Features
[Things to deliberately NOT build — why they're traps]

## Complexity Notes
[Which features are deceptively hard, which look hard but aren't]
</output_requirements>
", subagent_type="general-purpose", description="Features research for [domain]")

Task(prompt="You are a domain researcher for the Declare project planning system.

<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<question>
How are [domain] systems typically structured? What are the major components, how do they interact, and what's the natural build order?
</question>

<project_context>
[PROJECT.md content]
</project_context>

<output_requirements>
Write your findings to .planning/research/ARCHITECTURE.md

Format:
# Architecture Research: [Domain]

## Component Map
[Major components and their boundaries]

## Data Flow
[How information moves through the system]

## Build Order
[Natural sequence for building — what depends on what]

## Common Patterns
[Established architectural patterns for this domain]
</output_requirements>
", subagent_type="general-purpose", description="Architecture research for [domain]")

Task(prompt="You are a domain researcher for the Declare project planning system.

<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<question>
What do [domain] projects commonly get wrong? What are the critical mistakes, hidden complexity traps, and decisions that seem right but cause problems later?
</question>

<project_context>
[PROJECT.md content]
</project_context>

<output_requirements>
Write your findings to .planning/research/PITFALLS.md

Format:
# Pitfalls Research: [Domain]

## Critical Mistakes
[Mistakes that cause project failure or major rework]

## Hidden Complexity
[Features that look simple but are actually hard]

## Prevention Strategies
[How to avoid each pitfall]

## Early Warning Signs
[How to detect you're heading toward a pitfall]
</output_requirements>
", subagent_type="general-purpose", description="Pitfalls research for [domain]")
```

Wait for all 4 agents to complete. Then display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► RESEARCH COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Research files: .planning/research/
  STACK.md       — technology choices
  FEATURES.md    — table stakes vs differentiators
  ARCHITECTURE.md — component structure
  PITFALLS.md    — what to watch out for
```

Commit research files:

```bash
node dist/declare-tools.cjs commit "docs: add domain research" --files .planning/research/STACK.md .planning/research/FEATURES.md .planning/research/ARCHITECTURE.md .planning/research/PITFALLS.md
```

## 7. Done

Record the session:

```bash
node dist/declare-tools.cjs record-session --stopped-at "Project initialized" --resume-file "/declare:future"
```

Present completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► PROJECT INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Project Name]**
[Core value — one sentence]

| Artifact      | Location                  |
|---------------|---------------------------|
| Project       | .planning/PROJECT.md      |
| State         | .planning/STATE.md        |
| Config        | .planning/config.json     |
| Research      | .planning/research/       |

───────────────────────────────────────────────────────

## Next Up

Declare the futures (desired outcomes) you want to achieve:

/declare:future

This creates the declaration graph that all milestones and actions will be traced back to.

Also available:
- /declare:status — see graph state
- /declare:help — full command reference

───────────────────────────────────────────────────────
```

</process>

<output>
- `.planning/PROJECT.md` — project context (committed)
- `.planning/STATE.md` — session memory initialized (committed)
- `.planning/config.json` — workflow preferences (committed)
- `.planning/research/STACK.md` — if research selected (committed)
- `.planning/research/FEATURES.md` — if research selected (committed)
- `.planning/research/ARCHITECTURE.md` — if research selected (committed)
- `.planning/research/PITFALLS.md` — if research selected (committed)
</output>

<success_criteria>
- [ ] .planning/ directory created
- [ ] Git repo initialized (if needed)
- [ ] Existing project detection: error shown if already initialized
- [ ] Deep questioning completed (threads followed, not rushed)
- [ ] PROJECT.md captures full context → committed
- [ ] config.json has mode, commit_docs, model_profile, workflow settings → committed
- [ ] STATE.md initialized with session record → committed
- [ ] Research completed if selected (4 parallel agents spawned) → committed
- [ ] User knows next step is /declare:future
- [ ] record-session called at completion
</success_criteria>
