---
milestone: M-49-mode-transition-gate
action: A-106
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/app.js
autonomous: true
declarations: ["D-14"]

must_haves:
  truths:
    - "switchView('execution') is rejected when unapproved non-DONE actions exist"
    - "switchView('execution') succeeds when all non-DONE actions are approved"
    - "Returning from execution to planning (columns) is always allowed"
    - "Play start still auto-switches to execution mode (play already requires approval server-side)"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Guarded switchView function with canEnterExecution() check"
      contains: "canEnterExecution"
  key_links:
    - from: "switchView('execution')"
      to: "canEnterExecution()"
      via: "guard check before mode transition"
      pattern: "canEnterExecution"
    - from: "canEnterExecution()"
      to: "graphData.actions"
      via: "filter non-DONE actions, check all reviewState === approved"
      pattern: "reviewState.*approved"
---

<objective>
Add a transition gate to switchView() that prevents entering execution mode unless all non-DONE actions have reviewState === 'approved'.

Purpose: D-14 requires an explicit transition between planning and execution modes. Currently switchView('execution') can be called from anywhere. This action guards it so execution mode is only reachable when all plans are approved.

Output: Modified switchView() with canEnterExecution() gate function.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-49-mode-transition-gate/PLAN.md
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add canEnterExecution() gate and guard switchView</name>
  <files>src/server/public/app.js</files>
  <action>
1. Add a `canEnterExecution()` function near the existing `switchView()` function (around line 4604). The function checks:
   - Get all actions from `graphData.actions` (default to empty array)
   - Filter to non-DONE actions: `!COMPLETED.has((a.status || '').toUpperCase())`
   - Return `true` if every remaining action has `reviewState === 'approved'`
   - Return `true` if there are no non-DONE actions (edge case: everything is done)
   - Return `false` otherwise

2. Modify `switchView(mode)` (line 4604): At the top of the function, add a guard:
   ```
   if (mode === 'execution' && !canEnterExecution()) {
     console.warn('Cannot enter execution mode: unapproved actions remain');
     return;
   }
   ```
   This prevents ANY code path from entering execution mode when plans aren't approved.

3. The handlePlayStart function (line 3556) calls `switchView('execution')` directly. This is fine because play-start is already gated server-side on approval (M-46). The canEnterExecution check will pass since play can only start when all actions are approved. No change needed to handlePlayStart.

4. The $execExitBtn click handler (line 4718) calls `switchView('columns')` — this is exiting execution, not entering it, so no guard needed. No change needed.

Do NOT add any UI elements in this task — that's A-107. This is purely the gate logic.
  </action>
  <verify>
  - Search app.js for `canEnterExecution` — function must exist
  - Search app.js for the guard in switchView — must check before allowing execution mode
  - Verify the guard does NOT block transitions to 'dag' or 'columns'
  - Verify handlePlayStart still calls switchView('execution') without extra guards
  - Run `node -c src/server/public/app.js` to verify no syntax errors
  </verify>
  <done>
  - canEnterExecution() returns true only when all non-DONE actions have reviewState === 'approved'
  - switchView('execution') is a no-op when canEnterExecution() returns false
  - switchView('columns') and switchView('dag') are unaffected
  - Play auto-switch to execution still works (play already requires approval)
  </done>
</task>

</tasks>

<verification>
- `node -c src/server/public/app.js` passes (no syntax errors)
- grep confirms canEnterExecution function exists and is called in switchView guard
- Existing switchView('columns') and switchView('dag') calls are unaffected
</verification>

<success_criteria>
Execution mode cannot be entered unless all non-DONE actions are approved. Exiting execution mode is always allowed. Play auto-switch still works because play itself requires approval.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-49-mode-transition-gate/A-106-SUMMARY.md`
</output>
