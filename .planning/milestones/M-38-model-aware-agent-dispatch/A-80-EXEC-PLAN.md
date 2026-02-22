---
milestone: M-38-model-aware-agent-dispatch
action: A-80
type: execute
wave: 2
depends_on:
  - A-79
files_modified:
  - commands/declare/plan.md
  - commands/declare/execute.md
  - commands/declare/research.md
  - commands/declare/verify.md
  - commands/declare/debug.md
autonomous: true
declarations:
  - D-07

must_haves:
  truths:
    - "Every Task spawn in every orchestrator command specifies a model parameter matching the canonical mapping"
    - "plan.md spawns planner (opus), plan-checker (haiku), and discuss (opus) agents with explicit model"
    - "execute.md spawns executor (opus) agents with explicit model"
    - "research.md spawns researcher (sonnet) and synthesizer (sonnet) agents with explicit model"
    - "verify.md spawns debugger (opus) agents with explicit model"
    - "debug.md already uses a variable — updated to use canonical mapping value (opus) as the default/literal fallback"
  artifacts:
    - path: "commands/declare/plan.md"
      provides: "model parameter on all Task spawns"
      contains: "model"
    - path: "commands/declare/execute.md"
      provides: "model parameter on all Task spawns"
      contains: "model"
    - path: "commands/declare/research.md"
      provides: "model parameter on all Task spawns"
      contains: "model"
    - path: "commands/declare/verify.md"
      provides: "model parameter on all Task spawns"
      contains: "model"
  key_links:
    - from: ".planning/config.json modelAssignment"
      to: "commands/declare/*.md Task spawns"
      via: "hardcoded model strings derived from config mapping"
      pattern: "model.*opus|model.*sonnet|model.*haiku"
---

<objective>
Edit the orchestrator command files so every Task spawn explicitly passes the correct model string instead of inheriting the session default.

Purpose: Without explicit model parameters, all spawned agents inherit whatever model the parent session uses. This means a user on haiku gets opus-quality agents on haiku, or vice versa. Hardcoding the model per spawn (derived from the config.json mapping) ensures each role always runs on the model appropriate for its complexity and cost profile.

Output: Five orchestrator command files edited with model parameters on all Task spawn calls.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/config.json
@commands/declare/plan.md
@commands/declare/execute.md
@commands/declare/research.md
@commands/declare/verify.md
@commands/declare/debug.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model to Task spawns in plan.md and execute.md</name>
  <files>commands/declare/plan.md, commands/declare/execute.md</files>
  <action>
**Canonical mapping (from .planning/config.json modelAssignment):**
- planner → opus
- executor → opus
- checker → haiku
- status/graph ops → haiku

**plan.md** — three Task spawn sites to update:

1. **Discuss agent spawn** (Step 3, "Run /declare:discuss"): Add `model: "opus"` to the Task call. The spawned agent runs the discuss workflow which is planner-class reasoning.

2. **Declare-planner spawn** (Step 6, "Spawn declare-planner"): Add `model: "opus"` to the Task call. Current spawn uses `subagent_type: general-purpose` (or similar) — add `model: "opus"`.

3. **Plan-checker spawn** (Step 7 and Step 9 revision loop, "Spawn declare-plan-checker"): Add `model: "haiku"` to the Task call. The checker verifies EXEC-PLAN structure — a classification task suitable for haiku.

4. **Milestone executor spawns** (Step 11 / Step B auto-advance, "spawn one Task agent per milestone"): Add `model: "opus"` since these spawn executor agents.

For each site, locate the Task invocation block (prose or code block describing the Task tool call) and add a `model` field. The existing instruction format varies — some use bullet lists (`- subagent_type: ...`), some use pseudocode (`Task(...)`). Match the surrounding format. Example for bullet-list format:
```
- subagent_type: `general-purpose`
- model: `opus`
- description: ...
- prompt: ...
```

**execute.md** — one Task spawn site:

1. **Executor agent spawn** (Step 3c, "Spawn executor agents in parallel using the Task tool"): Add `model: "opus"` to the Task instruction block. Locate "For each action in the wave, spawn a Task with instructions like:" and add `model: "opus"` to the spawn description.

Do NOT change any other content. Do NOT alter the prompt templates, step logic, or any wording outside the Task spawn sections.
  </action>
  <verify>
Run: `grep -n "model" /Users/guilherme/Projects/declare-cc/commands/declare/plan.md`

Expected: At least 4 lines mentioning `model` corresponding to the 4 spawn sites updated.

Run: `grep -n "model" /Users/guilherme/Projects/declare-cc/commands/declare/execute.md`

Expected: At least 1 line mentioning `model` for the executor spawn.
  </verify>
  <done>plan.md has model specified on all Task spawns (planner=opus, checker=haiku, executor=opus). execute.md has model specified on executor spawns (opus). No other content changed.</done>
</task>

<task type="auto">
  <name>Task 2: Add model to Task spawns in research.md and verify.md</name>
  <files>commands/declare/research.md, commands/declare/verify.md</files>
  <action>
**Canonical mapping:**
- researcher → sonnet
- synthesizer → sonnet
- debugger → opus

**research.md** — two Task spawn sites:

1. **Researcher spawns** (Step 5, "Spawn 4 parallel declare-researcher agents"): Add `model: "sonnet"` to each of the 4 Task call descriptions. Each researcher agent (STACK, FEATURES, ARCHITECTURE, PITFALLS) gets `model: "sonnet"`.

2. **Synthesizer spawn** (Step 7, "Spawn declare-research-synthesizer"): Add `model: "sonnet"` to the Task call description.

**verify.md** — locate all Task spawn sites for debugger agents:

Read verify.md fully. Find every Task spawn (they spawn `declare-debugger` agents for gap diagnosis). Add `model: "opus"` to each debugger Task spawn.

For each file, locate the Task invocation descriptions and add the model field in the same format as surrounding text. If the spawn is described as a prose instruction ("Spawn a Task agent with..."), add a line: "- model: `opus`" or "- model: `sonnet`" matching the list format. If it is a code block pseudocode (`Task(prompt=..., subagent_type=...)`), add `model="opus"` or `model="sonnet"` as a named argument.

Do NOT change any prompt content, step logic, or other wording.
  </action>
  <verify>
Run: `grep -n "model" /Users/guilherme/Projects/declare-cc/commands/declare/research.md`

Expected: At least 5 lines (4 researcher spawns + 1 synthesizer spawn) mentioning `model`.

Run: `grep -n "model" /Users/guilherme/Projects/declare-cc/commands/declare/verify.md`

Expected: At least 1 line mentioning `model` for debugger spawns.
  </verify>
  <done>research.md has model="sonnet" on all 4 researcher spawns and the synthesizer spawn. verify.md has model="opus" on all debugger spawns. No other content changed.</done>
</task>

</tasks>

<verification>
- `grep -c "model" /Users/guilherme/Projects/declare-cc/commands/declare/plan.md` returns 4 or more
- `grep -c "model" /Users/guilherme/Projects/declare-cc/commands/declare/execute.md` returns 1 or more
- `grep -c "model" /Users/guilherme/Projects/declare-cc/commands/declare/research.md` returns 5 or more
- `grep "model" /Users/guilherme/Projects/declare-cc/commands/declare/plan.md | grep -E "opus|sonnet|haiku"` — all model lines reference a valid model string
- `grep "model" /Users/guilherme/Projects/declare-cc/commands/declare/research.md | grep -E "opus|sonnet|haiku"` — all model lines reference a valid model string
- `grep "subagent_type\|model" /Users/guilherme/Projects/declare-cc/commands/declare/debug.md` — debug.md retains its existing model variable pattern, unchanged
</verification>

<success_criteria>
All orchestrator command files (plan.md, execute.md, research.md, verify.md) have explicit model parameters on every Task spawn, matching the canonical mapping in config.json. The model strings are "opus", "sonnet", or "haiku". No other content in the files is modified.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-38-model-aware-agent-dispatch/A-80-SUMMARY.md`
</output>
