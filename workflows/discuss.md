<purpose>
Extract implementation decisions that downstream agents need. Analyze the milestone to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **declare-researcher** — Reads CONTEXT.md to know WHAT to research
   - "User wants card-based layout" → researcher investigates card component patterns
   - "Streaming output decided" → researcher looks into streaming API patterns

2. **declare-planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - "CLI output format is JSON" → planner includes that in task specs
   - "Claude's Discretion: error handling style" → planner can decide approach

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = builder.**

The user knows:
- How they imagine it working
- What it should look/feel like
- What's essential vs nice-to-have
- Specific behaviors or references they have in mind

The user doesn't know (and shouldn't be asked):
- Codebase patterns (researcher reads the code)
- Technical risks (researcher identifies these)
- Implementation approach (planner figures this out)
- Success metrics (inferred from the work)

Ask about vision and implementation choices. Capture decisions for downstream agents.
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The milestone boundary comes from MILESTONES.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):**
- "How should the discuss flow present gray areas?" (presentation, format, density)
- "What happens if a milestone already has context?" (behavior choice)
- "Interactive or auto mode?" (invocation pattern)

**Not allowed (scope creep):**
- "Should we also add a research step here?" (new capability)
- "What about integrating with the planner directly?" (new capability)
- "Maybe include visualization?" (new capability)

**The heuristic:** Does this clarify how we implement what's already in the milestone, or does it add a new capability that could be its own milestone?

**When user suggests scope creep:**
```
"[Feature X] would be a new capability — that's its own milestone.
Want me to note it for the backlog?

For now, let's focus on [milestone domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<gray_area_identification>
Gray areas are **implementation decisions the user cares about** — things that could go multiple ways and would change the result.

**How to identify gray areas:**

1. **Read the milestone goal** from MILESTONES.md
2. **Understand the domain** — What kind of thing is being built?
   - Something users SEE → visual presentation, interactions, states matter
   - Something users CALL → interface contracts, responses, errors matter
   - Something users RUN → invocation, output, behavior modes matter
   - Something users READ → structure, tone, depth, flow matter
   - Something being ORGANIZED → criteria, grouping, handling exceptions matter
3. **Generate milestone-specific gray areas** — Not generic categories, but concrete decisions for THIS milestone

**Don't use generic category labels** (UI, UX, Behavior). Generate specific gray areas:

```
Milestone: "Context capture per milestone"
→ Discussion flow, Gray area presentation, CONTEXT.md structure, Existing context handling

Milestone: "Milestone research pipeline"
→ Research depth, Source selection, Output format, Staleness policy

Milestone: "CLI for database backups"
→ Output format, Flag design, Progress reporting, Error recovery

Milestone: "API documentation"
→ Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**The key question:** What decisions would change the outcome that the user should weigh in on?

**Claude handles these (don't ask):**
- Technical implementation details
- Architecture patterns
- Performance optimization
- Scope (MILESTONES.md defines this)
</gray_area_identification>

<process>

<step name="initialize" priority="first">
Milestone ID from argument (required).

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON. Extract milestone data for the given ID.

**If graph has an `error` field:**
```
Project not initialized. Run /declare:init first.
```
Exit workflow.

**If milestone ID not found in graph:**
```
Milestone [M-XX] not found.

Use /declare:status to see available milestones.
```
Exit workflow.

**If milestone found:** Continue to check_existing.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists in the milestone directory.

```bash
ls .planning/milestones/[M-XX]-[slug]/CONTEXT.md 2>/dev/null
```

**If exists:**
Use AskUserQuestion:
- header: "Context"
- question: "Milestone [M-XX] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to analyze_milestone
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**

Check if action exec plans already exist for this milestone. **If plans exist:**

Use AskUserQuestion:
- header: "Plans exist"
- question: "Milestone [M-XX] already has action plans created without user context. Your decisions here won't affect existing plans unless you re-derive them."
- options:
  - "Continue anyway" — Capture context, re-derive actions afterward if needed
  - "View existing plans" — Show plans before deciding
  - "Cancel" — Skip discuss

If "Continue anyway": Continue to analyze_milestone.
If "View existing plans": Display plan files, then offer "Continue" / "Cancel".
If "Cancel": Exit workflow.

**If no plans exist:** Continue to analyze_milestone.
</step>

<step name="analyze_milestone">
Analyze the milestone to identify gray areas worth discussing.

**Read the milestone description from MILESTONES.md and FUTURE.md to understand context, then determine:**

1. **Domain boundary** — What capability is this milestone delivering? State it clearly.

2. **Gray areas** — For each relevant dimension, identify 1-2 specific ambiguities that would change implementation.

3. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation), the milestone may not need discussion.

**Output your analysis internally, then present to user.**

Example analysis for "Context capture per milestone":
```
Domain: Interactive discussion flow that captures user decisions into CONTEXT.md
Gray areas:
- Discussion flow: How gray areas are identified and presented
- Existing context: What to do when CONTEXT.md already exists
- Output structure: How decisions are organized in CONTEXT.md
- Auto-advance: Whether to chain into planning automatically
```
</step>

<step name="present_gray_areas">
Present the domain boundary and gray areas to user.

**First, state the boundary:**
```
Milestone [M-XX]: [Name]
Domain: [What this milestone delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other milestones.)
```

**Then use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [milestone name]?"
- options: Generate 3-4 milestone-specific gray areas, each formatted as:
  - "[Specific area]" (label) — concrete, not generic
  - [1-2 questions this covers] (description)

**Do NOT include a "skip" or "you decide" option.** User ran this command to discuss — give them real choices.

**Examples by domain:**

For "Context capture per milestone" (interactive flow):
```
Discussion flow — How many gray areas to present? In what order?
Existing context handling — Update, view, or skip if CONTEXT.md exists?
Output structure — How should decisions be organized in CONTEXT.md?
Auto-advance — Chain into planning after context is captured?
```

For "Milestone research pipeline" (background process):
```
Research depth — Shallow scan or deep investigation per topic?
Output format — Structured markdown, JSON, or free-form notes?
Staleness policy — When should research be refreshed?
Source selection — Code-only, web, or both?
```

For "CLI tooling" (command-line tool):
```
Output format — JSON, table, or plain text? Verbosity levels?
Flag design — Short flags, long flags, or both? Required vs optional?
Progress reporting — Silent, progress bar, or verbose logging?
Error recovery — Fail fast, retry, or prompt for action?
```

Continue to discuss_areas with selected areas.
</step>

<step name="discuss_areas">
For each selected area, conduct a focused discussion loop.

**Philosophy: 4 questions, then check.**

Ask 4 questions per area before offering to continue or move on. Each answer often reveals the next question.

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about [Area].
   ```

2. **Ask 4 questions using AskUserQuestion:**
   - header: "[Area]" (max 12 chars — abbreviate if needed)
   - question: Specific decision for this area
   - options: 2-3 concrete choices (AskUserQuestion adds "Other" automatically)
   - Include "You decide" as an option when reasonable — captures Claude discretion

3. **After 4 questions, check:**
   - header: "[Area]" (max 12 chars)
   - question: "More questions about [area], or move to next?"
   - options: "More questions" / "Next area"

   If "More questions" → ask 4 more, then check again
   If "Next area" → proceed to next selected area
   If "Other" (free text) → interpret intent: continuation phrases ("chat more", "keep going", "yes", "more") map to "More questions"; advancement phrases ("done", "move on", "next", "skip") map to "Next area". If ambiguous, ask: "Continue with more questions about [area], or move to the next area?"

4. **After all areas complete:**
   - header: "Done"
   - question: "That covers [list areas]. Ready to create context?"
   - options: "Create context" / "Revisit an area"

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question
- If user picks "Other", receive their input, reflect it back, confirm

**Scope creep handling:**
If user mentions something outside the milestone domain:
```
"[Feature] sounds like a new capability — that belongs in its own milestone.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Find or create milestone directory:**

Milestone directories live at: `.planning/milestones/[M-XX]-[slug]/`

If the directory doesn't exist:
```bash
mkdir -p ".planning/milestones/[M-XX]-[slug]"
```

**File location:** `.planning/milestones/[M-XX]-[slug]/CONTEXT.md`

**Structure the content by what was discussed:**

```markdown
# Milestone [M-XX]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Milestone Boundary

[Clear statement of what this milestone delivers — the scope anchor]

</domain>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- [Decision or preference captured]
- [Another decision if applicable]

### [Category 2 that was discussed]
- [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

</decisions>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other milestones. Don't lose them.]

[If none: "None — discussion stayed within milestone scope"]

</deferred>

---

*Milestone: [M-XX]-[slug]*
*Context gathered: [date]*
```

Write file.
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/milestones/[M-XX]-[slug]/CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future milestone

---

## Next Up

**Milestone [M-XX]: [Name]** — [Goal from MILESTONES.md]

`/declare:execute M-XX`

---

**Also available:**
- Review/edit CONTEXT.md before continuing
- `/declare:status` — see full milestone graph

---
```
</step>

<step name="git_commit">
Commit the milestone context:

```bash
node dist/declare-tools.cjs commit "docs(M-XX): capture milestone context" --files ".planning/milestones/[M-XX]-[slug]/CONTEXT.md"
```

Confirm: "Committed: docs(M-XX): capture milestone context"
</step>

<step name="auto_advance">
Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. Read `workflow.auto_advance` from config:
   ```bash
   node dist/declare-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "false"
   ```

**If `--auto` flag present AND config not already true:** Persist to config:
```bash
node dist/declare-tools.cjs config-set workflow.auto_advance true
```

**If `--auto` flag present OR config is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► AUTO-ADVANCING TO PLANNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Proceeding to milestone execution...
```

Spawn execution as Task:
```
Task(
  prompt="Run /declare:execute [M-XX] --auto",
  subagent_type="general-purpose",
  description="Execute Milestone [M-XX]"
)
```

**Handle execution return:**
- **COMPLETE** → Done
- **CHECKPOINT / needs input** → Display result, stop chain:
  ```
  Auto-advance stopped: Execution needs input.

  Review the output above and continue manually:
  /declare:execute [M-XX]
  ```

**If neither `--auto` nor config enabled:**
Route to `confirm_creation` step (show manual next steps).
</step>

</process>

<success_criteria>
- Milestone validated against graph
- Gray areas identified through intelligent analysis (not generic questions)
- User selected which areas to discuss
- Each selected area explored until user satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- Deferred ideas preserved for future milestones
- User knows next steps
</success_criteria>
