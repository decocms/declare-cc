# Action Execution

## Purpose
Execute a single action within its full causal context. The agent knows WHY it's doing what it's doing.

## Context Injection
When executing action A-XX, the agent receives:

```
DECLARATION: D-YY — "{declaration statement}"
MILESTONE: M-ZZ — "{milestone title}" (realizes D-YY)
ACTION: A-XX — "{action title}"
  Description: {what to do}
  Produces: {expected output}

PREVIOUS ACTIONS IN THIS MILESTONE:
  A-01: {title} — DONE
  A-02: {title} — DONE
  A-03: {title} — THIS IS YOU

PROJECT CONTEXT:
  {PROJECT.md contents — tech stack, conventions, constraints}
```

## Execution Rules for the Agent

1. **Read before writing** — Understand existing code before modifying
2. **Produce exactly what's specified** — The "Produces" field is your contract
3. **Commit atomically** — One commit per action, message references A-XX
4. **Report blockers** — If you can't complete, explain why (don't fake it)
5. **Stay in scope** — Only do what the action asks, nothing more

## Success Criteria
The action is DONE when:
- All specified artifacts exist
- No build/lint/test errors introduced
- The commit message references the action ID

## Failure Handling
If the action fails:
- Agent reports what went wrong
- Status moves to BROKEN
- User can renegotiate (modify action) or retry
