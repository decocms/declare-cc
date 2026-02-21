---
name: declare:verify
description: Validate milestone deliverables through conversational UAT. When issues found, diagnoses root causes and creates fix plans.
argument-hint: "[milestone ID, e.g., 'M-08']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
---
<objective>
Validate milestone deliverables through conversational testing with persistent state.

Purpose: Confirm what was built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose root causes (spawn parallel declare-debugger agents) and create fix action plans.

Output: {milestone_id}-UAT.md in milestone folder tracking all test results. If issues found: diagnosed gaps with root causes, verified fix action plans ready for `/declare:execute M-{id} --gaps-only`.
</objective>

<execution_context>
@workflows/verify.md
</execution_context>

<context>
Milestone: $ARGUMENTS (optional)
- If provided: Test specific milestone (e.g., "M-08")
- If not provided: Check for active sessions or prompt for milestone ID

@.planning/STATE.md
</context>

<process>
Execute the verify workflow from @workflows/verify.md end-to-end.
Preserve all workflow gates: session management, test presentation, diagnosis, fix planning, routing.

**Loading milestone plans:**
```bash
# List PLAN.md files in milestone directory
MILESTONE_DIR=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
ls ".planning/milestones/${MILESTONE_DIR}/"*-PLAN.md 2>/dev/null
```

**Writing UAT results:**
```bash
node dist/declare-tools.cjs commit "test(${MILESTONE_ID}): complete UAT - ${PASSED} passed, ${ISSUES} issues" \
  --files ".planning/milestones/${MILESTONE_DIR}/${MILESTONE_ID}-UAT.md"
```

**On gaps found — spawn parallel declare-debugger agents (one per gap):**

For each gap in the UAT Gaps section, spawn a declare-debugger agent with:
- `model: "opus"`
- `symptoms_prefilled: true` (skip symptom gathering)
- `goal: find_root_cause_only` (diagnose but don't fix)
- Pre-filled symptoms from the gap's test_id, expected, and actual fields

Collect all ROOT CAUSE FOUND responses, update UAT.md with root_cause for each gap.

**After diagnosis — create fix action plans:**

Review diagnosed gaps and create fix action plans targeting each root cause.
Plans should be concrete, executable steps referencing specific files to change.
</process>
