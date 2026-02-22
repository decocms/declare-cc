---
milestone: M-50-execution-order-configuration
action: A-108
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations: ["D-15"]

must_haves:
  truths:
    - "Entering execution mode shows wave-grouped order as ordered list before any execution starts"
    - "Each wave section shows numbered wave header with milestones and their actions listed below"
    - "A 'Confirm Order' button appears that must be clicked before Execute/Play becomes available"
    - "Play All button is hidden until order is confirmed"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "renderPreExecutionView function with wave order display and confirm flow"
      contains: "renderPreExecutionView"
    - path: "src/server/public/index.html"
      provides: "CSS styles for pre-execution wave order view and confirm button"
      contains: "exec-preorder"
  key_links:
    - from: "switchView('execution')"
      to: "renderPreExecutionView()"
      via: "execution mode entry shows pre-execution view first"
      pattern: "renderPreExecutionView"
    - from: "Confirm Order button click"
      to: "renderExecutionView()"
      via: "confirmation transitions to live execution pipeline"
      pattern: "confirmOrder|orderConfirmed"
---

<objective>
Build a pre-execution wave order view that displays the computed execution order (milestones grouped by dependency waves, with nested actions) as an ordered list when entering execution mode. The user must confirm the order before the Execute button becomes available.

Purpose: D-15 requires that execution order is confirmed before running. This action adds the "review before execute" step between entering execution mode and actually running the pipeline.

Output: Modified execution view with a pre-execution confirmation step showing wave-ordered milestones and actions.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/server/public/app.js (renderExecutionView function, lines ~4499-4608; switchView function, lines ~4628-4674; updateExecTopbar, lines ~3484-3499)
@src/server/public/index.html (execution view HTML, lines ~2490-2507; exec CSS, lines ~2220-2362)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add pre-execution wave order view with confirm step</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
Add a "pre-execution" state to the execution view that shows before the live pipeline. The flow is: Enter Execution Mode -> Pre-Execution Order View -> Confirm Order -> Live Pipeline (existing renderExecutionView).

In app.js:

1. Add a module-level boolean `let orderConfirmed = false;` near the other execution state variables (around line 130).

2. Create `renderPreExecutionView()` function that:
   - Uses the same Kahn's algorithm wave computation as renderExecutionView (lines 4506-4543) — extract into a shared helper `computeWaveOrder()` that both functions call
   - Renders into `#exec-pipeline` with a different layout: numbered ordered list style
   - Each wave gets a prominent header: "Wave N" with a horizontal rule
   - Under each wave, milestones listed as numbered items with their title and status (using deriveMilestoneStatus)
   - Under each milestone, actions listed as sub-items with status dots (reuse .exec-status-dot classes)
   - At the bottom of the pipeline panel, render a "Confirm Order" button (`<button class="exec-confirm-btn" id="exec-confirm-btn">Confirm Order</button>`)
   - Wire the button click: sets `orderConfirmed = true`, then calls `renderExecutionView()` and `updateExecTopbar()`

3. Modify `switchView('execution')` (line 4663-4672): When entering execution mode, set `orderConfirmed = false`, then call `renderPreExecutionView()` instead of `renderExecutionView()`. Only call `renderExecutionView()` if `orderConfirmed` is true.

4. Modify `updateExecTopbar()`: When `!orderConfirmed`, set title to "Review Execution Order", hide the Stop button, and hide any Play controls. When `orderConfirmed`, keep existing behavior.

5. Modify `startPlay()` (line 3446): Add guard at top — if `!orderConfirmed` return early (prevent execution before confirmation).

6. Wherever `renderExecutionView()` is called from SSE handlers or polling (lines 3433, 3609, 3640, 4492), add a guard: only call if `orderConfirmed` is true. If not confirmed, call `renderPreExecutionView()` instead.

In index.html:

7. Add CSS for the pre-execution view:
   - `.exec-preorder-list` — ordered list with counter-reset, no default list style
   - `.exec-preorder-wave` — wave group with left border accent (var(--planned-color)), padding, margin-bottom
   - `.exec-preorder-wave-header` — font-size 13px, font-weight 700, color var(--text), margin-bottom 8px
   - `.exec-preorder-milestone` — padding 6px 12px, font-size 13px, color var(--mile-color)
   - `.exec-preorder-action` — padding 4px 12px 4px 24px, font-size 12px, color var(--text-dim), display flex with gap 8px and status dot
   - `.exec-confirm-btn` — styled like existing exec buttons: background var(--act-color), color white, border none, padding 10px 24px, border-radius 6px, font-size 14px, font-weight 600, cursor pointer, margin-top 20px, width 100%
   - `.exec-confirm-btn:hover` — opacity 0.9
  </action>
  <verify>
    1. Run `node dist/declare-tools.cjs build` (or equivalent build step) to ensure no syntax errors
    2. Start the server with `node src/server/index.js` and open in browser
    3. Enter execution mode — should see wave-ordered list with "Confirm Order" button, NOT the live pipeline
    4. Click "Confirm Order" — should transition to the existing live execution pipeline view
    5. Play All button should only be clickable after confirming order
  </verify>
  <done>
    Entering execution mode shows pre-execution wave order view with numbered wave groups, milestone/action lists, and Confirm Order button. Clicking Confirm transitions to live pipeline view. Play is blocked until order is confirmed.
  </done>
</task>

</tasks>

<verification>
- Enter execution mode from column browser via "Enter Execution Mode" button
- Pre-execution view displays with wave groups showing milestones and actions
- "Confirm Order" button visible at bottom of left panel
- Play/Stop buttons hidden during pre-execution review
- After clicking "Confirm Order", live pipeline view appears with Play controls
- Refreshing page while in execution mode shows pre-execution view again (orderConfirmed resets)
</verification>

<success_criteria>
Pre-execution wave order view displays on execution mode entry, requires explicit confirmation before execution controls are available. All existing execution view functionality preserved after confirmation.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-50-execution-order-configuration/A-108-SUMMARY.md`
</output>
