# Action Planning

## Purpose
Break milestones into concrete, executable actions. Actions are what agents or humans actually do.

## What Is an Action?
An action is a **specific task** that produces a **verifiable output**:
- "Create the PDF rendering module with Puppeteer" → produces `src/pdf/render.ts`
- "Write integration tests for the export endpoint" → produces `tests/export.test.ts`
- "Configure CI pipeline for load testing" → produces `.github/workflows/load-test.yml`

## Planning Rules

1. **Each action produces something concrete** — a file, a config change, a test result
2. **Actions are ordered** — earlier actions may unblock later ones
3. **An action should take 15-60 minutes** for an agent to complete
4. **Actions cause milestones** — completing all actions for a milestone should make it true
5. **Include verification** — the last action for a milestone should verify the milestone condition

## Action Structure
```markdown
### A-XX: Action Title

**Description**: What to do and what it produces.
**Produces**: Specific files or artifacts created.
**Depends on**: Other action IDs that must complete first (if any).
```

## For Agent Execution
When an agent executes an action, it receives:
1. The action description
2. The milestone it causes (context on WHY)
3. The declaration the milestone realizes (the big picture)
4. Previous action outputs (what's already done)

This chain — action → milestone → declaration — is the meta-prompt that gives agents purpose and context.
