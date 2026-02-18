<purpose>
Validate built features through conversational testing with persistent state. Creates UAT.md that tracks test progress, survives /clear, and feeds gaps into /declare:verify --gaps.

User tests, Claude records. One test at a time. Plain text responses.
</purpose>

<philosophy>
**Show expected, ask if reality matches.**

Claude presents what SHOULD happen. User confirms or describes what's different.
- "yes" / "y" / "next" / empty → pass
- Anything else → logged as issue, severity inferred

No Pass/Fail buttons. No severity questions. Just: "Here's what should happen. Does it?"
</philosophy>

<template>
@workflows/uat-template.md
</template>

<process>

<step name="initialize" priority="first">
If $ARGUMENTS contains a milestone identifier (e.g., M-08), load context:

```bash
INIT=$(node dist/declare-tools.cjs execute --milestone "${MILESTONE_ARG}" 2>/dev/null || echo "{}")
```

Parse JSON for: `planner_model`, `checker_model`, `commit_docs`, `milestone_found`, `milestone_dir`, `milestone_id`, `milestone_name`, `has_verification`.
</step>

<step name="check_active_session">
**First: Check for active UAT sessions**

```bash
find .planning/milestones -name "*-UAT.md" -type f 2>/dev/null | head -5
```

**If active sessions exist AND no $ARGUMENTS provided:**

Read each file's frontmatter (status, milestone) and Current Test section.

Display inline:

```
## Active UAT Sessions

| # | Milestone | Status | Current Test | Progress |
|---|-----------|--------|--------------|----------|
| 1 | M-04-comments | testing | 3. Reply to Comment | 2/6 |
| 2 | M-05-auth | testing | 1. Login Form | 0/4 |

Reply with a number to resume, or provide a milestone ID to start new.
```

Wait for user response.

- If user replies with number (1, 2) → Load that file, go to `resume_from_file`
- If user replies with milestone ID → Treat as new session, go to `create_uat_file`

**If active sessions exist AND $ARGUMENTS provided:**

Check if session exists for that milestone. If yes, offer to resume or restart.
If no, continue to `create_uat_file`.

**If no active sessions AND no $ARGUMENTS:**

```
No active UAT sessions.

Provide a milestone ID to start testing (e.g., /declare:verify M-08)
```

**If no active sessions AND $ARGUMENTS provided:**

Continue to `create_uat_file`.
</step>

<step name="find_plans">
**Find what to test:**

Locate the milestone directory under `.planning/milestones/`.

```bash
ls ".planning/milestones/${MILESTONE_DIR}/"*-PLAN.md 2>/dev/null
```

Read each PLAN.md to extract testable deliverables from the `produces` fields and task descriptions.
</step>

<step name="extract_tests">
**Extract testable deliverables from milestone PLAN.md files:**

Parse each PLAN.md for:
1. **`produces` fields** — Explicit outputs listed per action/task
2. **User-facing changes** — UI, workflows, interactions described in task objectives

Focus on USER-OBSERVABLE outcomes, not implementation details.

For each deliverable, create a test:
- name: Brief test name
- expected: What the user should see/experience (specific, observable)

Examples:
- Produces: "agents/declare-debugger.md — working debug agent"
  → Test: "Declare Debugger Agent Exists"
  → Expected: "File agents/declare-debugger.md exists with proper YAML frontmatter (name, description, tools, color) and contains all core sections: philosophy, hypothesis_testing, investigation_techniques, debug_file_protocol, execution_flow."

- Produces: "commands/declare/verify.md — /declare:verify command"
  → Test: "Verify Command Available"
  → Expected: "File commands/declare/verify.md exists, references @workflows/verify.md, and accepts M-XX as argument."

Skip internal/non-observable items (refactors, config tweaks, etc.).
</step>

<step name="create_uat_file">
**Create UAT file with all tests:**

```bash
mkdir -p ".planning/milestones/${MILESTONE_DIR}"
```

Build test list from extracted deliverables.

Create file at `.planning/milestones/{milestone_dir}/{milestone_id}-UAT.md`:

```markdown
---
status: testing
milestone: {milestone_id}-{milestone_name}
source: [list of PLAN.md files read]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: [first test name]
expected: |
  [what user should observe]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [observable behavior]
result: [pending]

### 2. [Test Name]
expected: [observable behavior]
result: [pending]

...

## Summary

total: [N]
passed: 0
issues: 0
pending: [N]
skipped: 0

## Gaps

[none yet]
```

Proceed to `present_test`.
</step>

<step name="present_test">
**Present current test to user:**

Read Current Test section from UAT file.

Display using checkpoint box format:

```
╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Test {number}: {name}**

{expected}

──────────────────────────────────────────────────────────────
→ Type "pass" or describe what's wrong
──────────────────────────────────────────────────────────────
```

Wait for user response (plain text, no AskUserQuestion).
</step>

<step name="process_response">
**Process user response and update file:**

**If response indicates pass:**
- Empty response, "yes", "y", "ok", "pass", "next", "approved", "✓"

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: pass
```

**If response indicates skip:**
- "skip", "can't test", "n/a"

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: skipped
reason: [user's reason if provided]
```

**If response is anything else:**
- Treat as issue description

Infer severity from description:
- Contains: crash, error, exception, fails, broken, unusable → blocker
- Contains: doesn't work, wrong, missing, can't → major
- Contains: slow, weird, off, minor, small → minor
- Contains: color, font, spacing, alignment, visual → cosmetic
- Default if unclear: major

Update Tests section:
```
### {N}. {name}
expected: {expected}
result: issue
reported: "{verbatim user response}"
severity: {inferred}
```

Append to Gaps section (structured YAML for diagnosis):
```yaml
- test_id: {N}
  description: "{test name}"
  expected: "{expected behavior from test}"
  actual: "{verbatim user response}"
  severity: {inferred}
  root_cause: ""  # Filled by declare-debugger diagnosis
  status: failed
  artifacts: []   # Filled by diagnosis
  missing: []     # Filled by diagnosis
```

**After any response:**

Update Summary counts.
Update frontmatter.updated timestamp.

If more tests remain → Update Current Test, go to `present_test`
If no more tests → Go to `complete_session`
</step>

<step name="resume_from_file">
**Resume testing from UAT file:**

Read the full UAT file.

Find first test with `result: [pending]`.

Announce:
```
Resuming: Milestone {milestone_id} UAT
Progress: {passed + issues + skipped}/{total}
Issues found so far: {issues count}

Continuing from Test {N}...
```

Update Current Test section with the pending test.
Proceed to `present_test`.
</step>

<step name="complete_session">
**Complete testing and commit:**

Update frontmatter:
- status: complete
- updated: [now]

Clear Current Test section:
```
## Current Test

[testing complete]
```

Commit the UAT file:
```bash
node dist/declare-tools.cjs commit "test({milestone_id}): complete UAT - {passed} passed, {issues} issues" --files ".planning/milestones/{milestone_dir}/{milestone_id}-UAT.md"
```

Present summary:
```
## UAT Complete: Milestone {milestone_id}

| Result | Count |
|--------|-------|
| Passed | {N}   |
| Issues | {N}   |
| Skipped| {N}   |

[If issues > 0:]
### Issues Found

[List from Issues section]
```

**If issues > 0:** Proceed to `diagnose_issues`

**If issues == 0:**
```
All tests passed. Ready to continue.

- `/declare:milestones` — View milestone status
- `/declare:execute M-{next}` — Execute next milestone
```
</step>

<step name="diagnose_issues">
**Diagnose root causes before planning fixes:**

```
---

{N} issues found. Diagnosing root causes...

Spawning parallel debug agents to investigate each issue.
```

For each gap in the UAT file:
1. Spawn a `declare-debugger` agent in `goal: find_root_cause_only` mode
2. Pass gap details as pre-filled symptoms (`symptoms_prefilled: true`)
3. Collect root causes from each agent's ROOT CAUSE FOUND response
4. Update UAT.md Gaps section with `root_cause` for each gap

All agents run in parallel — diagnosis overhead is minimal.

After all diagnoses complete, update UAT file with root causes, then proceed to `plan_gap_closure`.
</step>

<step name="plan_gap_closure">
**Auto-plan fixes from diagnosed gaps:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► PLANNING FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner for gap closure...
```

Spawn declare-planner in gap_closure mode with:
- The diagnosed UAT file
- Current STATE.md
- Current milestone PLAN.md files as context

On return:
- **PLANNING COMPLETE:** Proceed to `verify_gap_plans`
- **PLANNING INCONCLUSIVE:** Report and offer manual intervention
</step>

<step name="verify_gap_plans">
**Verify fix plans:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► VERIFYING FIX PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Reviewing fix plans...
```

Initialize: `iteration_count = 1`

Review gap closure plans for completeness and correctness:
- Each diagnosed gap has a corresponding fix plan
- Fix plans address the root cause, not just symptoms
- No missing steps or broken dependencies

On review:
- **PLANS VALID:** Proceed to `present_ready`
- **ISSUES FOUND:** Return to plan_gap_closure with feedback (max 3 iterations)

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain.`

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit, user runs `/declare:verify M-{milestone}` manually)

Wait for user response.
</step>

<step name="present_ready">
**Present completion and next steps:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DECLARE ► FIXES READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone {milestone_id}: {milestone_name}** — {N} gap(s) diagnosed, {M} fix plan(s) created

| Gap | Root Cause | Fix Plan |
|-----|------------|----------|
| {description 1} | {root_cause} | {action_id} |
| {description 2} | {root_cause} | {action_id} |

Plans verified and ready for execution.

───────────────────────────────────────────────────────────────

## Next Up

**Execute fixes** — run fix plans

`/clear` then `/declare:execute M-{milestone_id} --gaps-only`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<update_rules>
**Batched writes for efficiency:**

Keep results in memory. Write to file only when:
1. **Issue found** — Preserve the problem immediately
2. **Session complete** — Final write before commit
3. **Checkpoint** — Every 5 passed tests (safety net)

| Section | Rule | When Written |
|---------|------|--------------|
| Frontmatter.status | OVERWRITE | Start, complete |
| Frontmatter.updated | OVERWRITE | On any file write |
| Current Test | OVERWRITE | On any file write |
| Tests.{N}.result | OVERWRITE | On any file write |
| Summary | OVERWRITE | On any file write |
| Gaps | APPEND | When issue found |

On context reset: File shows last checkpoint. Resume from there.
</update_rules>

<severity_inference>
**Infer severity from user's natural language:**

| User says | Infer |
|-----------|-------|
| "crashes", "error", "exception", "fails completely" | blocker |
| "doesn't work", "nothing happens", "wrong behavior" | major |
| "works but...", "slow", "weird", "minor issue" | minor |
| "color", "spacing", "alignment", "looks off" | cosmetic |

Default to **major** if unclear. User can correct if needed.

**Never ask "how severe is this?"** - just infer and move on.
</severity_inference>

<gap_format>
**Gap YAML written to UAT.md on each issue found:**

```yaml
- test_id: {N}
  description: "{test name}"
  expected: "{expected behavior from test}"
  actual: "{verbatim user response}"
  severity: {blocker|major|minor|cosmetic}
  root_cause: ""    # Populated by declare-debugger
  status: failed
  artifacts: []     # Populated by declare-debugger (files involved)
  missing: []       # Populated by declare-debugger (what was missing)
```

This structured format feeds directly into the declare-debugger diagnosis mode and gap closure planning.
</gap_format>

<success_criteria>
- [ ] UAT file created with all tests from milestone PLAN.md "produces" fields
- [ ] Tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip
- [ ] Severity inferred from description (never asked)
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] Committed on completion
- [ ] If issues: parallel declare-debugger agents diagnose root causes
- [ ] Gap format includes test_id, description, expected, actual, severity, root_cause
- [ ] If issues: fix plans created covering all diagnosed gaps
- [ ] If issues: fix plans verified before presenting to user
- [ ] Ready for `/declare:execute M-{id} --gaps-only` when complete
</success_criteria>
