---
milestone: M-44-inline-annotation-ux-in-column-browser
action: A-94
type: execute
wave: 3
depends_on:
  - A-92
  - A-93
files_modified:
  - src/server/index.js
  - src/server/public/app.js
autonomous: true
declarations:
  - D-13
user_setup: []

must_haves:
  truths:
    - "Adding an annotation auto-transitions the node's review state to revision_needed"
    - "When all annotations for a node are resolved (deleted), an 'Approve' button appears in the annotation panel"
    - "Clicking 'Approve' transitions the node's review state to approved"
    - "The review badge on the node updates immediately after state transitions"
  artifacts:
    - path: "src/server/index.js"
      provides: "Auto-transition logic in annotation POST handler"
      contains: "revision_needed"
    - path: "src/server/public/app.js"
      provides: "Approve button and auto-transition UI logic"
      contains: "ann-approve"
  key_links:
    - from: "POST /api/node/:id/annotations handler"
      to: "PUT /api/node/:id/review-state"
      via: "Internal call or direct file write after annotation creation"
      pattern: "revision_needed"
    - from: "src/server/public/app.js approve button"
      to: "/api/node/:id/review-state"
      via: "fetch PUT with reviewState: approved"
      pattern: "fetch.*review-state.*approved"
---

<objective>
Wire annotations to review state transitions so the review cycle is enforced.

Purpose: Close the loop on D-13's iterative review cycle: annotating a node marks it as needing revision, resolving all annotations enables approval. This makes annotations actionable rather than just comments.
Output: Auto-transitions on annotation add/resolve, approve button when all annotations cleared.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-92-SUMMARY.md
@.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-93-SUMMARY.md
@src/server/index.js
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add auto-transition to revision_needed on annotation creation</name>
  <files>src/server/index.js</files>
  <action>
In the `handleAddAnnotation` handler (created in A-92), after successfully writing the new annotation to disk and before returning the response, add logic to auto-transition the node's review state to `revision_needed`:

1. After `writeAnnotations(cwd, nodeId, data)` succeeds:
2. Determine the node type from the nodeId prefix (D, M, A) — same logic as `handleUpdateReviewState`
3. Rather than duplicating the review state update logic, extract the core review-state-writing logic from `handleUpdateReviewState` into a reusable internal function `updateNodeReviewState(cwd, nodeId, reviewState)` that returns `{ ok: true }` or `{ error: string }`. Then call it from both `handleUpdateReviewState` and the annotation handler.

Alternatively (simpler approach): After writing the annotation, make an internal call to update the review state by reusing the file-writing logic directly. Since `handleUpdateReviewState` is async and takes req/res, the cleanest approach is:

**Extract a helper function** `setReviewState(cwd, nodeId, reviewState)`:
- Move the file-writing logic from `handleUpdateReviewState` (lines ~721-808) into this new function
- It returns `{ ok: true, id, reviewState }` on success or `{ error: string }` on failure
- `handleUpdateReviewState` becomes a thin wrapper: parse body, validate, call `setReviewState`, sendJson the result
- `handleAddAnnotation` calls `setReviewState(cwd, nodeId, 'revision_needed')` after writing the annotation

This refactor keeps the server DRY and makes the transition reliable.

**Important:** Only transition to `revision_needed` if the current state is NOT already `revision_needed`. To check: read the current state from the annotations file's node data or from the graph. Actually, simpler: just always set it — the `setReviewState` function is idempotent (writing the same state twice is harmless).
  </action>
  <verify>
1. `curl -s -X POST http://localhost:3847/api/node/A-92/annotations -H 'Content-Type: application/json' -d '{"line":1,"text":"needs work"}'` returns 201
2. Check that A-92's review state is now `revision_needed` in PLAN.md (or fetch graph and verify)
3. `curl -s http://localhost:3847/api/graph | node -e "process.stdin.on('data',d=>{const g=JSON.parse(d);const a=g.actions.find(x=>x.id==='A-92');console.log(a.reviewState)})"` should print `revision_needed`
  </verify>
  <done>Adding an annotation auto-sets the node's review state to revision_needed. The setReviewState helper is reusable by both the review-state endpoint and the annotation handler.</done>
</task>

<task type="auto">
  <name>Task 2: Add approve button when all annotations resolved</name>
  <files>src/server/public/app.js</files>
  <action>
In the `renderAnnotationPanel` function (created in A-93), add conditional UI for the approval flow:

**After rendering annotations, check if the node has zero unresolved annotations:**

1. At the bottom of the annotation panel (after the `.annotation-lines` div), add a conditional block:

```javascript
// Show approve button if node has been reviewed (has or had annotations) and all are resolved
if (annotations.length === 0 && nodeReviewState === 'revision_needed') {
  // All annotations resolved — show approve button
  html += `<div class="ann-approve-section">
    <div class="ann-approve-msg">All annotations resolved</div>
    <button class="ann-approve-btn" id="ann-approve-btn">Approve</button>
  </div>`;
} else if (annotations.length === 0 && nodeReviewState === 'in_review') {
  // No annotations and in review — show approve directly
  html += `<div class="ann-approve-section">
    <div class="ann-approve-msg">No annotations — ready to approve</div>
    <button class="ann-approve-btn" id="ann-approve-btn">Approve</button>
  </div>`;
}
```

2. Get the node's current reviewState from graphData (look up the node by ID in declarations/milestones/actions arrays).

3. Wire the approve button click (in the event delegation section for annotation-panel):

```javascript
if (e.target.id === 'ann-approve-btn') {
  const resp = await fetch('/api/node/' + encodeURIComponent(annotationNodeId) + '/review-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewState: 'approved' }),
  });
  if (resp.ok) {
    // SSE will refresh graph, but also update badge immediately
    renderAnnotationPanel(annotationNodeId, annotationNodeType);
  }
}
```

4. Add CSS styles for the approve section in index.html:

```css
.ann-approve-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
}
.ann-approve-msg {
  flex: 1;
  font-size: 11px;
  color: #22c55e;
  font-weight: 500;
}
.ann-approve-btn {
  background: #22c55e;
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ann-approve-btn:hover {
  background: #4ade80;
}
```

5. Store `annotationNodeType` alongside `annotationNodeId` at module level so the approve handler knows the type for re-rendering.

**Also:** When an annotation is added (in the POST success handler), the review badge should update. Since the server now auto-transitions to `revision_needed`, the SSE `change` event will trigger a graph refresh which re-renders badges. But for immediate feedback, after a successful POST annotation, also manually update the review badge in the DOM:
```javascript
const badge = document.querySelector(`.review-badge[data-node-id="${nodeId}"]`);
if (badge) {
  badge.className = 'review-badge review-revision_needed';
  badge.dataset.reviewState = 'revision_needed';
  badge.textContent = REVIEW_DISPLAY['revision_needed'] || 'revision_needed';
}
```
  </action>
  <verify>
In the browser:
1. Select a node with review state "in_review" — verify "Approve" button shows at bottom of annotation panel
2. Add an annotation — verify review badge changes to "revision_needed" immediately
3. Delete the annotation — verify "All annotations resolved" message and "Approve" button appear
4. Click "Approve" — verify review badge changes to "approved"
5. Refresh page — verify the approved state persisted
  </verify>
  <done>Adding annotation auto-transitions node to revision_needed (badge updates immediately). Resolving all annotations shows "Approve" button. Clicking Approve transitions to approved state. Full review cycle works: draft -> in_review -> add annotation -> revision_needed -> resolve all -> approve.</done>
</task>

</tasks>

<verification>
- Full review cycle: node starts as draft, user sets to in_review, adds annotation -> auto-transitions to revision_needed, resolves annotation -> approve button appears, clicks approve -> transitions to approved
- Review badge updates reflect state changes in real-time
- Multiple annotations: approve button only shows when ALL are resolved
- State persists across page refresh
</verification>

<success_criteria>
The annotation system is fully wired to review states. Adding annotations marks nodes for revision. Resolving all annotations enables approval. The UI provides clear visual feedback at every step of the review cycle.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-94-SUMMARY.md`
</output>
