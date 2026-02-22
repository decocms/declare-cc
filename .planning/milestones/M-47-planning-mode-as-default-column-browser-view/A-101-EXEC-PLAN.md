---
milestone: M-47-planning-mode-as-default-column-browser-view
action: A-101
type: execute
wave: 1
depends_on: []
files_modified: [src/server/public/app.js, src/server/public/index.html]
autonomous: true
declarations: ["D-14"]

must_haves:
  truths:
    - "A readiness banner is visible above the column browser showing 'N/M plans approved, X need review'"
    - "Clicking an unapproved node ID in the banner navigates to that node in the column browser"
    - "Banner updates live when reviewState changes via SSE refresh"
    - "Banner disappears or shows 'All approved' when every node is approved"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "renderReadinessBanner() function and integration into renderColumnBrowser()"
      contains: "renderReadinessBanner"
    - path: "src/server/public/index.html"
      provides: "Banner container element above column browser"
      contains: "readiness-banner"
  key_links:
    - from: "renderReadinessBanner()"
      to: "graphData nodes"
      via: "counts nodes with reviewState === 'approved'"
      pattern: "reviewState.*approved"
    - from: "readiness banner click"
      to: "selectNode()"
      via: "click handler on unapproved node links"
      pattern: "selectNode"
    - from: "SSE refresh"
      to: "renderReadinessBanner()"
      via: "called inside renderColumnBrowser() which runs on refreshGraph()"
      pattern: "renderReadinessBanner"
---

<objective>
Add a global readiness indicator banner to the planning (column browser) view showing how many plans are approved and which need review.

Purpose: Gives the planner an at-a-glance view of review progress across all nodes, with direct navigation to items needing attention.
Output: Readiness banner above column browser, live-updating via SSE.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/public/app.js (line 733 — renderColumnBrowser, line 159 — REVIEW_CYCLE, line 161 — reviewBadgeHtml)
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add readiness banner container to HTML and implement renderReadinessBanner()</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**In index.html:** Add a `<div id="readiness-banner" class="readiness-banner"></div>` element directly above the column browser container (`#col-browser`). It should be inside the same parent so it's visible only when column browser is active.

**In app.js:** Create a `renderReadinessBanner()` function. Place it near the renderColumnBrowser() function (around line 733). Logic:

1. Get all reviewable nodes from graphData: concatenate declarations, milestones, and actions arrays.
2. Count total nodes and nodes where `reviewState === 'approved'`.
3. Collect unapproved nodes (reviewState !== 'approved') — these are "need review" items.
4. Build banner HTML:
   - If all approved: `<span class="rb-complete">All N nodes approved</span>` with a green/success style
   - Otherwise: `<span class="rb-progress">N/M approved</span> <span class="rb-remaining">X need review:</span>` followed by clickable node ID links
5. For the clickable links, render each unapproved node as `<a class="rb-link" data-node-id="{id}" data-node-type="{type}">{id}</a>`. Limit to first 8 unapproved nodes to avoid overflow; if more, append `"+ Y more"`.
6. Set `$readinessBanner.innerHTML = bannerHtml`.

Wire click handlers on `.rb-link` elements: extract `data-node-id` and `data-node-type`, call `selectNode(nodeId, type)`. For milestones and actions, also update `colSelectedDecl` and `colSelectedMile` appropriately to navigate the column browser (same pattern used in topbar click handler around line 4020).

**Determine node type:** Check if ID starts with 'D-' (declaration), 'M-' (milestone), or 'A-' (action). This matches existing ID conventions.

**Call renderReadinessBanner()** at the end of `renderColumnBrowser()` (after line 891, before the keyboard focus restore). This ensures the banner updates on every SSE-triggered refresh.

**Add CSS** (inline in app.js via a style injection, matching the existing pattern at line 896, or in index.html style block):
```css
.readiness-banner {
  padding: 8px 16px;
  background: var(--surface1);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  display: none; /* shown only when column browser is active */
}
#col-browser.active ~ .readiness-banner,
.readiness-banner.active { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.rb-progress { font-weight: 600; }
.rb-complete { color: var(--done-color); font-weight: 600; }
.rb-link { color: var(--act-color); cursor: pointer; text-decoration: underline; margin: 0 2px; }
.rb-link:hover { opacity: 0.8; }
```

Note: The exact CSS selector depends on DOM structure. If the banner is INSIDE the `#col-browser` div, toggle its display in `renderReadinessBanner()` based on whether column browser is active. Simpler approach: just always render it, and show/hide it in `switchView()` — add `$readinessBanner.style.display = mode === 'columns' ? '' : 'none'` in switchView().

Grab the DOM ref at the top of app.js near the other `const $` declarations (around line 111): `const $readinessBanner = document.getElementById('readiness-banner');`
  </action>
  <verify>
1. `grep "renderReadinessBanner" src/server/public/app.js` — function exists and is called
2. `grep "readiness-banner" src/server/public/index.html` — container exists
3. Start server, open dashboard — banner visible above columns showing "N/M approved, X need review"
4. Click a review badge to change state to approved — banner updates on next SSE refresh
5. Click an unapproved node link in banner — column browser navigates to that node
  </verify>
  <done>Readiness banner shows accurate count of approved vs total nodes. Clicking unapproved node IDs navigates to them. Banner updates live when review states change.</done>
</task>

</tasks>

<verification>
1. Banner visible in column browser view, hidden in DAG view
2. Counts match actual reviewState data in graph
3. Clicking node links navigates correctly for all three node types (D-, M-, A-)
4. After approving all nodes, banner shows "All N nodes approved" with success styling
5. SSE refresh updates banner without page reload
</verification>

<success_criteria>
Planning view shows persistent readiness banner with accurate approval counts and clickable navigation to unapproved nodes. Updates live via SSE.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-47-planning-mode-as-default-column-browser-view/A-101-SUMMARY.md`
</output>
