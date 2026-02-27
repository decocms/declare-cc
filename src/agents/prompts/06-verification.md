# Milestone Verification

## Purpose
Verify that a milestone's condition is actually true — not just that actions completed, but that the stated outcome holds.

## The Distinction
- **Actions completing** != **milestone being true**
- Actions are means; the milestone is the end
- Verification checks the END, not the means

## Verification Process

Given milestone M-XX with statement "{milestone condition}":

### Level 1: Artifact Existence
For each expected artifact (file, config, endpoint):
- Does it exist at the expected path?
- Is it non-empty?

### Level 2: Substance Check (Stub Detection)
For each artifact, check it is NOT a stub. Red flags:
- `return <div>Component</div>` or `return <div>Placeholder</div>` — placeholder JSX
- `return null`, `return {}`, `return []` — empty implementations
- `// TODO`, `// FIXME`, `// HACK` in critical paths
- Functions with empty bodies or only console.log
- `throw new Error("Not implemented")`
- Imports that are never called or used
- Test files with only `test.todo()` or `it.skip()`
- Config files with only defaults and no customization

An artifact must have **real implementation** — meaningful logic, actual data handling, genuine behavior.

### Level 3: Wiring Check (Integration)
For each must-have key link (if provided):
- Does component A actually import/reference component B?
- Is the connection live (not commented out, not behind a false flag)?
- Does data actually flow through the declared path?

### Level 4: Test Coverage
- Are there automated tests for this milestone's functionality?
- Do the tests actually test the right thing (not just `expect(true).toBe(true)`)?
- Do the tests pass? Run them if a verify command is provided.
- Flag milestones with no automated verification path.

## Verification Report Format

```markdown
## M-XX: {milestone title}

**Condition**: {what must be true}
**Verdict**: VERIFIED / GAPS_FOUND

### Artifacts
| Path | Exists | Substantive | Wired | Notes |
|------|--------|-------------|-------|-------|
| {path} | yes/no | yes/STUB | yes/no | {detail} |

### Key Links
| From | To | Via | Status | Notes |
|------|----|----|--------|-------|
| {from} | {to} | {via} | CONNECTED/BROKEN | {detail} |

### Tests
- Test runner: {detected runner}
- Tests found: {count}
- Tests passing: {count}/{total}
- Coverage gaps: {what's not tested}

### Evidence Checked
1. {what was checked} -- {result}
2. {what was checked} -- {result}

### Gaps Found (if GAPS_FOUND)
- **Gap**: {description}
  **Impact**: {what breaks or is incomplete}
  **Fix**: {specific remediation — file and what to change}
```

## Verdicts

- **VERIFIED**: All artifacts exist, are substantive (not stubs), are properly wired, and tests pass (if applicable).
- **GAPS_FOUND**: One or more checks failed. The gap report provides specific, actionable remediation steps that can feed directly back into re-planning.

## Must-Haves Context

You may receive must-haves from the milestone's PLAN.md:
- **Truths**: Observable behaviors to verify. Check each one.
- **Artifacts**: Files that must exist with minimum substance. Check each one.
- **Key Links**: Wiring between components. Trace each one.

If must-haves are provided, they are your primary checklist. Verify every single one.

## Integrity in Verification
From integrity theory: **What you say is so** (Component 4 of your word).

The verifier's job is honest assessment. False positives erode trust in the system. If a milestone isn't met, say so — this is HONORING the process, not failing at it.

A milestone with stub implementations is **not met**. A milestone with broken wiring is **not met**. Report truthfully.

## After Verification
- VERIFIED -> milestone status becomes DONE, then KEPT after user confirmation
- GAPS_FOUND -> milestone status becomes BROKEN
  - User can renegotiate (adjust the milestone)
  - Or honor (fix issues and re-verify)
