---
milestone: M-39-tri-part-column-browser-for-d-m-a-navigation
action: A-83
type: execute
wave: 2
depends_on: ["A-82"]
files_modified:
  - src/server/public/app.js
autonomous: true
declarations: ["D-06"]

must_haves:
  truths:
    - "Arrow left/right moves focus between Declaration, Milestone, and Action columns"
    - "Arrow up/down moves selection within the currently focused column"
    - "Enter key selects/expands the focused item (triggers selectNode)"
    - "Escape key moves focus back one column level (A->M->D) or exits column browser"
    - "A visible focus ring always indicates which item has keyboard focus"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Keyboard navigation handler for column browser"
      contains: "handleColumnKeydown"
  key_links:
    - from: "keyboard handler"
      to: "column browser DOM"
      via: "keydown event on document scoped to column browser active state"
      pattern: "addEventListener.*keydown"
    - from: "focus ring"
      to: "column browser items"
      via: "CSS class toggled on keyboard navigation"
      pattern: "kb-focus"
---

<objective>
Add full keyboard navigation to the tri-part column browser built in A-82.

Purpose: Makes the column browser navigable without a mouse — arrow keys move between and within D/M/A columns, Enter selects, Escape goes back.
Output: Updated app.js with keyboard handler integrated into column browser mode.
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
  <name>Task 1: Implement keyboard navigation state and handler</name>
  <files>src/server/public/app.js</files>
  <action>
Add keyboard navigation state and handler to app.js, activated only when the column browser view is active (not the DAG view). The implementation needs:

1. **State variables** at module level:
   - `kbColumn` (0=declarations, 1=milestones, 2=actions) — which column has keyboard focus
   - `kbIndex` (number) — which item index within the focused column has keyboard focus

2. **CSS class `kb-focus`** — applied to exactly one item in the column browser at a time. Style it with a 2px solid ring in the column's type color (decl/mile/act) using `outline` (not box-shadow, to avoid conflict with selected state). Add the CSS rule either inline via JS or by appending to the style block.

3. **`handleColumnKeydown(e)` function** bound to `document.addEventListener('keydown', ...)` — only processes keys when column browser is the active view mode:
   - **ArrowRight**: Move `kbColumn` from 0->1->2 (clamp at 2). When moving right, set `kbIndex` to 0 or to the index of the first child of the currently focused item (if the column browser tracks parent-child relationships). Call `updateKbFocus()`.
   - **ArrowLeft**: Move `kbColumn` from 2->1->0 (clamp at 0). Set `kbIndex` to the index of the parent item if determinable, else 0. Call `updateKbFocus()`.
   - **ArrowDown**: Increment `kbIndex` within current column, wrapping to 0 at end. Call `updateKbFocus()`.
   - **ArrowUp**: Decrement `kbIndex` within current column, wrapping to end at 0. Call `updateKbFocus()`.
   - **Enter**: Call `selectNode()` on the currently kb-focused item (same as click behavior). This triggers the column browser's drill-down/detail panel.
   - **Escape**: If `kbColumn > 0`, move left one column (same as ArrowLeft). If `kbColumn === 0`, optionally deselect or do nothing.
   - Prevent default on all handled arrow keys to avoid page scrolling.

4. **`updateKbFocus()` function**:
   - Remove `.kb-focus` from all elements.
   - Find the correct column container in the column browser DOM (the three column `<div>`s rendered by A-82).
   - Find the Nth child item (`kbIndex`) in that column.
   - Add `.kb-focus` class to it.
   - Call `el.scrollIntoView({ block: 'nearest' })` to ensure visibility if the column scrolls.

5. **Integration with column browser activation**: When the column browser view becomes active (toggled on), set `kbColumn = 0, kbIndex = 0` and call `updateKbFocus()`. When toggled off (back to DAG), remove all `.kb-focus` classes.

6. **Integration with mouse clicks**: When a user clicks an item in the column browser, update `kbColumn` and `kbIndex` to match the clicked item so keyboard and mouse stay in sync.

IMPORTANT: Do NOT break the existing DAG view keyboard handler (ArrowLeft/Right for declaration cycling, Escape for focus mode exit). Guard all column browser keyboard handling behind a check that the column browser is the active view. The existing `document.addEventListener('keydown', ...)` near line 1563 must remain untouched — add the new handler separately and have it return early if column browser is not active.
  </action>
  <verify>
Open the dashboard in a browser with the column browser active. Press arrow keys — focus ring moves between items and columns. Press Enter — item detail loads in side panel. Press Escape — focus moves back one column. No console errors.
  </verify>
  <done>
All five keyboard bindings (left, right, up, down, enter, escape) work in the column browser. Focus ring is always visible on exactly one item. Mouse clicks update keyboard focus position. DAG view keyboard shortcuts still work when DAG view is active.
  </done>
</task>

</tasks>

<verification>
1. Start server: `node dist/declare-tools.cjs serve`
2. Open browser to http://localhost:3847
3. Switch to column browser view (toggle from A-84 or however A-82 exposes it)
4. Verify ArrowDown/ArrowUp cycles through items in current column
5. Verify ArrowRight/ArrowLeft moves between columns
6. Verify Enter triggers item selection (side panel updates)
7. Verify Escape moves back one column
8. Verify visible focus ring on the active item at all times
9. Switch back to DAG view — verify Escape and arrow keys work as before
</verification>

<success_criteria>
Column browser is fully keyboard-navigable. Arrow keys move within and between D/M/A columns. Enter selects. Escape goes back. Focus ring always visible. No regression in DAG view keyboard behavior.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-39-tri-part-column-browser-for-d-m-a-navigation/A-83-SUMMARY.md`
</output>
