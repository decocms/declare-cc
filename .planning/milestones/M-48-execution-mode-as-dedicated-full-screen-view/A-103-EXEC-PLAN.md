---
milestone: M-48-execution-mode-as-dedicated-full-screen-view
action: A-103
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations: ["D-14"]
must_haves:
  truths:
    - "User can switch to execution view mode from status bar"
    - "Execution view shows milestones as header rows with nested actions beneath"
    - "Each action displays a status indicator (queued/running/done/failed) with colored circle icon"
    - "Vertical connecting lines visually link stages in a CI-pipeline style"
    - "Milestones and actions appear in wave-sorted dependency order"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "Execution view DOM section and CSS styles"
      contains: "id=\"execution-view\""
    - path: "src/server/public/app.js"
      provides: "Execution view rendering, viewMode='execution', switchView update"
      contains: "renderExecutionView"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/graph"
      via: "graphData used to compute pipeline order"
      pattern: "graphData\\.milestones"
    - from: "src/server/public/app.js"
      to: "src/server/public/index.html"
      via: "DOM manipulation of #execution-view"
      pattern: "execution-view"
---

<objective>
Build the execution pipeline view layout as a third viewMode ('execution') in the dashboard.

Purpose: D-14 requires planning and execution to be distinct UX modes. This action creates the dedicated full-screen execution view showing milestones and actions in a vertical CI-pipeline layout with status indicators and connecting lines.

Output: A new `#execution-view` DOM section rendered when viewMode === 'execution', with milestone headers, nested action items, status circles (gray=queued, blue=running, green=done, red=failed), and CSS border-left connecting lines between stages.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/PLAN.md
@src/server/public/index.html
@src/server/public/app.js
@src/commands/play.js (computePlayOrder for wave ordering reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add execution view DOM, CSS, and viewMode wiring</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**In index.html:**

1. Add CSS for the execution view (inside the existing `<style>` block, before `</style>`):
   - `#execution-view` — hidden by default (`display: none`), full height flex container, overflow-y auto, padding 20px, background var(--bg). When `.active`, `display: block`.
   - `.exec-pipeline` — the container for the vertical pipeline list.
   - `.exec-milestone-group` — milestone header + its actions. margin-bottom 16px.
   - `.exec-milestone-header` — font-weight 600, color var(--mile-color), padding 8px 12px, background var(--mile-bg), border 1px solid var(--mile-border), border-radius 6px, font-size 14px. Display flex, align-items center, gap 8px.
   - `.exec-action-list` — margin-left 20px, border-left 2px solid var(--border), padding-left 16px.
   - `.exec-action-item` — display flex, align-items center, gap 10px, padding 8px 12px, margin 4px 0, background var(--surface), border 1px solid var(--border), border-radius 4px, cursor pointer, font-size 13px, transition background 0.15s.
   - `.exec-action-item:hover` — background var(--surface2).
   - `.exec-action-item.active` — border-color var(--executing-border), background var(--executing-bg).
   - `.exec-status-dot` — width 10px, height 10px, border-radius 50%, flex-shrink 0.
   - `.exec-status-dot.queued` — background #555 (gray).
   - `.exec-status-dot.running` — background var(--planned-color) (blue), add a subtle pulse animation.
   - `.exec-status-dot.done` — background var(--act-color) (green).
   - `.exec-status-dot.failed` — background var(--broken-color) (red).
   - `.exec-action-title` — flex 1, color var(--text), overflow hidden, text-overflow ellipsis, white-space nowrap.
   - `.exec-action-status-label` — font-size 11px, color var(--text-dim), text-transform uppercase.
   - `.exec-wave-label` — font-size 11px, color var(--text-dim), margin-bottom 4px, padding-left 4px.
   - Add a `@keyframes exec-pulse` animation for the running dot (opacity 1 to 0.3 and back, 1.5s infinite).
   - `.exec-status-dot.running` gets `animation: exec-pulse 1.5s ease-in-out infinite`.

2. Add the DOM element inside `<div id="main">`, after the `#column-browser` div and before the closing `</div>` of main:
   ```html
   <!-- Execution view — CI pipeline layout -->
   <div id="execution-view">
     <div class="exec-pipeline" id="exec-pipeline"></div>
   </div>
   ```

**In app.js:**

1. Update the viewMode type annotation (line ~47) from `'dag'|'columns'` to `'dag'|'columns'|'execution'`.

2. Add DOM ref after existing refs (around line ~130):
   ```js
   const $execView = document.getElementById('execution-view');
   ```

3. Create `renderExecutionView()` function:
   - Uses `graphData` (milestones and actions) to build the pipeline.
   - Compute wave order: sort milestones by dependency order using a simplified version of the play.js logic — iterate milestones, group by dependency waves. For each milestone, get its non-DONE actions. For DONE milestones with all-DONE actions, still show them (dimmed) for context.
   - For each wave, render a `.exec-wave-label` ("Wave N").
   - For each milestone in the wave, render a `.exec-milestone-group` containing:
     - `.exec-milestone-header` with milestone title and a summary status badge.
     - `.exec-action-list` with `.exec-action-item` for each action.
   - Each action item gets:
     - A `.exec-status-dot` with class based on status: if action status is DONE/KEPT/HONORED → 'done', if actionId is in `runningActions` set → 'running', if action status includes failure indicators → 'failed', else → 'queued'.
     - `.exec-action-title` showing "A-XX: title".
     - `.exec-action-status-label` showing the status text.
   - Store `data-action-id` on each `.exec-action-item` for click handling (used by A-104).
   - Store `data-milestone-id` on each `.exec-milestone-group`.

4. Update `switchView()` to handle the 'execution' mode:
   ```js
   function switchView(mode) {
     viewMode = mode;
     localStorage.setItem('declare-view-mode', mode);

     // Hide all views first
     $canvasWrap.style.display = 'none';
     $colBrowser.classList.remove('active');
     if ($readinessBanner) $readinessBanner.classList.remove('active');
     if ($execView) $execView.classList.remove('active');

     if (mode === 'dag') {
       $canvasWrap.style.display = '';
       clearColumnBrowserKbFocus();
       if ($viewToggle) {
         $viewToggle.classList.remove('active');
         $viewToggleLabel.textContent = 'Columns';
       }
       requestAnimationFrame(() => drawEdges());
     } else if (mode === 'columns') {
       if (focusNodeId) exitFocusMode();
       $colBrowser.classList.add('active');
       if ($viewToggle) {
         $viewToggle.classList.add('active');
         $viewToggleLabel.textContent = 'Graph';
       }
       renderColumnBrowser();
       initColumnBrowserKbFocus();
     } else if (mode === 'execution') {
       if (focusNodeId) exitFocusMode();
       if ($execView) $execView.classList.add('active');
       if ($viewToggle) {
         $viewToggle.classList.add('active');
         $viewToggleLabel.textContent = 'Columns';
       }
       renderExecutionView();
     }
   }
   ```

5. Update the view toggle button click handler (around line ~4447) to cycle through three modes: columns -> execution -> dag -> columns. Or simpler: make the "Play All" button switch to execution mode when clicked, and add a small "Exit" button in the execution view to go back to columns. For now, add the cycling: if columns, go to dag; if dag, go to execution; if execution, go to columns. Update toggle label accordingly.

6. Wire SSE events to refresh the execution view: in the existing `handlePlayStart`, `handlePlayWaveStart`, `handlePlayWaveComplete`, and `handleActionComplete` handlers, add a call to `renderExecutionView()` if `viewMode === 'execution'` so the pipeline updates live.

7. Auto-switch to execution mode when play starts: in `handlePlayStart`, call `switchView('execution')` so the user automatically enters execution mode when play begins.
  </action>
  <verify>
Open the dashboard in a browser. Click the view toggle to cycle to "Execution" mode. Verify the execution view appears with milestones grouped by wave, actions nested beneath with status dots (gray for queued, green for done). Verify the pipeline has connecting lines (border-left). Verify switching back to columns/dag works correctly.
  </verify>
  <done>
Execution view renders milestones and actions in wave-ordered vertical pipeline layout. Status dots show correct colors for queued/running/done/failed. View toggle cycles through all three modes. Pipeline auto-renders when play starts.
  </done>
</task>

</tasks>

<verification>
- `viewMode = 'execution'` activates `#execution-view` and hides column browser + DAG
- Pipeline shows milestones in dependency-wave order with nested actions
- Status indicators use correct colors: gray (queued), blue-pulse (running), green (done), red (failed)
- CSS connecting lines visible between pipeline stages
- SSE events trigger re-render of execution view when play is active
- View toggle cycles through dag/columns/execution without errors
</verification>

<success_criteria>
The execution pipeline view is a fully functional third viewMode showing milestones and actions in a CI-pipeline vertical layout with live status updates via SSE.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-103-SUMMARY.md`
</output>
