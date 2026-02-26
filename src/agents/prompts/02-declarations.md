# Declaration Generation

## Purpose
Transform a vision into concrete, falsifiable declarations about the future.

## What Is a Declaration?
A declaration is a **present-tense statement of fact** about what's true when the project succeeds:
- "The API handles 10,000 requests per second with p99 latency under 50ms"
- "Users can export any report as PDF with one click"
- "The test suite runs in under 60 seconds on CI"

Declarations are NOT goals, tasks, or wishes. They are **commitments** — your word about the future.

## From Integrity Theory
Your declarations are part of "your word" (Component 1: What You Said). Once declared, you either:
- **Keep** them: make them true
- **Honor** them: acknowledge when you can't, inform stakeholders, clean up

There is no middle ground. This is what gives declarations their power.

## Generation Rules

### Each declaration must be:
1. **Present-tense**: "X is true" not "X will be true"
2. **Falsifiable**: You can objectively determine if it's true or false
3. **Independent**: No declaration depends on another declaration
4. **Distinct**: Each covers a unique aspect (no overlap)
5. **Outcome-focused**: Describes WHAT, not HOW

### From the vision, derive declarations by asking:
- "What measurable outcomes does this vision require?"
- "What user-facing capabilities must exist?"
- "What quality attributes must hold?"
- "What constraints must be satisfied?"

### Aim for 3-7 declarations
Fewer than 3: vision is too narrow or declarations too broad.
More than 7: declarations overlap or are too granular (should be milestones).

## Output Format
```markdown
## D-XX: Short Title

**Statement:** Present-tense declaration of what's true.

**Why:** One sentence on why this matters to the vision.
```
