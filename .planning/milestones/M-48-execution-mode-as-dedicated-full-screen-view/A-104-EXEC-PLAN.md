---
milestone: M-48-execution-mode-as-dedicated-full-screen-view
action: A-104
type: execute
wave: 2
depends_on: ["A-103"]
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations: ["D-14"]
must_haves:
  truths:
    - "User sees real-time agent output for the currently running action in a large scrollable panel"
    - "Output auto-scrolls to follow the active action's latest output"
    - "User can click any completed action in the pipeline to review its past output"
    - "Clicking a different action switches the output panel to show that action's output"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "Split layout CSS for execution view (left pipeline + right output panel)"
      contains: "exec-output-panel"
    - path: "src/server/public/app.js"
      provides: "Output panel rendering, SSE output routing to execution view, click-to-review"
      contains: "execSelectedActionId"
  key_links:
    - from: "src/server/public/app.js"
      to: "SSE action-output events"
      via: "handleActionOutput routes to execution output panel"
      pattern: "exec-output-log"
    - from: "src/server/public/app.js"
      to: "#execution-view DOM"
      via: "click handler on .exec-action-item selects action for output viewing"
      pattern: "execSelectedActionId"
---

<objective>
Add a live output panel to the execution view, splitting it into a left pipeline list and a right output panel.

Purpose: During execution, the operator needs to see what agents are doing in real-time. This transforms the execution view from a status-only pipeline into a split-pane monitoring console where live output streams on the right while pipeline progress updates on the left.

Output: Split-pane execution view with left panel (pipeline from A-103) and right panel (scrollable output log). Auto-follows active action, click-to-review past output.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/PLAN.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-103-SUMMARY.md
@src/server/public/index.html
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Split execution view into pipeline + output panels</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**In index.html:**

1. Update `#execution-view` CSS to be a flex row layout:
   ```css
   #execution-view.active { display: flex; flex-direction: row; }
   ```

2. Add CSS for the left pipeline panel:
   - `.exec-left-panel` — width 340px, flex-shrink 0, overflow-y auto, border-right 1px solid var(--border), padding 16px.

3. Add CSS for the right output panel:
   - `.exec-output-panel` — flex 1, display flex, flex-direction column, overflow hidden.
   - `.exec-output-header` — height 36px, flex-shrink 0, display flex, align-items center, padding 0 16px, background var(--surface), border-bottom 1px solid var(--border), font-size 12px, color var(--text-dim). Contains the action ID label of what's being shown.
   - `.exec-output-log` — flex 1, overflow-y auto, padding 12px 16px, font-family 'SF Mono', 'Fira Code', 'Consolas', monospace, font-size 12px, line-height 1.6, color var(--text), white-space pre-wrap, word-break break-all, background var(--bg).
   - `.exec-output-empty` — centered placeholder text when no action is selected. Color var(--text-dim), font-size 13px, padding 40px, text-align center.

4. Update the execution view DOM structure (replace the simple `#exec-pipeline` wrapper):
   ```html
   <div id="execution-view">
     <div class="exec-left-panel">
       <div class="exec-pipeline" id="exec-pipeline"></div>
     </div>
     <div class="exec-output-panel">
       <div class="exec-output-header" id="exec-output-header">No action selected</div>
       <pre class="exec-output-log" id="exec-output-log"></pre>
     </div>
   </div>
   ```

**In app.js:**

1. Add state variable for the execution view's selected action:
   ```js
   /** @type {string|null} Action ID selected in execution view for output display */
   let execSelectedActionId = null;
   /** @type {Object<string, string>} Buffered output per action ID for review */
   let execOutputBuffers = {};
   ```

2. Add DOM refs:
   ```js
   const $execOutputHeader = document.getElementById('exec-output-header');
   const $execOutputLog = document.getElementById('exec-output-log');
   ```

3. Add click handler to pipeline action items in `renderExecutionView()`:
   - Each `.exec-action-item` gets a click event that calls `selectExecAction(actionId)`.
   - The currently selected action gets the `.active` class on its `.exec-action-item`.

4. Create `selectExecAction(actionId)` function:
   - Sets `execSelectedActionId = actionId`.
   - Updates `$execOutputHeader` to show the action ID and title.
   - Clears `$execOutputLog` and populates it with `execOutputBuffers[actionId]` if available.
   - If the action is currently running (in `runningActions` set), also set `currentOutputActionId = actionId` so new SSE output routes here.
   - Scroll `$execOutputLog` to bottom.
   - Re-render pipeline to update `.active` class on the selected item.

5. Update `handleActionOutput()` to also buffer output for the execution view:
   - Always append to `execOutputBuffers[actionId]` (create if missing).
   - If `viewMode === 'execution'` and `actionId === execSelectedActionId`, append text to `$execOutputLog` and auto-scroll.
   - Keep the existing behavior for the detail panel output log as fallback.

6. Auto-select the first running action: in `handlePlayWaveStart()`, when new actions start running, if `viewMode === 'execution'` and no action is currently selected (or the selected action is done), auto-select the first active action from the new wave via `selectExecAction()`.

7. When an action completes (`handleActionComplete`), if `viewMode === 'execution'`:
   - Update the pipeline rendering (already done by A-103).
   - If the completed action was selected, keep showing its output (don't auto-switch away — let user review).
   - If a new action starts running in the same wave, auto-select it only if the user hasn't manually selected a different action. Track this with a `execAutoFollow` boolean (default true, set to false when user manually clicks an action that isn't running).

8. Clear `execOutputBuffers` when play starts (in `handlePlayStart`) to reset state for a new execution run.
  </action>
  <verify>
Start a play sequence. Verify the execution view shows the split layout: pipeline list on the left, output log on the right. Verify live output streams into the right panel for the running action. Click a completed action and verify its buffered output appears. Verify auto-follow selects the next running action when one completes.
  </verify>
  <done>
Execution view is split into left pipeline (340px) and right output panel. Live SSE output streams into the output panel for the active action. Clicking any action in the pipeline switches the output display. Auto-follow tracks the running action unless user manually selects a different one.
  </done>
</task>

</tasks>

<verification>
- Split-pane layout: left pipeline list (340px), right output panel (flex 1)
- Live output from `action-output` SSE events appears in `#exec-output-log` for the selected action
- `execOutputBuffers` stores output per action for review after completion
- Click on any `.exec-action-item` switches output panel to that action's output
- Auto-follow selects the running action unless user manually selected a different one
- Output panel auto-scrolls to bottom on new content
</verification>

<success_criteria>
The execution view provides a real-time monitoring console: pipeline status on the left, live agent output on the right, with click-to-review for past actions and auto-follow for the currently executing action.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-104-SUMMARY.md`
</output>
