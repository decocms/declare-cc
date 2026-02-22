---
milestone: M-47-planning-mode-as-default-column-browser-view
action: A-100
type: execute
wave: 1
depends_on: []
files_modified: [src/server/public/app.js]
autonomous: true
declarations: ["D-14"]

must_haves:
  truths:
    - "Dashboard opens in column browser mode on first load (no localStorage set)"
    - "DAG view is available via toggle button"
    - "User who previously chose DAG still sees DAG (localStorage respected)"
    - "Toggle label reads 'Graph' when in columns mode, 'Columns' when in DAG mode"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Default viewMode changed from 'dag' to 'columns'"
      contains: "|| 'columns'"
  key_links:
    - from: "viewMode initialization (line 48)"
      to: "switchView(viewMode) call (line 257)"
      via: "localStorage fallback default"
      pattern: "localStorage.getItem.*declare-view-mode.*\\|\\|.*columns"
---

<objective>
Make column browser the default view when the dashboard loads for the first time.

Purpose: Planning mode (column browser) should be the primary UX surface per D-14. The DAG view remains accessible via toggle for users who prefer it.
Output: Modified app.js with default viewMode changed from 'dag' to 'columns'.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/public/app.js (line 48 — viewMode default, line 257 — switchView call)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change default viewMode from 'dag' to 'columns'</name>
  <files>src/server/public/app.js</files>
  <action>
On line 48 of app.js, change the localStorage fallback default from 'dag' to 'columns':

Before: `let viewMode = localStorage.getItem('declare-view-mode') || 'dag';`
After:  `let viewMode = localStorage.getItem('declare-view-mode') || 'columns';`

This is the ONLY change needed. The existing switchView() function (line 3970) already handles both modes correctly — it shows/hides the canvas wrapper, toggles the column browser active class, and updates the toggle label text. The localStorage persistence (line 3972) ensures users who explicitly switch to DAG will keep their preference.

Do NOT change any other viewMode logic. The toggle button (line 4059) already works bidirectionally. The SSE refresh path (line 257) already calls switchView(viewMode) which will now default to columns.
  </action>
  <verify>
1. `grep "|| 'columns'" src/server/public/app.js` — confirms the default changed
2. `grep -c "|| 'dag'" src/server/public/app.js` — should return 0 (no remaining dag defaults)
3. Start server, open dashboard in incognito/private window (no localStorage), confirm column browser is shown by default
  </verify>
  <done>Fresh browser load (no localStorage) opens column browser. Toggle switches to DAG and back. Returning user with localStorage preference for DAG still sees DAG.</done>
</task>

<task type="auto">
  <name>Task 2: Update toggle button label for columns-default state</name>
  <files>src/server/public/app.js</files>
  <action>
Verify that the view toggle button's initial label is correct when columns is the default. Currently the toggle label is set in switchView() (lines 3980 and 3991), but the INITIAL render of the toggle button in index.html may have a hardcoded label.

Search for the toggle button's initial HTML in index.html. If the label text says "Columns" (implying DAG is active), change it to "Graph" (since columns is now the default active view). The switchView() call on line 257 will also set it correctly on data load, but the initial HTML should match to avoid a flash of wrong text.

Also check that the $viewToggle element gets the 'active' class initially when columns is the default — if it's not set in HTML, the switchView(viewMode) call on line 257 handles it, so this should be fine. Confirm by reading the toggle initialization code.
  </action>
  <verify>
1. Check index.html toggle button label matches columns-default state
2. No flash of "Columns" label before switchView corrects it
  </verify>
  <done>Toggle button shows "Graph" on initial load (indicating click will switch to graph/DAG view). No label flash on page load.</done>
</task>

</tasks>

<verification>
1. Open dashboard in incognito — column browser visible, toggle says "Graph"
2. Click toggle — DAG view appears, toggle says "Columns"
3. Refresh — DAG persists (localStorage)
4. Clear localStorage, refresh — back to columns default
</verification>

<success_criteria>
Column browser is the default view on fresh dashboard load. DAG remains one click away. Existing user preferences preserved via localStorage.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-47-planning-mode-as-default-column-browser-view/A-100-SUMMARY.md`
</output>
