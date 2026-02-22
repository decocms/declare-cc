---
milestone: M-39-tri-part-column-browser-for-d-m-a-navigation
action: A-82
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
  - dist/public/index.html
  - dist/public/app.js
autonomous: true
declarations:
  - D-06

must_haves:
  truths:
    - "A three-column Finder-style browser is rendered inside #column-browser, hidden by default"
    - "Clicking a declaration in column 1 populates column 2 with its milestones"
    - "Clicking a milestone in column 2 populates column 3 with its actions"
    - "Clicking an action in column 3 opens the existing detail panel via renderPanelChain + loadExecPlan"
    - "Selected items are visually highlighted in each column"
    - "Each column item shows ID, title, status badge, and wholeness indicator"
    - "The existing DAG view is completely unaffected"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "Column browser container HTML and CSS styles"
      contains: "id=\"column-browser\""
    - path: "src/server/public/app.js"
      provides: "renderColumnBrowser function and column click handlers"
      contains: "function renderColumnBrowser"
    - path: "dist/public/index.html"
      provides: "Production copy of index.html"
    - path: "dist/public/app.js"
      provides: "Production copy of app.js"
  key_links:
    - from: "src/server/public/app.js renderColumnBrowser"
      to: "graphData.declarations / graphData.milestones / graphData.actions"
      via: "reuses existing graphData state — no new API calls"
      pattern: "graphData\\.(declarations|milestones|actions)"
    - from: "column action click"
      to: "selectNode / renderPanelChain / loadExecPlan"
      via: "calls existing selectNode(actionId, 'action')"
      pattern: "selectNode\\("
---

<objective>
Build a three-column Finder-style browser as an alternative view to the layered DAG.

Purpose: Provide a linear, scannable D->M->A navigation that lets users drill down through declarations, milestones, and actions without the spatial complexity of the graph view. This is column 1 of M-39 (the toggle comes in A-84).

Output: New `#column-browser` container (hidden by default) with full column-click navigation, reusing existing graphData and side panel rendering.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-39-tri-part-column-browser-for-d-m-a-navigation/PLAN.md
@src/server/public/index.html
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add column browser HTML container and CSS styles</name>
  <files>src/server/public/index.html</files>
  <action>
Add CSS styles and a new HTML container for the column browser. This is additive — do NOT modify any existing HTML or CSS.

**CSS (add before the closing `</style>` tag):**

```css
/* ── Column browser ── */
#column-browser {
  display: none; /* hidden by default, A-84 adds toggle */
  width: 100%;
  height: 100%;
  padding-right: var(--panel-width);
}

#column-browser.active {
  display: flex;
}

.col-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  padding: 12px 0;
}
.col-panel:last-child { border-right: none; }

.col-panel-header {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 0 16px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.col-item {
  padding: 10px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.12s;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.col-item:hover { background: var(--surface2); }
.col-item.col-selected {
  background: var(--surface2);
  border-left-color: currentColor;
}

.col-item-id {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  opacity: 0.6;
}
.col-item-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-bright);
  line-height: 1.35;
}
.col-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

/* Column items inherit type coloring via parent class */
.col-panel-decl .col-item { color: var(--decl-color); }
.col-panel-mile .col-item { color: var(--mile-color); }
.col-panel-act .col-item  { color: var(--act-color); }

.col-panel-decl .col-item.col-selected { border-left-color: var(--decl-color); }
.col-panel-mile .col-item.col-selected { border-left-color: var(--mile-color); }
.col-panel-act .col-item.col-selected  { border-left-color: var(--act-color); }

/* Wholeness indicators on column items */
.col-item.wholeness-whole   .col-item-id::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--wholeness-whole); margin-right: 5px; vertical-align: middle; }
.col-item.wholeness-partial .col-item-id::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--wholeness-partial); margin-right: 5px; vertical-align: middle; }
.col-item.wholeness-broken  .col-item-id::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--wholeness-broken); margin-right: 5px; vertical-align: middle; }

.col-empty {
  padding: 20px 16px;
  color: var(--text-dim);
  font-size: 12px;
  opacity: 0.5;
  font-style: italic;
}

/* Scrollbar for column panels */
.col-panel::-webkit-scrollbar { width: 4px; }
.col-panel::-webkit-scrollbar-track { background: transparent; }
.col-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
```

**HTML (add inside `#main`, directly after `#canvas-wrap` closing div, before the `#main` closing div):**

```html
<!-- Column browser — Finder-style D→M→A navigation (hidden until toggled) -->
<div id="column-browser">
  <div class="col-panel col-panel-decl" id="col-declarations">
    <div class="col-panel-header">Declarations</div>
    <div id="col-decl-list"></div>
  </div>
  <div class="col-panel col-panel-mile" id="col-milestones">
    <div class="col-panel-header">Milestones</div>
    <div id="col-mile-list"></div>
  </div>
  <div class="col-panel col-panel-act" id="col-actions">
    <div class="col-panel-header">Actions</div>
    <div id="col-act-list"></div>
  </div>
</div>
```
  </action>
  <verify>
Open `src/server/public/index.html` and verify:
1. `#column-browser` div exists inside `#main`
2. Three `.col-panel` children exist with IDs `col-declarations`, `col-milestones`, `col-actions`
3. CSS for `#column-browser`, `.col-panel`, `.col-item`, `.col-selected` is present
4. All existing DAG HTML (`#canvas-wrap`, layers, edges-svg) is untouched
  </verify>
  <done>
HTML contains `#column-browser` with three column panels. CSS provides layout (flex, overflow-y scroll, border-right separators), item styles (hover, selected highlight, type coloring), and wholeness dot indicators. Existing DAG markup and styles are unmodified.
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement renderColumnBrowser with click-to-drill navigation</name>
  <files>src/server/public/app.js, dist/public/index.html, dist/public/app.js</files>
  <action>
Add a `renderColumnBrowser()` function and supporting column state to app.js. This function reads from the existing `graphData` object — no new fetch calls.

**1. Add DOM refs (near the existing DOM refs section):**

```js
const $colBrowser = document.getElementById('column-browser');
const $colDeclList = document.getElementById('col-decl-list');
const $colMileList = document.getElementById('col-mile-list');
const $colActList  = document.getElementById('col-act-list');
```

**2. Add column selection state (near existing state vars):**

```js
/** @type {string | null} Currently selected declaration in column browser */
let colSelectedDecl = null;
/** @type {string | null} Currently selected milestone in column browser */
let colSelectedMile = null;
```

**3. Add `renderColumnBrowser()` function (place after `renderGraph` or in a new "Column browser" section):**

The function must:

a) **Populate column 1 (Declarations):** Iterate `graphData.declarations`, compute derived status using `deriveDeclarationStatus` (reuse the existing enriched milestone computation from `renderGraph`). For each declaration, create a `.col-item` div with:
   - `.col-item-id` span showing `item.id`
   - `.col-item-title` span showing truncated title (55 chars)
   - `.col-item-meta` with a `<span class="status-badge">` showing the derived status
   - Add `wholeness-{whole|partial|broken}` class to `.col-item` if `item.wholeness` is set
   - On click: set `colSelectedDecl = id`, clear `colSelectedMile`, re-render columns 2 and 3

b) **Populate column 2 (Milestones):** If `colSelectedDecl` is set, filter milestones where `m.realizes` includes the selected declaration. For each, compute derived status via `deriveMilestoneStatus`. Create `.col-item` with same pattern as above (ID, title, status badge, wholeness class, progress count for milestones with actions). On click: set `colSelectedMile = id`, re-render column 3.
   - If no declaration selected: show `.col-empty` with "Select a declaration".

c) **Populate column 3 (Actions):** If `colSelectedMile` is set, filter actions where `a.causes` includes the selected milestone. Create `.col-item` for each. On click: call `selectNode(actionId, 'action')` to open the existing side panel with full detail + exec-plan rendering. Also add `is-running` class to items where `runningActions.has(actionId)`.
   - If no milestone selected: show `.col-empty` with "Select a milestone".

d) **Highlight selected items:** Add `col-selected` class to the currently selected declaration and milestone items.

e) **Auto-select first:** When a declaration is clicked and column 2 populates, do NOT auto-select a milestone (let user choose). Same for column 3.

**4. Call `renderColumnBrowser()` at the end of `loadData()`** (after `renderGraph()` call), so column browser stays in sync on SSE updates. Guard with `if ($colBrowser)` in case DOM not ready.

**5. Also call `renderColumnBrowser()` inside `renderGraph()`** is NOT needed — calling it once in `loadData()` after `renderGraph()` is sufficient since both use the same `graphData`.

**6. When a column action is clicked**, call `selectNode(actionId, 'action')` which already handles the side panel chain rendering and exec-plan loading. For milestone clicks in the column browser, ALSO call `selectNode(milestoneId, 'milestone')` so the side panel shows milestone details. For declaration clicks, call `selectNode(declId, 'declaration')`.

**7. Copy both files to dist/public/ after editing:**

```bash
cp src/server/public/index.html dist/public/index.html
cp src/server/public/app.js dist/public/app.js
```

**Important constraints:**
- Do NOT modify `renderGraph()`, `buildNodeEl()`, `drawEdges()`, or any focus-mode code
- Do NOT add any new fetch/API calls
- Do NOT make `#column-browser` visible by default (it stays `display:none` until A-84 adds the toggle)
- The column browser must work correctly when manually activated (e.g., via dev tools adding `.active` class to `#column-browser` and hiding `#canvas-wrap`)
  </action>
  <verify>
1. `grep -n "function renderColumnBrowser" src/server/public/app.js` — function exists
2. `grep -n "colSelectedDecl" src/server/public/app.js` — state vars exist
3. `grep -n "renderColumnBrowser" src/server/public/app.js` — called from loadData
4. `diff src/server/public/app.js dist/public/app.js` — files are identical
5. `diff src/server/public/index.html dist/public/index.html` — files are identical
6. Start server (`node dist/declare-tools.cjs serve`), open browser, use dev tools to add `.active` class to `#column-browser` and set `#canvas-wrap` to `display:none`. Verify:
   - All declarations appear in column 1
   - Clicking a declaration populates column 2 with its milestones
   - Clicking a milestone populates column 3 with its actions
   - Clicking an action opens the side panel with full details
   - Selected items are highlighted with left border
  </verify>
  <done>
`renderColumnBrowser()` function exists and is called on each data load. Column 1 lists all declarations with derived status. Column 2 filters milestones by selected declaration. Column 3 filters actions by selected milestone. Clicking any item updates selection state, highlights the item, and triggers `selectNode()` for side panel rendering. Files are copied to dist/public/. Existing DAG view code is unmodified.
  </done>
</task>

</tasks>

<verification>
1. Existing DAG view renders identically to before (no regressions)
2. Column browser container exists in HTML but is hidden (`display:none`)
3. When manually activated via dev tools (`.active` class), the three-column layout fills the viewport minus the side panel width
4. Full drill-down flow works: Declaration click -> Milestones appear -> Milestone click -> Actions appear -> Action click -> Side panel shows details + exec-plan
5. Status badges and wholeness indicators render correctly in all three columns
6. Column browser re-renders correctly on SSE data updates
</verification>

<success_criteria>
- `renderColumnBrowser` function exists and is wired into the data load cycle
- Three-column layout renders with proper CSS (flex, scrollable, type-colored)
- Click-to-drill navigation works across all three columns
- Side panel integration works via existing `selectNode` / `renderPanelChain` / `loadExecPlan`
- Zero modifications to existing DAG rendering, focus mode, or edge drawing code
- src/ and dist/ copies are in sync
</success_criteria>

<output>
After completion, create `.planning/milestones/M-39-tri-part-column-browser-for-d-m-a-navigation/A-82-SUMMARY.md`
</output>
