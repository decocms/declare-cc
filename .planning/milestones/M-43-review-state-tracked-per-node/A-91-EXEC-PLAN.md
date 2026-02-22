---
milestone: M-43-review-state-tracked-per-node
action: A-91
type: execute
wave: 3
depends_on:
  - A-90
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations:
  - D-13
user_setup: []

must_haves:
  truths:
    - "Every node in the column browser shows a color-coded review state badge"
    - "Every node in the DAG view shows a color-coded review state badge"
    - "Badge colors match the spec: draft=gray, in_review=blue, revision_needed=orange, approved=green"
    - "Clicking a review badge cycles the review state via PUT API call"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Review badge rendering in column browser and DAG view"
      contains: "review-badge"
    - path: "src/server/public/index.html"
      provides: "CSS styles for review badges"
      contains: "review-badge"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/node/:id/review-state"
      via: "fetch PUT call when review badge is clicked"
      pattern: "review-state"
    - from: "src/server/public/app.js"
      to: "graphData"
      via: "Reads metadata.reviewState from graph response to render badges"
      pattern: "reviewState"
---

<objective>
Surface review state badges on every node in both the column browser and DAG view, with click-to-cycle interaction.

Purpose: Makes review state visible and actionable directly in the UI, enabling the review workflow loop described in D-13.
Output: Color-coded review badges on all nodes, interactive state cycling.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-43-review-state-tracked-per-node/A-89-SUMMARY.md
@.planning/milestones/M-43-review-state-tracked-per-node/A-90-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add review badge CSS and rendering logic</name>
  <files>
    src/server/public/index.html
    src/server/public/app.js
  </files>
  <action>
**index.html — Add CSS styles** inside the existing `<style>` block:

```css
/* Review state badges */
.review-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
  margin-left: 4px;
  transition: opacity 0.15s;
}
.review-badge:hover { opacity: 0.8; }
.review-draft           { background: #e0e0e0; color: #666; border: 1px solid #ccc; }
.review-in_review       { background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
.review-revision_needed { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
.review-approved        { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
```

**app.js — Add helper functions** near the top of the file (after the existing utility functions):

1. **Review state display map and cycle order:**
```javascript
const REVIEW_DISPLAY = {
  draft: 'Draft',
  in_review: 'In Review',
  revision_needed: 'Needs Revision',
  approved: 'Approved',
};

const REVIEW_CYCLE = ['draft', 'in_review', 'revision_needed', 'approved'];
```

2. **Helper to build a review badge HTML string:**
```javascript
function reviewBadgeHtml(nodeId, reviewState) {
  const state = reviewState || 'draft';
  const label = REVIEW_DISPLAY[state] || state;
  return `<span class="review-badge review-${state}" data-node-id="${escHtml(nodeId)}" data-review-state="${escHtml(state)}" title="Click to change review state">${escHtml(label)}</span>`;
}
```

3. **Click handler to cycle review state** (attach via event delegation on document):
```javascript
document.addEventListener('click', async (e) => {
  const badge = e.target.closest('.review-badge');
  if (!badge) return;
  e.stopPropagation(); // Don't trigger node selection

  const nodeId = badge.dataset.nodeId;
  const currentState = badge.dataset.reviewState || 'draft';
  const currentIdx = REVIEW_CYCLE.indexOf(currentState);
  const nextState = REVIEW_CYCLE[(currentIdx + 1) % REVIEW_CYCLE.length];

  try {
    const resp = await fetch(`/api/node/${encodeURIComponent(nodeId)}/review-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewState: nextState }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      console.error('Failed to update review state:', err);
    }
    // SSE will trigger a refresh, but also update immediately for responsiveness
    badge.className = `review-badge review-${nextState}`;
    badge.dataset.reviewState = nextState;
    badge.textContent = REVIEW_DISPLAY[nextState] || nextState;
  } catch (err) {
    console.error('Failed to update review state:', err);
  }
});
```

**app.js — Add badges to column browser rendering** in the `renderColumnBrowser` function:

- **Declarations column** (~line 740): After the existing `<span class="status-badge">` in the declaration item HTML, append `${reviewBadgeHtml(d.id, d.reviewState || (d.metadata && d.metadata.reviewState))}`.

  Note: The graph response includes reviewState in metadata. Declarations in graphData may have it at either `d.reviewState` (if the enriched response copies it) or `d.metadata.reviewState`. Check both — use `(d.reviewState || (d.metadata && d.metadata.reviewState) || 'draft')`.

- **Milestones column** (~line 810): After the existing status badge and readiness badge HTML, append the review badge: `${reviewBadgeHtml(m.id, m.reviewState || (m.metadata && m.metadata.reviewState))}`.

- **Actions column** (~line 850): After the existing `<span class="status-badge">`, append `${reviewBadgeHtml(a.id, a.reviewState || (a.metadata && a.metadata.reviewState))}`.

**app.js — Add badges to DAG view rendering:**

Find the DAG node rendering code (the function that creates node card HTML for the DAG canvas — look for where nodes get rendered with `node-card` or similar class, around the `renderDag`/`renderNodes` function area). In each node's HTML template, after the status text or badge, append the review badge HTML using the same helper.

The DAG nodes are rendered around line 1220+ in the detail panel and around lines 1560+ for the actual DAG node cards. For DAG node cards (the `renderDagNode` or equivalent function that creates the small cards in the layered view), insert the review badge after the status indicator. Use `reviewBadgeHtml(node.id, node.metadata && node.metadata.reviewState)`.

**Important implementation notes:**
- The `metadata` field is available on nodes in the graphData response. The reviewState lives at `node.metadata.reviewState` since build-dag puts it there.
- For the enriched declarations/milestones/actions arrays in graphData, the metadata may not be directly on the object — it depends on how load-graph.js spreads the data. Check the actual shape: if graphData.declarations[0] has a `.metadata` field, use it; if not, the reviewState should be available as a direct field since buildDagFromDisk returns the original parsed objects which now include reviewState.
- The `escHtml` function already exists in app.js — use it for XSS safety.
  </action>
  <verify>
Build the project (`npm run build`), start the server (`node dist/declare-tools.cjs serve`), open the dashboard in a browser. Verify:
1. Column browser: every declaration, milestone, and action row shows a small colored pill badge (gray "Draft" by default).
2. DAG view: every node card shows the review badge.
3. Click a badge: it cycles to the next state (draft -> in_review -> revision_needed -> approved -> draft).
4. After clicking, the badge color and label update immediately.
5. Reload the page: the state persists (was written to disk).
  </verify>
  <done>
Review badges visible on all nodes in both column browser and DAG view. Click-to-cycle works. State persists to disk via the PUT API endpoint.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Review state badges on all nodes in column browser and DAG view with click-to-cycle interaction. Badges show: Draft (gray), In Review (blue), Needs Revision (orange), Approved (green).
  </what-built>
  <how-to-verify>
1. Open `http://localhost:3847` in a browser
2. In column browser view: check that every declaration, milestone, and action shows a small badge next to its status (should say "Draft" in gray by default)
3. Click a badge on any declaration — it should cycle to "In Review" (blue)
4. Click again — "Needs Revision" (orange)
5. Click again — "Approved" (green)
6. Click again — back to "Draft" (gray)
7. Switch to DAG view — verify badges appear on DAG node cards too
8. Reload the page — the last state you set should persist
9. Verify badges don't interfere with existing node selection (clicking the node body still selects it, clicking the badge only changes review state)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
1. Column browser: all three columns (D, M, A) show review badges with correct colors
2. DAG view: all node cards show review badges
3. Click-to-cycle works: draft -> in_review -> revision_needed -> approved -> draft
4. State persists across page reloads
5. Badge clicks don't interfere with node selection
6. No console errors during interaction
</verification>

<success_criteria>
- Color-coded review badge visible on every node in column browser (declarations, milestones, actions columns)
- Color-coded review badge visible on every node in DAG view
- Badge colors: draft=gray, in_review=blue, revision_needed=orange, approved=green
- Click on badge cycles through states via PUT /api/node/:id/review-state
- State persists to disk and survives page reload
- No regressions in existing UI functionality
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-review-state-tracked-per-node/A-91-SUMMARY.md`
</output>
