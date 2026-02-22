---
milestone: M-47-planning-mode-as-default-column-browser-view
action: A-102
type: execute
wave: 2
depends_on: ["A-100", "A-101"]
files_modified: [src/server/public/app.js, src/server/public/index.html]
autonomous: false
declarations: ["D-14"]

must_haves:
  truths:
    - "Selecting any item in the column browser shows review controls (Approve / Request Revision) prominently in the detail pane header"
    - "Annotation panel is always visible (not collapsed) when a node is selected"
    - "Clicking through column browser items auto-focuses the review controls section"
    - "Approve and Request Revision buttons update reviewState via the existing API"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Review action buttons in detail pane header, always-visible annotation panel, review-mode focus behavior"
      contains: "review-actions"
    - path: "src/server/public/index.html"
      provides: "CSS for review action buttons and always-visible annotation styling"
      contains: "review-actions"
  key_links:
    - from: "Approve button click"
      to: "/api/node/:id/review-state"
      via: "fetch POST with reviewState: 'approved'"
      pattern: "review-state.*approved"
    - from: "Request Revision button click"
      to: "/api/node/:id/review-state"
      via: "fetch POST with reviewState: 'revision_needed'"
      pattern: "review-state.*revision_needed"
    - from: "selectNode()"
      to: "review controls scroll"
      via: "scrollIntoView on review-actions element after renderPanelChain + renderAnnotationPanel"
      pattern: "review-actions.*scrollIntoView"
---

<objective>
Integrate review and annotation controls as the primary work surface in the column browser's right pane.

Purpose: Makes the column browser a complete planning work surface where users can review artifacts, approve/request revision, and annotate — all without switching views. This completes M-47's goal of planning mode as the primary UX.
Output: Enhanced detail pane with prominent review controls and always-visible annotation panel.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-47-planning-mode-as-default-column-browser-view/A-100-SUMMARY.md
@.planning/milestones/M-47-planning-mode-as-default-column-browser-view/A-101-SUMMARY.md
@src/server/public/app.js (lines 1639-1679 — selectNode, lines 1687-1804 — renderPanelContent, lines 1278-1421 — renderAnnotationPanel, lines 1985-2013 — renderPanelChain)
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add prominent review action buttons to detail pane header</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
Modify the `renderPanelContent()` function (line 1687) to inject a review actions bar immediately after the status badge (line 1716). The review actions bar should appear for ALL node types (declarations, milestones, actions).

After the `detail-badge` div, add:

```html
<div class="review-actions" id="review-actions">
  <button class="ra-btn ra-approve" data-action="approved" data-node-id="{item.id}">Approve</button>
  <button class="ra-btn ra-revision" data-action="revision_needed" data-node-id="{item.id}">Request Revision</button>
  <span class="ra-state">Current: {reviewState label}</span>
</div>
```

Use the item's current `reviewState` (from item.reviewState || 'draft') to:
- Highlight the active state button (e.g., if approved, the Approve button gets `ra-active` class)
- Show current state label using REVIEW_LABELS map (line 154)

Wire click handlers on the `.ra-btn` buttons AFTER setting $panelBody.innerHTML (around line 1794). On click:
1. Extract `data-action` (the target reviewState) and `data-node-id`
2. POST to `/api/node/${nodeId}/review-state` with `{ reviewState: targetState }` (same pattern as line 1059)
3. On success, update the button states visually (toggle `ra-active` class)
4. The SSE refresh will propagate the change to the column browser and readiness banner

**CSS** (add to index.html style block or inject in app.js):
```css
.review-actions {
  display: flex; gap: 8px; align-items: center;
  margin: 12px 0; padding: 10px;
  background: var(--surface1); border-radius: 6px;
  border: 1px solid var(--border);
}
.ra-btn {
  padding: 6px 14px; border-radius: 4px; border: 1px solid var(--border);
  cursor: pointer; font-size: 13px; font-weight: 500;
  background: var(--surface2); color: var(--text);
  transition: background 0.15s;
}
.ra-btn:hover { background: var(--surface3); }
.ra-approve.ra-active { background: var(--done-bg); color: var(--done-color); border-color: var(--done-border); }
.ra-revision.ra-active { background: var(--broken-bg); color: var(--broken-color); border-color: var(--broken-border); }
.ra-state { font-size: 12px; color: var(--text-secondary); margin-left: auto; }
```

IMPORTANT: Do NOT remove or interfere with the existing review badge click-to-cycle behavior (line 1049). The new buttons provide an ADDITIONAL, more prominent way to set review state — both mechanisms should work.
  </action>
  <verify>
1. `grep "review-actions" src/server/public/app.js` — review actions bar exists in renderPanelContent
2. Select a node in column browser — Approve and Request Revision buttons visible in detail pane
3. Click Approve — reviewState updates, button shows active state, column browser badge updates on refresh
4. Click Request Revision — reviewState changes accordingly
  </verify>
  <done>Every selected node shows Approve and Request Revision buttons in the detail pane. Clicking them updates reviewState via API. Active state is visually highlighted.</done>
</task>

<task type="auto">
  <name>Task 2: Make annotation panel always visible and add review-mode focus</name>
  <files>src/server/public/app.js</files>
  <action>
Two changes to make the annotation panel the default visible state and enable review-mode focus:

**1. Always-visible annotation panel:**

Currently `renderAnnotationPanel()` (line 1284) is called from `selectNode()` (line 1679) and it appends to $panelBody. This already works. However, ensure the annotation panel section header is rendered as open/expanded by default — check if there's any collapsed/hidden state. If the annotation panel has a toggle or is inside a collapsible section, remove that behavior so it's always shown.

Look for any CSS that hides or collapses `.annotation-panel` by default and remove it. The annotation panel should be visible immediately when a node is selected, not requiring user action to expand it.

**2. Review-mode focus:**

Modify `selectNode()` (line 1639) to add a review-mode auto-scroll behavior when in column browser view. After `renderAnnotationPanel()` completes (it's async, called on line 1679), scroll the review-actions element into view.

Since renderAnnotationPanel is async and selectNode is not, use a small delay approach:

After line 1679 (`renderAnnotationPanel(nodeId, type);`), add:
```javascript
// In columns mode, auto-scroll to review controls for review-mode flow
if (viewMode === 'columns') {
  setTimeout(() => {
    const reviewEl = document.getElementById('review-actions');
    if (reviewEl) reviewEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}
```

This ensures that when clicking through items in the column browser, the review controls are always visible without manual scrolling — enabling a rapid review workflow.

**3. Visual separator:**

Add a subtle visual separator (a heading like "Review & Annotations") above the annotation panel to make it clear this is the review work area. Modify the annotation panel header in `renderAnnotationPanel()` (around line 1343) to include a "Review & Annotations" section title if it doesn't already have a clear heading.
  </action>
  <verify>
1. Select a node — annotation panel is immediately visible (no click to expand)
2. In column browser view, selecting a node auto-scrolls to review controls
3. Click through multiple nodes rapidly — each time review controls scroll into view
4. Annotation functionality still works (add annotation, resolve, etc.)
  </verify>
  <done>Annotation panel always visible on node selection. Review controls auto-focus when navigating in column browser. Full review workflow works: select node, see review buttons + annotations, approve or annotate, move to next node.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete planning mode work surface: column browser as default view (A-100), readiness banner with approval counts (A-101), and integrated review/annotation panel with prominent action buttons (A-102). The column browser is now the primary planning UX with review controls, annotations, and progress tracking all visible in one view.</what-built>
  <how-to-verify>
    1. Open dashboard in incognito window — column browser should be the default view
    2. Readiness banner at top shows "N/M approved, X need review" with clickable links
    3. Click a declaration in column 1, then a milestone in column 2, then an action in column 3
    4. Detail pane (right) shows: node info, Approve/Request Revision buttons, annotation panel
    5. Click "Approve" on an action — button highlights, review badge updates, banner count updates on next refresh
    6. Click "Request Revision" — state changes accordingly
    7. Add an annotation on a line — annotation appears, review state changes to revision_needed
    8. Click an unapproved node link in the readiness banner — navigates to that node
    9. Toggle to DAG view and back — everything persists correctly
    10. Verify the review-mode flow: click through several items in column browser — review controls auto-scroll into view each time
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
1. Column browser is default view on fresh load
2. Readiness banner shows accurate counts and updates live
3. Review action buttons work for all node types
4. Annotation panel always visible, not collapsed
5. Review-mode auto-focus works when clicking through items
6. All existing functionality preserved (review badges, annotation add/resolve, toggle view)
</verification>

<success_criteria>
The column browser is a complete planning work surface: users can navigate the D-M-A hierarchy, see review progress at a glance, approve or request revisions with prominent buttons, and annotate artifacts — all in one integrated view without switching modes.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-47-planning-mode-as-default-column-browser-view/A-102-SUMMARY.md`
</output>
