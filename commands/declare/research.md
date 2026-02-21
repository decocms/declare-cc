---
description: Research how to implement a milestone (spawns 4 parallel researchers, then synthesizes)
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
argument-hint: "[M-XX]"
---

Research how to implement a milestone by spawning 4 parallel researcher agents (stack, features, architecture, pitfalls) then synthesizing their findings into a unified RESEARCH.md.

**Step 1: Load graph and validate milestone.**

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. If it contains an `error` field, tell the user to run `/declare:init` first and stop.

If `$ARGUMENTS` contains a milestone ID (e.g., `M-02`), use it directly. Otherwise, list all pending milestones and ask the user to specify one.

Extract from the graph the milestone's `title`, `goal`, and which declaration IDs it `realizes` (e.g., `D-01`). If the milestone is not found, tell the user and stop.

Note the milestone slug by converting the milestone title to lowercase with hyphens (e.g., "Milestone research pipeline" → "milestone-research-pipeline"). The milestone folder path is `.planning/milestones/M-XX-slug/`.

**Step 2: Check for existing research.**

```bash
ls .planning/milestones/M-XX-slug/RESEARCH.md 2>/dev/null
```

If RESEARCH.md already exists:
- Display: "RESEARCH.md already exists for M-XX. Options: 1) Re-research (overwrite), 2) View existing, 3) Cancel"
- Wait for user choice before continuing.

If it does not exist, continue.

**Step 3: Check for existing CONTEXT.md.**

```bash
ls .planning/milestones/M-XX-slug/CONTEXT.md 2>/dev/null
```

If CONTEXT.md exists, it contains user decisions that constrain research. Load it and pass it to all researcher agents.

**Step 4: Display research banner.**

```
## Researching: M-XX — [milestoneTitle]

**Declares:** [declaration IDs and statements]
**Goal:** [milestone goal or title]
**Mode:** Parallel research (4 agents → synthesizer)

Spawning 4 researchers: STACK, FEATURES, ARCHITECTURE, PITFALLS...
```

**Step 5: Spawn 4 parallel declare-researcher agents.**

Spawn all 4 Task agents in the same response so they run in parallel. Each agent researches a specific domain.

For each researcher, the prompt follows this pattern (fill in milestone-specific context). Each researcher Task is spawned with `model: "sonnet"`.

**STACK researcher** (model: `sonnet`):

```
First, read agents/declare-researcher.md for your role and instructions.

<research_domain>STACK</research_domain>

<objective>
Research the standard technology stack for implementing milestone M-XX: [milestoneTitle]

Investigate: What libraries, frameworks, and tools form the standard stack for this domain? What versions are current? What are the "blessed" combinations experts use?
</objective>

<milestone_context>
Milestone: M-XX — [milestoneTitle]
Goal: [milestoneGoal]
Realizes: [declarationIds and statements]
[contextMdContent if exists]
</milestone_context>

<output>
Write your findings to: .planning/milestones/M-XX-slug/STACK.md
Use the RESEARCH.md structure from your instructions but title it "STACK Research".
Do NOT commit — the synthesizer will commit everything together.
</output>
```

**FEATURES researcher** (model: `sonnet`):

```
First, read agents/declare-researcher.md for your role and instructions.

<research_domain>FEATURES</research_domain>

<objective>
Research the features and capabilities required to implement milestone M-XX: [milestoneTitle]

Investigate: What capabilities are table stakes (must-have)? What are differentiators? What should be deferred to later milestones? What do users/implementers actually need?
</objective>

<milestone_context>
Milestone: M-XX — [milestoneTitle]
Goal: [milestoneGoal]
Realizes: [declarationIds and statements]
[contextMdContent if exists]
</milestone_context>

<output>
Write your findings to: .planning/milestones/M-XX-slug/FEATURES.md
Use the RESEARCH.md structure from your instructions but title it "FEATURES Research".
Do NOT commit — the synthesizer will commit everything together.
</output>
```

**ARCHITECTURE researcher** (model: `sonnet`):

```
First, read agents/declare-researcher.md for your role and instructions.

<research_domain>ARCHITECTURE</research_domain>

<objective>
Research the architecture patterns for implementing milestone M-XX: [milestoneTitle]

Investigate: What are the standard component structures? What data flows are typical? What design patterns do experts use? What project organization works best?
</objective>

<milestone_context>
Milestone: M-XX — [milestoneTitle]
Goal: [milestoneGoal]
Realizes: [declarationIds and statements]
[contextMdContent if exists]
</milestone_context>

<output>
Write your findings to: .planning/milestones/M-XX-slug/ARCHITECTURE.md
Use the RESEARCH.md structure from your instructions but title it "ARCHITECTURE Research".
Do NOT commit — the synthesizer will commit everything together.
</output>
```

**PITFALLS researcher** (model: `sonnet`):

```
First, read agents/declare-researcher.md for your role and instructions.

<research_domain>PITFALLS</research_domain>

<objective>
Research common pitfalls and failure modes when implementing milestone M-XX: [milestoneTitle]

Investigate: What do beginners get wrong? What causes rewrites? What performance, security, or correctness traps exist? What should never be hand-rolled?
</objective>

<milestone_context>
Milestone: M-XX — [milestoneTitle]
Goal: [milestoneGoal]
Realizes: [declarationIds and statements]
[contextMdContent if exists]
</milestone_context>

<output>
Write your findings to: .planning/milestones/M-XX-slug/PITFALLS.md
Use the RESEARCH.md structure from your instructions but title it "PITFALLS Research".
Do NOT commit — the synthesizer will commit everything together.
</output>
```

Use one Task tool call per researcher. Spawn all 4 in the same response.

**Step 6: After all 4 researchers complete, display interim summary.**

```
### Research Phase Complete

| Domain | Status | Key Finding |
|--------|--------|-------------|
| STACK | Done | [brief summary from agent return] |
| FEATURES | Done | [brief summary from agent return] |
| ARCHITECTURE | Done | [brief summary from agent return] |
| PITFALLS | Done | [brief summary from agent return] |

Spawning synthesizer...
```

If any researcher returned `## RESEARCH BLOCKED`, surface the blocker to the user before spawning the synthesizer. Ask whether to continue with partial research or abort.

**Step 7: Spawn declare-research-synthesizer** (model: `sonnet`).

```
First, read agents/declare-research-synthesizer.md for your role and instructions.

<objective>
Synthesize the 4 research files for milestone M-XX: [milestoneTitle] into a unified RESEARCH.md.
</objective>

<milestone_context>
Milestone: M-XX — [milestoneTitle]
Goal: [milestoneGoal]
Realizes: [declarationIds and statements]
Milestone folder: .planning/milestones/M-XX-slug/
</milestone_context>

<research_files>
- .planning/milestones/M-XX-slug/STACK.md
- .planning/milestones/M-XX-slug/FEATURES.md
- .planning/milestones/M-XX-slug/ARCHITECTURE.md
- .planning/milestones/M-XX-slug/PITFALLS.md
</research_files>

<output>
Write synthesized output to: .planning/milestones/M-XX-slug/RESEARCH.md
Commit all research files (the 4 domain files + RESEARCH.md) together:
  node dist/declare-tools.cjs commit "docs(M-XX): complete milestone research" --files .planning/milestones/M-XX-slug/
</output>
```

Use one Task tool call for the synthesizer.

**Step 8: Present results.**

After the synthesizer returns `## SYNTHESIS COMPLETE`:

```
## Research Complete: M-XX — [milestoneTitle]

**Files created:**
- .planning/milestones/M-XX-slug/STACK.md
- .planning/milestones/M-XX-slug/FEATURES.md
- .planning/milestones/M-XX-slug/ARCHITECTURE.md
- .planning/milestones/M-XX-slug/PITFALLS.md
- .planning/milestones/M-XX-slug/RESEARCH.md

**Overall confidence:** [from synthesizer]

### Key Findings
[3-5 bullets from synthesizer executive summary]

### Planning Implications
[Suggested action groups from synthesizer]

**Next step:** Run `/declare:actions M-XX` to derive action plans informed by this research.
```

**Error handling:**

- If `load-graph` returns an error: stop and ask user to run `/declare:init`.
- If the milestone folder does not exist: run `mkdir -p .planning/milestones/M-XX-slug/` before spawning researchers.
- If a researcher agent fails: log the failure, continue with the other 3 researchers, then inform the synthesizer about the missing file.
- If synthesis is blocked: display the synthesizer's `## SYNTHESIS BLOCKED` message and ask the user how to proceed.
- If RESEARCH.md already exists and user chose to re-research: the synthesizer will overwrite it.

**Key patterns:**

- 4 parallel researchers run concurrently for speed (stack, features, architecture, pitfalls).
- Researchers write domain files but do NOT commit.
- Synthesizer reads all 4 files, writes RESEARCH.md, and commits everything in one shot.
- Research informs `/declare:actions` planning — always suggest it as next step.
- CONTEXT.md (from `/declare:discuss`) constrains research when present.
- Milestone folder path follows `.planning/milestones/M-XX-slug/` convention.
- Use repo-relative paths in all file references and agent prompts.
