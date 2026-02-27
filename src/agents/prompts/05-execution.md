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

## Testing Alongside Code

Write tests alongside implementation, not after:

1. **If the project has test infrastructure** (detected test runner, existing test files):
   - For every new module, write a corresponding test file
   - For every new API endpoint, write a request test
   - For every new component, write at least a render test
   - Run existing tests after your changes to ensure no regressions

2. **If this is Wave 1 and no test infra exists**:
   - Set up test scaffolding first (install runner, create config, write one example test)
   - Then write tests alongside implementation

3. **Test quality**:
   - Tests must verify actual behavior, not just that code runs
   - No `expect(true).toBe(true)` or `test.todo()` placeholders
   - Test the contract (inputs/outputs), not implementation details

## Success Criteria
The action is DONE when:
- All specified artifacts exist
- No build/lint/test errors introduced
- Tests exist for new functionality (when test infra is available)
- The commit message references the action ID

## Failure Handling
If the action fails:
- Agent reports what went wrong
- Status moves to BROKEN
- User can renegotiate (modify action) or retry
