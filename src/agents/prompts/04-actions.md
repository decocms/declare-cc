# Action Planning

## Purpose
Break milestones into concrete, executable actions. Actions are what agents or humans actually do.

## What Is an Action?
An action is a **specific task** that produces a **verifiable output**:
- "Create the PDF rendering module with Puppeteer" -> produces `src/pdf/render.ts`
- "Write integration tests for the export endpoint" -> produces `tests/export.test.ts`
- "Configure CI pipeline for load testing" -> produces `.github/workflows/load-test.yml`

## Action Structure (REQUIRED)

Every action MUST have ALL of these fields:

```markdown
### A-XX: Action Title

**Status:** PENDING
**Files:** src/foo.ts, src/bar.ts
**Verify:** `npm test -- --grep "foo"` (runnable command that proves completion)
**Done:** Observable truth — what is true when this action is complete
**Wave:** 1 (execution wave — actions in the same wave run concurrently)
**Depends On:** A-01, A-02 (action IDs that must complete first)

Description of what to do.
```

### Field Rules
- **Files**: Specific files to create or modify. Max 5 files per action.
- **Verify**: A command that can be run to check completion. NOT prose — an actual `command`.
- **Done**: An observable truth statement, not a task description. "Users can log in via OAuth" not "Implement OAuth login".
- **Wave**: Integer starting at 1. Actions in Wave 1 run first, Wave 2 after Wave 1 completes, etc.
- **Depends On**: Only reference actions within the same plan. Forms a DAG (no cycles).

## Must-Haves Section

Before listing actions, declare the **Must-Haves** for this milestone:

```markdown
## Must-Haves

**Truths:**
- Observable behaviors from user perspective that MUST be true when done
- e.g., "Users see real-time updates without refreshing"

**Artifacts:**
- `src/ws/server.ts` — WebSocket server with connection handling
- `src/ws/client.ts` — Client-side WebSocket hook

**Key Links:**
- from: `src/ws/server.ts` -> to: `src/app/dashboard.tsx` -> via: WebSocket messages
- from: `src/api/mutations.ts` -> to: `src/ws/server.ts` -> via: broadcast after mutation
```

### Must-Have Definitions
- **Truths**: Observable behaviors from the user's perspective. Not implementation details — things you can see or measure.
- **Artifacts**: Files that MUST exist with minimum substance (not stubs). Format: `path` — what it provides.
- **Key Links**: Critical wiring between components. If component A needs to talk to component B, declare how.

## Planning Rules

1. **Each action produces something concrete** — a file, a config change, a test result
2. **Actions are ordered by wave** — Wave 1 runs first, Wave 2 after, etc.
3. **An action should take 15-60 minutes** for an agent to complete
4. **Actions cause milestones** — completing all actions should make the milestone true
5. **2-4 actions per plan** — Keep plans focused. If you need more, the milestone is too big.
6. **Max 5 files per action** — If an action touches more, split it.
7. **Last action verifies** — The final action should verify the milestone condition itself.

## Plan Checking (Self-Validate Before Outputting)

Before producing your plan, verify:
- [ ] Every must-have truth has an implementing action
- [ ] Every must-have artifact appears in at least one action's Files list
- [ ] Every must-have key link has actions that create both endpoints
- [ ] No action is missing Files, Verify, Done, or Wave
- [ ] Verify commands are runnable shell commands (not prose)
- [ ] Dependencies form a valid DAG (no cycles)
- [ ] Wave assignments are consistent with dependencies (if A depends on B, A's wave > B's wave)
- [ ] The last action verifies the milestone condition

## For Agent Execution
When an agent executes an action, it receives:
1. The action description
2. The milestone it causes (context on WHY)
3. The declaration the milestone realizes (the big picture)
4. Previous action outputs (what's already done)

This chain — action -> milestone -> declaration — is the meta-prompt that gives agents purpose and context.
