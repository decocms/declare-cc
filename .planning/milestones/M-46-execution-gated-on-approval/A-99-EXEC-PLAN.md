---
milestone: M-46-execution-gated-on-approval
action: A-99
type: execute
wave: 2
depends_on:
  - A-98
files_modified:
  - src/server/public/app.js
autonomous: true
declarations:
  - D-13

must_haves:
  truths:
    - "Execute button is visually disabled (grayed out) when action reviewState is not 'approved'"
    - "Play All button is visually disabled when any in-scope action is not 'approved'"
    - "Disabled Execute button shows tooltip explaining why it cannot run"
    - "Disabled Play All button shows tooltip with count of unapproved plans"
    - "Buttons become active when all relevant actions are approved"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Disabled state logic for Execute and Play All buttons"
      contains: "reviewState.*approved"
  key_links:
    - from: "src/server/public/app.js Execute button"
      to: "graphData.actions reviewState"
      via: "check reviewState before rendering enabled button"
      pattern: "reviewState.*!==.*approved"
    - from: "src/server/public/app.js Play All button"
      to: "graphData.actions"
      via: "filter unapproved actions and disable if any"
      pattern: "unapproved.*play-btn"
---

<objective>
Disable Execute and Play All buttons in the UI when actions are not approved, with informative tooltips showing why execution is blocked.

Purpose: Give the user clear visual feedback that approval is required before execution, matching the server-side gate from A-98.
Output: Modified app.js with disabled states and tooltips on both buttons.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-46-execution-gated-on-approval/A-98-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Disable Execute button for unapproved actions</name>
  <files>src/server/public/app.js</files>
  <action>
In the exec-plan detail panel rendering (around line 2292-2304 in app.js), where the Execute/Stop button is built:

Currently the code checks `isCompleted` and `isRunning`. Add a third check: whether the action's `reviewState` is `'approved'`.

1. Get the action's reviewState from `actionItem.reviewState` (already available in graphData.actions).
2. If `reviewState !== 'approved'` and the action is not completed and not running, render the Execute button as disabled with a tooltip:
   ```js
   const isApproved = actionItem && actionItem.reviewState === 'approved';
   ```
3. When not approved, render:
   ```html
   <button class="exec-btn" disabled title="Plan must be approved before execution (currently: ${reviewState})">&#9654; Execute</button>
   ```
4. When approved (or completed/running), keep existing behavior unchanged.

This is a small change in the conditional block at lines 2298-2304.
  </action>
  <verify>
Open the dashboard in a browser. Navigate to an action that has reviewState "draft". The Execute button should appear grayed out with a tooltip. Change the action's review state to "approved" by clicking the review badge, then verify the button becomes active.
  </verify>
  <done>Execute button is disabled with explanatory tooltip when action reviewState is not "approved". Button becomes active when approved.</done>
</task>

<task type="auto">
  <name>Task 2: Disable Play All button for unapproved actions</name>
  <files>src/server/public/app.js</files>
  <action>
The Play All button is a static element in index.html (`id="play-btn"`), and its state is managed by `updatePlayUI()` (around line 2605).

1. In `updatePlayUI()`, after the existing play-running check, add an approval check:
   - From `graphData.actions`, filter agent-time actions that are not DONE and not approved.
   - Use the same logic as the server: get milestones where `classification === 'agent'` and status is not DONE, get their actions, check reviewState.
   - Simpler approach: just filter all non-DONE actions where `reviewState !== 'approved'`. This is conservative (may include human milestone actions) but safe — the server gate is the authority.

2. If any unapproved non-DONE actions exist:
   ```js
   const nonDoneActions = (graphData.actions || []).filter(a => !COMPLETED.has((a.status || '').toUpperCase()));
   const unapproved = nonDoneActions.filter(a => a.reviewState !== 'approved');
   if (unapproved.length > 0) {
     btn.disabled = true;
     btn.title = `${unapproved.length} plan(s) need approval before execution`;
     return;
   }
   ```

3. If all non-DONE actions are approved, restore normal behavior:
   ```js
   btn.title = 'Execute all ready agent milestones in dependency order';
   ```

4. Make sure `updatePlayUI()` is called after graph data refreshes. It is already called in the graph refresh cycle via `pollData()`, so this should work automatically.
  </action>
  <verify>
Open the dashboard. With unapproved actions present, the Play All button should be grayed out with a tooltip like "3 plan(s) need approval before execution". Approve all actions, and the button should become active.
  </verify>
  <done>Play All button is disabled with count tooltip when any non-DONE action is unapproved. Becomes active when all are approved.</done>
</task>

</tasks>

<verification>
1. Execute button disabled + tooltip for unapproved actions
2. Execute button enabled for approved actions
3. Play All button disabled + count tooltip when any action unapproved
4. Play All button enabled when all non-DONE actions approved
5. No visual regression on completed or running actions
</verification>

<success_criteria>
Both Execute and Play All buttons visually reflect approval state with disabled styling and informative tooltips. Buttons activate when approval conditions are met.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-46-execution-gated-on-approval/A-99-SUMMARY.md`
</output>
