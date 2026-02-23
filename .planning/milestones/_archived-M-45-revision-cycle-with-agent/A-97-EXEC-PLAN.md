---
milestone: M-45-revision-cycle-with-agent
action: A-97
type: execute
wave: 3
depends_on: ["A-95"]
files_modified:
  - src/server/index.js
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations:
  - D-13

must_haves:
  truths:
    - "User can view a diff between current artifact and previous revision round"
    - "Additions are highlighted in green, removals in red"
    - "Diff view is accessible from the annotation panel when revisionRound >= 1"
    - "User can toggle between diff view and normal artifact view"
  artifacts:
    - path: "src/server/index.js"
      provides: "GET /api/node/:id/revisions endpoint returning versioned content"
      contains: "handleGetRevisions"
    - path: "src/server/public/app.js"
      provides: "Inline diff rendering with add/remove highlighting"
      contains: "renderDiffView"
    - path: "src/server/public/index.html"
      provides: "CSS for diff display (green additions, red removals)"
      contains: "diff-add"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/node/:id/revisions"
      via: "fetch to get previous version content"
      pattern: "api/node.*revisions"
    - from: "src/server/public/app.js"
      to: "inline diff rendering"
      via: "line-by-line diff algorithm compares old vs new"
      pattern: "renderDiffView"
---

<objective>
Show inline diffs between revision rounds so the reviewer can see exactly what the agent changed.

Purpose: Without diffs, the reviewer must re-read the entire plan after each revision. Diffs make the revision cycle efficient — the reviewer can focus on what changed and whether annotations were addressed.
Output: Diff toggle button, inline diff view with green/red highlighting, API endpoint for version content.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-45-revision-cycle-with-agent/PLAN.md
@.planning/milestones/M-45-revision-cycle-with-agent/A-95-SUMMARY.md
@.planning/milestones/M-45-revision-cycle-with-agent/A-96-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add version content API and inline diff rendering</name>
  <files>src/server/index.js, src/server/public/app.js, src/server/public/index.html</files>
  <action>
**In src/server/index.js:**

1. Add `GET /api/node/:id/revisions` endpoint:
   - Handler: `handleGetRevisions(res, cwd, nodeId)`
   - Determine the artifact path for the node (same logic as handleRevise in A-95 — extract into a shared helper `getArtifactPathForNode(cwd, nodeId)` if not already done)
   - Read current artifact content from the main file
   - Read previous version from `.vN.md` where N = revisionRound - 1. Get revisionRound from readAnnotations.
   - Return JSON: `{ current: currentContent, previous: previousContent, revisionRound }`
   - If revisionRound is 0 or previous version file doesn't exist, return `{ current, previous: null, revisionRound }`
   - Wire route: `method === 'GET' && urlPath.match(/^\/api\/node\/([^/]+)\/revisions$/)`

**In src/server/public/app.js:**

1. Add a "Show Diff" toggle button in the annotation panel header. Only show when `revisionRound >= 1`. Add it next to the round badge in the headerHtml:
```javascript
const diffToggle = revisionRound >= 1
  ? `<button class="ann-diff-toggle" id="ann-diff-toggle">Show Diff</button>`
  : '';
```

2. Add module-level state: `let showingDiff = false;`

3. Wire click handler for `ann-diff-toggle` in the annotation panel event delegation:
```javascript
if (e.target.id === 'ann-diff-toggle') {
  showingDiff = !showingDiff;
  if (showingDiff) {
    renderDiffView(nodeId);
  } else {
    // Re-render normal annotation panel
    const type = nodeId.startsWith('A-') ? 'action' : nodeId.startsWith('M-') ? 'milestone' : 'declaration';
    renderAnnotationPanel(nodeId, type);
  }
  return;
}
```

4. Add `async function renderDiffView(nodeId)`:
   - Fetch `GET /api/node/${nodeId}/revisions`
   - If `previous` is null, show message "No previous version available"
   - Compute line-by-line diff using a simple algorithm:
     - Split both into lines
     - Use a basic LCS (Longest Common Subsequence) diff: implement a lightweight `computeDiff(oldLines, newLines)` that returns an array of `{ type: 'same' | 'add' | 'remove', text }` entries
     - The algorithm: Walk both arrays with two pointers. For each pair of lines, if equal mark 'same' and advance both. If not equal, look ahead (up to 3 lines) in newLines for oldLine match or in oldLines for newLine match. If found, emit removes/adds up to that point. If not found within lookahead, mark current old as 'remove' and current new as 'add'. This is a simple greedy diff — not perfect but good enough for plan revisions.
     - Alternative simpler approach: use the classic O(n*m) LCS for files under 500 lines (our plans are always under 200 lines). Build edit script from LCS.
   - Render into the annotation panel area:
     - Replace annotation panel content with diff view
     - Header: "Diff: Round {N-1} -> Round {N}" with a "Close Diff" button
     - Body: line-by-line diff display where:
       - Added lines: green background (#dcfce7), prefixed with "+"
       - Removed lines: red background (#fee2e2), prefixed with "-"
       - Unchanged lines: no background, prefixed with " " (space)
       - Line numbers shown for both old and new (dual-column gutter)
     - Use `<pre>` wrapper for monospace alignment

**In src/server/public/index.html**, add CSS:

- `.ann-diff-toggle`: background transparent, border 1px solid #7c3aed, color #7c3aed, font-size 11px, padding 2px 8px, border-radius 4px, cursor pointer, margin-left 8px
- `.ann-diff-toggle:hover`: background #7c3aed, color white
- `.diff-view`: font-family monospace, font-size 11px, overflow-x auto, max-height 500px, overflow-y auto, border-radius 4px, border 1px solid #e5e7eb
- `.diff-header`: padding 8px 12px, background #f9fafb, border-bottom 1px solid #e5e7eb, display flex, justify-content space-between, align-items center, font-weight 600, font-size 12px
- `.diff-line`: display flex, padding 0 8px, min-height 20px, line-height 20px
- `.diff-line.diff-add`: background #dcfce7
- `.diff-line.diff-remove`: background #fee2e2
- `.diff-line.diff-same`: background transparent
- `.diff-gutter`: width 35px, text-align right, padding-right 8px, color #9ca3af, user-select none, flex-shrink 0, font-size 10px
- `.diff-gutter-old`: (same as gutter)
- `.diff-gutter-new`: (same as gutter)
- `.diff-text`: flex 1, white-space pre-wrap, word-break break-all
- `.diff-prefix`: width 16px, text-align center, flex-shrink 0, font-weight bold
- `.diff-prefix.diff-add`: color #16a34a
- `.diff-prefix.diff-remove`: color #dc2626
- `.diff-close-btn`: background transparent, border 1px solid #6b7280, color #6b7280, font-size 11px, padding 2px 8px, border-radius 4px, cursor pointer
  </action>
  <verify>
- Server starts without errors
- `curl -s http://localhost:3847/api/node/A-95/revisions | jq .revisionRound` returns the current round
- Open dashboard, select a node that has been through at least one revision round
- Verify "Show Diff" button appears next to the round badge
- Click "Show Diff" and verify green/red diff lines render correctly
- Click "Close Diff" to return to normal view
  </verify>
  <done>Diff view renders inline with green additions and red removals. Toggle button in annotation header switches between diff and normal view. API serves current and previous version content.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Inline diff view comparing current artifact version against previous revision round, with green/red line highlighting, toggle button, and version content API.</what-built>
  <how-to-verify>
    1. Open dashboard at http://localhost:3847
    2. Select a node that has been through at least one revision (Round >= 1)
    3. Verify "Show Diff" button appears next to the "Round N" badge in annotation header
    4. Click "Show Diff"
    5. Verify diff renders with:
       - Green highlighted lines for additions (prefixed with +)
       - Red highlighted lines for removals (prefixed with -)
       - Unchanged lines shown normally
       - Line numbers visible
    6. Verify header shows "Diff: Round 0 -> Round 1" (or appropriate round numbers)
    7. Click "Close Diff" to return to normal annotation view
    8. Verify switching back and forth works without errors
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- GET /api/node/:id/revisions returns current and previous version content
- Diff toggle button only shows when revisionRound >= 1
- Diff algorithm correctly identifies additions, removals, and unchanged lines
- Green/red highlighting is visually clear
- Toggle between diff and normal view works without breaking annotation panel
- Works for action nodes (EXEC-PLAN), milestone nodes (PLAN.md), and declaration nodes (FUTURE.md)
</verification>

<success_criteria>
Reviewer can click "Show Diff" to see exactly what the agent changed in the last revision, with clear green/red highlighting, and toggle back to the annotated view.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-45-revision-cycle-with-agent/A-97-SUMMARY.md`
</output>
