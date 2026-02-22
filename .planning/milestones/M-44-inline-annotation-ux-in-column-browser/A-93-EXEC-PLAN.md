---
milestone: M-44-inline-annotation-ux-in-column-browser
action: A-93
type: execute
wave: 2
depends_on:
  - A-92
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations:
  - D-13
user_setup: []

must_haves:
  truths:
    - "When a node is selected in the detail panel, an 'Annotations' section appears showing the artifact content with line numbers"
    - "Clicking a line number opens an input to add an annotation on that line"
    - "Existing annotations appear inline next to their line with comment text, timestamp, and a resolve/delete button"
    - "Adding an annotation calls POST /api/node/:id/annotations and the annotation appears immediately"
    - "Deleting/resolving an annotation calls DELETE /api/node/:id/annotations/:id and removes it from view"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Annotation panel rendering and interaction logic"
      contains: "renderAnnotations"
    - path: "src/server/public/index.html"
      provides: "CSS styles for annotation panel"
      contains: "annotation"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/node/:id/annotations"
      via: "fetch calls in annotation panel"
      pattern: "fetch.*annotations"
    - from: "src/server/public/app.js"
      to: "/api/files"
      via: "fetch to get artifact content for line display"
      pattern: "fetch.*api/files"
---

<objective>
Build the annotation panel UI in the column browser's detail/right pane.

Purpose: Enable human reviewers to add line-level comments on plan artifacts (PLAN.md, EXEC-PLAN.md, FUTURE.md statements) directly in the dashboard. This is the core UX for D-13's iterative review cycle.
Output: Annotation section in detail panel with line-numbered artifact content, inline comment markers, add/delete interactions.
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
@src/server/public/app.js
@src/server/public/index.html
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add annotation panel rendering and interaction logic</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
**Overview:** After the existing detail panel content (renderPanelContent or renderPanelChain), add an "Annotations" section that loads the node's artifact file content (line-numbered) and overlays annotations from the API.

**Step 1: Determine artifact file path for each node type.**
Add a helper function `getNodeArtifactPath(nodeId, type)`:
- Declaration (D-XX): `.planning/FUTURE.md`
- Milestone (M-XX): Find the milestone folder by looking at graphData, return `.planning/milestones/M-XX-{slug}/PLAN.md`
- Action (A-XX): Find the milestone it causes, return `.planning/milestones/M-XX-{slug}/A-{XX}-EXEC-PLAN.md` (if it exists per graphData action's exec plan info), or fall back to the PLAN.md of its milestone

For milestone folder slug: Use the graphData milestones array. Each milestone has an `id` and `title`. The folder name follows the pattern `M-XX-{title-slugified}`. Rather than guessing the slug, use the existing `/api/files` endpoint to try fetching the file — if 404, show "No artifact content available" in the annotation panel.

**Step 2: Create `renderAnnotationPanel(nodeId, type)` function.**
This function is called at the end of `selectNode()` after `renderPanelChain()` completes. It:

1. Fetches artifact content: `fetch('/api/files?path=' + encodeURIComponent(artifactPath))`
2. Fetches annotations: `fetch('/api/node/' + encodeURIComponent(nodeId) + '/annotations')`
3. Builds HTML and appends to `$panelBody`:

```
<div class="annotation-panel" id="annotation-panel">
  <div class="detail-label" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
    Annotations
    <span class="annotation-count">{N} comments</span>
  </div>
  <div class="annotation-lines">
    {for each line in artifact content:}
    <div class="ann-line" data-line="{lineNum}">
      <span class="ann-line-num" title="Click to annotate line {lineNum}">{lineNum}</span>
      <span class="ann-line-text">{escaped line content}</span>
    </div>
    {if annotations exist for this line:}
    <div class="ann-comment" data-annotation-id="{id}">
      <span class="ann-comment-text">{text}</span>
      <span class="ann-comment-meta">{relative timestamp}</span>
      <button class="ann-resolve-btn" data-annotation-id="{id}" title="Resolve">&times;</button>
    </div>
    {/if}
    {if this line has an active input (user clicked line number):}
    <div class="ann-input-row">
      <input type="text" class="ann-input" placeholder="Add annotation..." autofocus />
      <button class="ann-submit-btn">Add</button>
    </div>
    {/if}
    {/for}
  </div>
</div>
```

**Step 3: Wire interactions via event delegation.**
Add event listeners on the `annotation-panel` element (use event delegation to handle dynamic content):

- **Click on `.ann-line-num`**: Toggle an input row below that line. Track which line has an open input in a module-level variable `annotatingLine`. Re-render the annotation panel.
- **Click on `.ann-submit-btn` or Enter in `.ann-input`**: POST to `/api/node/{nodeId}/annotations` with `{ line: lineNum, text: inputValue }`. On success, re-render annotation panel. Clear `annotatingLine`.
- **Click on `.ann-resolve-btn`**: DELETE `/api/node/{nodeId}/annotations/{annotationId}`. On success, re-render annotation panel.

**Step 4: Integration with selectNode flow.**
At the end of `selectNode()` function (after `renderPanelChain(item, type)` is called, around line 1259), add:
```javascript
renderAnnotationPanel(nodeId, type);
```

**Step 5: State management.**
Add module-level state variables near the top state section:
```javascript
/** @type {number|null} Line number currently being annotated */
let annotatingLine = null;
/** @type {string|null} Node ID of the currently displayed annotation panel */
let annotationNodeId = null;
```

Reset `annotatingLine = null` when a new node is selected.

**Step 6: CSS styles in index.html.**
Add styles in the `<style>` section of index.html:

```css
.annotation-panel {
  margin-top: 20px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.annotation-count {
  font-size: 10px;
  color: var(--text-dim);
  font-weight: 400;
}
.annotation-lines {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.6;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 0;
  max-height: 400px;
  overflow-y: auto;
}
.ann-line {
  display: flex;
  padding: 0 10px;
}
.ann-line:hover {
  background: var(--surface2);
}
.ann-line-num {
  color: var(--text-dim);
  opacity: 0.5;
  min-width: 32px;
  text-align: right;
  padding-right: 10px;
  cursor: pointer;
  user-select: none;
}
.ann-line-num:hover {
  opacity: 1;
  color: #60a5fa;
}
.ann-line-text {
  white-space: pre;
  overflow-x: auto;
  flex: 1;
}
.ann-line.has-annotation {
  background: rgba(234, 179, 8, 0.08);
  border-left: 2px solid #eab308;
}
.ann-comment {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 42px;
  background: rgba(234, 179, 8, 0.06);
  border-left: 2px solid #eab308;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 11px;
}
.ann-comment-text {
  flex: 1;
  color: #eab308;
}
.ann-comment-meta {
  font-size: 9px;
  color: var(--text-dim);
  opacity: 0.6;
}
.ann-resolve-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  opacity: 0.5;
}
.ann-resolve-btn:hover {
  opacity: 1;
  color: var(--broken-color);
}
.ann-input-row {
  display: flex;
  gap: 6px;
  padding: 4px 10px 4px 42px;
  background: rgba(96, 165, 250, 0.06);
}
.ann-input {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.ann-input:focus {
  outline: none;
  border-color: #60a5fa;
}
.ann-submit-btn {
  background: #60a5fa;
  color: #000;
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}
.ann-submit-btn:hover {
  background: #93bbfd;
}
```

**Important implementation notes:**
- Use escHtml() for all user content (annotation text, file content lines)
- The artifact content can be large — limit display to 500 lines with a "Show more" toggle
- If /api/files returns 404 for the artifact, show just the annotations without the code view (list mode)
- The annotation panel appends to $panelBody AFTER the existing content — do NOT replace it
- For the `renderPanelChain` flow: the function currently sets `$panelBody.innerHTML`. The annotation panel should be appended as a new DOM element after that innerHTML is set, using `$panelBody.appendChild(annotationEl)` pattern or by creating the div and appending.
  </action>
  <verify>
Start the server. In the browser:
1. Select any node in column browser — detail panel shows with "Annotations" section at bottom
2. Annotation section shows line-numbered artifact content
3. Click a line number — input appears below that line
4. Type a comment and click "Add" or press Enter — annotation appears inline with yellow highlight
5. Click the X button on an annotation — it disappears
6. Refresh the page — annotations persist (loaded from API)
7. Select a different node — annotation panel updates for the new node
  </verify>
  <done>Annotation panel renders in the detail pane for all node types. Line-level annotation add/delete works through the API. Annotations display inline with yellow highlighting. Input appears on line-number click.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Annotation panel in column browser detail pane with line-level comments on artifact content. Click line numbers to annotate, see existing comments inline, delete resolved ones.</what-built>
  <how-to-verify>
    1. Open http://localhost:3847 in browser
    2. Switch to column browser view
    3. Select any declaration — verify "Annotations" section appears at bottom of detail panel
    4. Verify FUTURE.md content shows with line numbers
    5. Click a line number — verify input appears
    6. Type "test annotation" and press Enter — verify yellow annotation appears
    7. Select a milestone — verify PLAN.md content shows
    8. Add another annotation on a milestone
    9. Click X on an annotation — verify it disappears
    10. Refresh the page, re-select the node — verify annotations persist
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Annotation panel renders for D, M, and A node types
- Line numbers are clickable and show annotation input
- Annotations created via UI appear inline with yellow styling
- Annotations deleted via X button disappear
- Annotations persist across page refresh
- No console errors during interaction
</verification>

<success_criteria>
Users can add line-level annotations to any node's artifact content from the column browser detail panel. Annotations are visually distinct (yellow highlight), show timestamp, and can be resolved/deleted.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-93-SUMMARY.md`
</output>
