---
milestone: M-39-tri-part-column-browser-for-d-m-a-navigation
action: A-84
type: execute
wave: 2
depends_on: ["A-82"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations: ["D-06"]

must_haves:
  truths:
    - "A toggle button is visible in the status bar near the Refresh button"
    - "Clicking the toggle switches between DAG view and column browser view"
    - "The selected view preference persists across page reloads via localStorage"
    - "The DAG view remains fully functional (edges, focus mode, node selection)"
    - "The column browser remains fully functional (three columns, drill-down, detail panel)"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "Toggle button element in status bar"
      contains: "view-toggle"
    - path: "src/server/public/app.js"
      provides: "View switching logic and localStorage persistence"
      contains: "localStorage.*viewMode"
  key_links:
    - from: "toggle button click"
      to: "view mode state"
      via: "event listener toggles viewMode variable and localStorage"
      pattern: "view-toggle.*click"
    - from: "viewMode state"
      to: "DOM visibility"
      via: "show/hide canvas-container vs column-browser-container"
      pattern: "display.*none|block"
---

<objective>
Add a toggle control that switches between the existing layered DAG view and the column browser from A-82.

Purpose: Users can choose their preferred navigation style. The DAG gives a bird's-eye overview; the column browser gives focused drill-down navigation. Both stay fully functional.
Output: Toggle button in status bar, localStorage-persisted view preference, both views work correctly.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-39-tri-part-column-browser-for-d-m-a-navigation/PLAN.md
@.planning/milestones/M-39-tri-part-column-browser-for-d-m-a-navigation/A-82-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add toggle button to status bar HTML</name>
  <files>src/server/public/index.html</files>
  <action>
Add a toggle button element in the status bar (`#status-bar`), positioned between the `#last-updated` span and the `#refresh-btn` button (so it appears in the top-right area near Refresh).

The button markup:
```html
<button id="view-toggle" title="Switch view">
  <span id="view-toggle-label">Columns</span>
</button>
```

Style the button to match `#refresh-btn` styling — same background (`var(--surface2)`), border (`1px solid var(--border)`), color (`var(--text)`), padding (`5px 14px`), border-radius (`6px`), font-size (`12px`), hover/active states. Add a subtle icon indicator: when DAG is active the label says "Columns" (to switch to columns), when column browser is active the label says "Graph" (to switch back).

Add CSS for the active state:
```css
#view-toggle.active {
  background: var(--decl-bg);
  border-color: var(--decl-border);
  color: var(--decl-color);
}
```
  </action>
  <verify>Open index.html — toggle button visible in status bar next to Refresh button, styled consistently.</verify>
  <done>Toggle button present in status bar with matching visual style.</done>
</task>

<task type="auto">
  <name>Task 2: Implement view switching logic with localStorage persistence</name>
  <files>src/server/public/app.js</files>
  <action>
Add view mode management to app.js:

1. **State variable** at module level:
   ```js
   let viewMode = localStorage.getItem('declare-view-mode') || 'dag'; // 'dag' | 'columns'
   ```

2. **`switchView(mode)` function**:
   - Set `viewMode = mode` and `localStorage.setItem('declare-view-mode', mode)`.
   - If `mode === 'dag'`:
     - Show `#canvas-container` (the existing DAG layers + edges SVG).
     - Hide the column browser container (whatever A-82 created — likely a sibling element inside `#canvas-wrap` or `#main`).
     - Update toggle button: remove `.active` class, set label text to "Columns".
     - Re-draw edges with `requestAnimationFrame(() => drawEdges())` since layout changed.
   - If `mode === 'columns'`:
     - Hide `#canvas-container`.
     - Show the column browser container.
     - Update toggle button: add `.active` class, set label text to "Graph".
     - If the column browser has a render/refresh function from A-82, call it to ensure data is current.
   - Clear any focus-mode state when switching (call `exitFocusMode()` if `focusNodeId` is set).
   - Clear keyboard focus state if switching away from columns.

3. **Toggle button event listener**:
   ```js
   document.getElementById('view-toggle').addEventListener('click', () => {
     switchView(viewMode === 'dag' ? 'columns' : 'dag');
   });
   ```

4. **On page load (bootstrap section)**: After `loadData()` completes, call `switchView(viewMode)` to apply the persisted preference. This ensures the correct view is shown on initial load without a flash of the wrong view.

5. **Integration with data reload**: In `loadData()`, after rendering, check `viewMode` — if `'columns'`, also trigger the column browser's data refresh. Both views should always reflect current data even if hidden, so toggling back shows fresh state.

IMPORTANT: The DAG view's `renderGraph()`, `drawEdges()`, focus mode, and all existing functionality must remain completely untouched. Only add show/hide logic via `display: none` / `display: ''` on the container elements. Do NOT remove or recreate DOM elements on toggle.
  </action>
  <verify>
1. Start server, open dashboard.
2. Click toggle — view switches from DAG to column browser.
3. Click toggle again — switches back to DAG with all edges and nodes intact.
4. Reload page — last selected view is restored from localStorage.
5. In DAG view: click nodes, focus mode, edges all work normally.
6. In column browser: all A-82 functionality works.
  </verify>
  <done>
Toggle button switches between DAG and column browser. Preference persists in localStorage across reloads. Both views are fully functional after any number of toggles. No regressions in either view.
  </done>
</task>

</tasks>

<verification>
1. `node dist/declare-tools.cjs serve` — server starts
2. Open http://localhost:3847 — default view loads (DAG on first visit)
3. Toggle button visible in status bar near Refresh
4. Click toggle — column browser appears, DAG hides
5. Click toggle — DAG reappears with edges drawn correctly
6. Select a node in DAG, toggle to columns, toggle back — selection state preserved
7. Close tab, reopen — view preference restored from localStorage
8. Clear localStorage, reload — defaults to DAG view
</verification>

<success_criteria>
Toggle button in status bar switches between DAG and column browser. localStorage persists the choice. Both views fully functional at all times. No visual glitches on toggle (edges redraw correctly, columns populate correctly).
</success_criteria>

<output>
After completion, create `.planning/milestones/M-39-tri-part-column-browser-for-d-m-a-navigation/A-84-SUMMARY.md`
</output>
