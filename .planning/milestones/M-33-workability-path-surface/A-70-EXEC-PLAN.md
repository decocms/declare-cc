---
milestone: M-33-workability-path-surface
action: A-70
type: execute
wave: 2
depends_on: ["A-69"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
  - dist/public/app.js
  - dist/public/index.html
autonomous: true
declarations: ["D-10"]
must_haves:
  truths:
    - "When a non-whole node is selected, the detail panel shows a 'Path to wholeness' section with fix steps"
    - "Fix steps are sorted by impact (highest first)"
    - "Each fix step shows action ID (clickable), title, parent milestone, and impact badge"
    - "The section header shows the step count: 'Path to wholeness (N steps)'"
    - "When a node is whole, no path section appears"
    - "When the API fetch fails or returns empty, the section degrades gracefully"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "renderWorkabilityPath function and integration into panel rendering"
      contains: "renderWorkabilityPath"
    - path: "src/server/public/index.html"
      provides: "CSS styles for workability path list and impact badges"
      contains: "workability"
    - path: "dist/public/app.js"
      provides: "Production copy of app.js"
    - path: "dist/public/index.html"
      provides: "Production copy of index.html"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/workability/:id"
      via: "fetch call in renderWorkabilityPath"
      pattern: "fetch.*api/workability"
    - from: "src/server/public/app.js"
      to: "selectNode"
      via: "click handler on action ID tags in fix steps"
      pattern: "selectNode.*action"
---

<objective>
Add a "Path to wholeness" panel section to the dashboard that shows actionable fix steps when a selected node has diminished integrity.

Purpose: Surfaces the workability path computation (A-69) in the UI so users can see exactly which actions need completing to restore a node's integrity.
Output: Updated app.js and index.html with workability path rendering, copied to dist/public/.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-33-workability-path-surface/PLAN.md
@.planning/milestones/M-33-workability-path-surface/A-69-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add workability path styles and render function</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**In index.html**, add CSS styles before the closing `</style>` tag for the workability path section:

```css
/* Workability path section */
.workability-path { margin-top: 4px; }
.workability-path .wp-header {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px;
}
.wp-step {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 10px; border-radius: 6px;
  background: var(--surface2); border: 1px solid var(--border);
  margin-bottom: 6px; font-size: 12px;
}
.wp-step-action {
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
  color: var(--act-color); cursor: pointer; white-space: nowrap;
  flex-shrink: 0;
}
.wp-step-action:hover { text-decoration: underline; }
.wp-step-body { flex: 1; min-width: 0; }
.wp-step-title {
  color: var(--text-bright); font-size: 12px; font-weight: 500;
  line-height: 1.35; margin-bottom: 3px;
}
.wp-step-milestone {
  font-size: 10px; color: var(--text-dim); opacity: 0.7;
}
.wp-impact {
  display: inline-block; padding: 1px 7px; border-radius: 8px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; flex-shrink: 0; margin-top: 1px;
}
.wp-impact.impact-high   { background: #2a0a10; color: var(--broken-color); border: 1px solid #5a1520; }
.wp-impact.impact-medium { background: #1a1200; color: var(--integrity-partial); border: 1px solid #3d2c00; }
.wp-impact.impact-low    { background: #0a2018; color: var(--integrity-whole); border: 1px solid #1a4d34; }
```

**In app.js**, add a new async function `renderWorkabilityPath(nodeId, nodeType)` that:

1. Fetches `GET /api/workability/${encodeURIComponent(nodeId)}`
2. On success, expects JSON with shape: `{ id, wholeness, steps: [{ actionId, title, milestone, milestoneId, impact }] }`
3. If `steps` is empty or wholeness is `"whole"`, does nothing (returns early)
4. Sorts steps by impact descending (use a weight map: `{ critical: 4, high: 3, medium: 2, low: 1 }` — fall back to 0 for unknown)
5. Builds HTML for a `div.workability-path` containing:
   - Header: `<div class="wp-header">Path to wholeness (N steps)</div>` where N = steps.length
   - For each step: a `div.wp-step` with:
     - `span.wp-step-action` showing step.actionId (data-node-id and data-node-type="action" attributes for click handling)
     - `div.wp-step-body` containing `div.wp-step-title` with step.title and `div.wp-step-milestone` with step.milestone
     - `span.wp-impact.impact-{level}` where level = step.impact lowercased (use "medium" if unknown). Badge text = step.impact
6. Finds the insertion point: look for `#exec-plan-detail` in $panelBody. If found, insert the workability HTML BEFORE it. If not found, append to $panelBody.
7. Wires click handlers on `.wp-step-action` elements: on click, call `selectNode(actionId, 'action')` using the data attributes.
8. On fetch error (network or non-200), silently skip — do not render anything or show errors.

Place this function near the existing `renderExecPlanDetail` function (around line 907).

**Integration**: In the panel rendering code (around line 868, after the wholeness badge section, inside the `if (isFocus)` block), add a call to `renderWorkabilityPath` for the focused node. Since the panel HTML is set via innerHTML before this runs, schedule it with a microtask:

```js
// After $panelBody.innerHTML = html; (around line 879)
// Add after the existing exec-plan loading logic:
if (focusItem && focusItem.wholeness && focusItem.wholeness !== 'whole') {
  renderWorkabilityPath(focusItem.id, focusType);
}
```

Where `focusItem` and `focusType` are the item/type of the focused section. Extract these from the `sections` array (the entry with `role === 'focus'`).

Note: The existing code already calls `renderExecPlanDetail` asynchronously after setting innerHTML. Follow the same pattern — call `renderWorkabilityPath` right after/alongside that call. Both are async and non-blocking.
  </action>
  <verify>
Run the dev server (`node src/server/index.js` from project root) and open the dashboard. Select a node whose wholeness is "partial" or "broken". Confirm the browser console shows a fetch to `/api/workability/:id`. If A-69's endpoint is wired up, verify the path section renders. If not yet wired, confirm no JS errors appear (graceful degradation on 404).
  </verify>
  <done>
- renderWorkabilityPath function exists in app.js and fetches /api/workability/:id
- Steps render sorted by impact (highest first) with action ID, title, milestone, impact badge
- Header shows "Path to wholeness (N steps)"
- Clicking an action ID calls selectNode to navigate to that action
- No errors when API returns 404 or empty steps
- Whole nodes show no workability section
  </done>
</task>

<task type="auto">
  <name>Task 2: Copy updated files to dist/public</name>
  <files>dist/public/app.js, dist/public/index.html</files>
  <action>
Copy the updated source files to the dist directory:

```bash
cp src/server/public/app.js dist/public/app.js
cp src/server/public/index.html dist/public/index.html
```

Verify the copies match the sources.
  </action>
  <verify>
Run `diff src/server/public/app.js dist/public/app.js` and `diff src/server/public/index.html dist/public/index.html` — both should show no differences.
  </verify>
  <done>dist/public/app.js and dist/public/index.html are identical to their src/server/public counterparts.</done>
</task>

</tasks>

<verification>
1. `grep -c "renderWorkabilityPath" src/server/public/app.js` returns at least 2 (definition + call site)
2. `grep -c "workability-path" src/server/public/index.html` returns at least 1 (CSS class)
3. `grep -c "wp-impact" src/server/public/index.html` returns at least 3 (high, medium, low)
4. `diff src/server/public/app.js dist/public/app.js` shows no differences
5. `diff src/server/public/index.html dist/public/index.html` shows no differences
</verification>

<success_criteria>
- Detail panel shows "Path to wholeness (N steps)" section for non-whole nodes
- Fix steps sorted by impact descending with clickable action IDs, titles, milestone labels, and color-coded impact badges
- Clicking an action ID in the path navigates to that action node
- Whole nodes show no workability section
- Graceful degradation when API unavailable
- Files synced to dist/public/
</success_criteria>

<output>
After completion, create `.planning/milestones/M-33-workability-path-surface/A-70-SUMMARY.md`
</output>
