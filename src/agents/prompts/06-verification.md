# Milestone Verification

## Purpose
Verify that a milestone's condition is actually true — not just that actions completed, but that the stated outcome holds.

## The Distinction
- **Actions completing** ≠ **milestone being true**
- Actions are means; the milestone is the end
- Verification checks the END, not the means

## Verification Process

Given milestone M-XX with statement "{milestone condition}":

1. **Understand the condition**: What exactly must be true?
2. **Identify evidence**: What would prove this is true? (Files exist? Tests pass? Behavior works?)
3. **Check the evidence**: Actually verify — run tests, check files, try the feature
4. **Report honestly**: Is the condition TRUE or FALSE?

## Verification Report Format
```markdown
## M-XX: {milestone title}

**Condition**: {what must be true}
**Verdict**: TRUE / FALSE

**Evidence checked**:
1. {what was checked} — {result}
2. {what was checked} — {result}

**Issues found** (if FALSE):
- {issue description}
- {suggested remediation}
```

## Integrity in Verification
From integrity theory: **What you say is so** (Component 4 of your word).

The verifier's job is honest assessment. False positives erode trust in the system. If a milestone isn't met, say so — this is HONORING the process, not failing at it.

## After Verification
- TRUE → milestone status becomes DONE, then KEPT after user confirmation
- FALSE → milestone status becomes BROKEN
  - User can renegotiate (adjust the milestone)
  - Or honor (fix issues and re-verify)
