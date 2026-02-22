---
milestone: M-45-revision-cycle-with-agent
action: A-95
type: execute
wave: 2
depends_on: ["A-96"]
files_modified:
  - src/server/revision-runner.js
  - src/server/index.js
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations:
  - D-13

must_haves:
  truths:
    - "User sees a 'Request Revision' button in annotation panel when open annotations exist"
    - "Clicking the button spawns a Claude subprocess that revises the EXEC-PLAN"
    - "Agent output streams to a revision output panel in real time via SSE"
    - "On completion, the current EXEC-PLAN is versioned and replaced with the revised one"
    - "Revision round counter increments after successful revision"
    - "Node review state transitions back to in_review after revision completes"
  artifacts:
    - path: "src/server/revision-runner.js"
      provides: "Claude subprocess manager for plan revision"
      exports: ["createRevisionRunner"]
    - path: "src/server/index.js"
      provides: "POST /api/node/:id/revise endpoint, SSE events for revision output"
      contains: "handleRevise"
    - path: "src/server/public/app.js"
      provides: "Request Revision button, revision output panel, SSE listener"
      contains: "Request Revision"
    - path: "src/server/public/index.html"
      provides: "CSS for revision button, output panel, streaming text"
      contains: "revision-output"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/node/:id/revise"
      via: "fetch POST on button click"
      pattern: "api/node.*revise"
    - from: "src/server/index.js"
      to: "src/server/revision-runner.js"
      via: "createRevisionRunner spawns claude CLI"
      pattern: "revisionRunner.*revise"
    - from: "src/server/revision-runner.js"
      to: "claude CLI"
      via: "spawn('claude', ['-p', prompt])"
      pattern: "spawn.*claude"
    - from: "src/server/revision-runner.js"
      to: ".planning/milestones/M-XX/A-XX-EXEC-PLAN.md"
      via: "fs.writeFileSync overwrites with revised content"
      pattern: "writeFileSync.*EXEC-PLAN"
---

<objective>
Build the revision request flow: a "Request Revision" button that bundles open annotations into a prompt, sends to Claude CLI as a subprocess, streams output, and replaces the EXEC-PLAN with the revised version.

Purpose: This is the core agent-in-the-loop revision cycle for D-13. The human annotates, clicks "Request Revision", and the planner agent revises the plan to address all notes without implementing anything.
Output: Revision runner module, API endpoint, UI button + streaming output panel.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-45-revision-cycle-with-agent/PLAN.md
@.planning/milestones/M-45-revision-cycle-with-agent/A-96-SUMMARY.md
@.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-93-SUMMARY.md
@.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-94-SUMMARY.md
@src/server/derivation-runner.js
@src/server/process-manager.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create revision-runner.js and wire API endpoint</name>
  <files>src/server/revision-runner.js, src/server/index.js</files>
  <action>
**Create src/server/revision-runner.js** following the exact pattern of src/server/derivation-runner.js:

1. Module structure: `createRevisionRunner(sseClients, cwd)` returns `{ revise, stop, running }`.

2. `revise(nodeId, artifactPath, artifactContent, annotations)`:
   - If already running, return `{ error: 'busy', status: 409 }`.
   - Generate sessionId: `revision-${Date.now()}`
   - Build prompt (see below)
   - Before spawning, copy current artifact to versioned backup:
     - Read current revisionRound from annotation data: `const annPath = path.join(cwd, '.planning', 'annotations', nodeId.toUpperCase() + '.json'); const annData = JSON.parse(fs.readFileSync(annPath, 'utf-8')); const round = annData.revisionRound || 0;`
     - Copy `{artifactPath}` to `{artifactPath.replace('.md', '')}.v${round}.md` (e.g. `A-95-EXEC-PLAN.v0.md`)
   - Spawn: `spawn('claude', ['-p', prompt, '--output-format', 'text', '--no-input'], { cwd, env: { ...process.env, FORCE_COLOR: '0' } })`
   - Wire stdout/stderr line handlers that broadcast SSE event `revision-output` with `{ sessionId, nodeId, text, stream }` (same line-buffered pattern as derivation-runner)
   - Accumulate full stdout text
   - On close (exitCode === 0):
     - Write accumulated stdout to the artifact file (overwrite), stripping any markdown fencing if present (the agent may wrap in ```markdown ... ```)
     - Increment revisionRound: read annotations, increment revisionRound, write back
     - Broadcast `revision-complete` with `{ sessionId, nodeId, exitCode, revisionRound: newRound }`
   - On close (exitCode !== 0) or on error:
     - Do NOT overwrite the artifact
     - Broadcast `revision-complete` with `{ sessionId, nodeId, exitCode: exitCode ?? -1, error: true }`

3. Prompt construction:
```
You are revising a plan artifact based on reviewer annotations. Do NOT implement anything — only update the plan document.

## Current plan content

${artifactContent}

## Reviewer annotations to address

${annotations.map(a => `- Line ${a.line}: ${a.text}`).join('\n')}

## Instructions

Revise the plan above to address ALL the reviewer's annotations. Output ONLY the revised plan content — no explanations, no markdown fencing, no preamble. The output will directly replace the current file.
```

**Wire into src/server/index.js:**

1. Add require: `const { createRevisionRunner } = require('./revision-runner');`

2. Add singleton pattern (same as derivationRunner):
```
let revisionRunner = null;
function getRevisionRunner(cwd) {
  if (!revisionRunner) revisionRunner = createRevisionRunner(sseClients, cwd);
  return revisionRunner;
}
```

3. Add handler `async function handleRevise(req, res, cwd)`:
   - Parse JSON body, extract `nodeId`
   - Determine artifact path using findMilestoneFolder and graph data:
     - For actions: find milestone, get folder, construct `A-XX-EXEC-PLAN.md` path
     - For milestones: find folder, use `PLAN.md`
     - For declarations: use `.planning/FUTURE.md`
   - Read artifact content from disk (`fs.readFileSync`)
   - Read open annotations: `readAnnotations(cwd, nodeId).annotations.filter(a => !a.resolved)` — but per current implementation annotations are deleted on resolve, so just use all annotations
   - If no annotations, return 400 `{ error: 'no_annotations' }`
   - Call `getRevisionRunner(cwd).revise(nodeId, fullArtifactPath, artifactContent, annotations)`
   - Return 202 `{ ok: true, sessionId }`

4. Add handler `function handleReviseStop(res, cwd)`:
   - Call `getRevisionRunner(cwd).stop()`
   - Return result

5. Wire routes:
   - `POST /api/node/:id/revise` -> handleRevise (match: `method === 'POST' && urlPath.match(/^\/api\/node\/([^/]+)\/revise$/)`)
   - `POST /api/revise/stop` -> handleReviseStop

6. After successful revision (in revision-runner.js on close), also call `setReviewState(cwd, nodeId, 'in_review')` to transition the node back for re-review. To do this cleanly: have the revision-runner accept an `onComplete` callback that index.js provides, which calls setReviewState. Or simpler: have the handleRevise handler set up a polling check. Simplest approach: in revision-runner.js, after writing the file and incrementing round, also write the review state directly by reading/writing the appropriate file. Actually, cleanest: pass `setReviewState` as a dependency to createRevisionRunner. Signature becomes `createRevisionRunner(sseClients, cwd, { setReviewState })`. On successful completion, call `setReviewState(cwd, nodeId, 'in_review')` and `broadcastChange()` (pass broadcastChange too, or just call it in index.js's broadcast via SSE).

Actually, simplest pattern matching derivation-runner: just handle the state transition in revision-runner.js directly. Import setReviewState from wherever it's defined, or just do the file write inline. Since setReviewState is defined in index.js (not exported), the cleanest approach is: have revision-runner accept an `onComplete(nodeId)` callback. In index.js when creating the runner: `createRevisionRunner(sseClients, cwd, (nodeId) => { setReviewState(cwd, nodeId, 'in_review'); broadcastChange(); })`. The revision-runner calls this after successful revision.
  </action>
  <verify>
- `node -e "require('./src/server/revision-runner.js')"` loads without error
- Server starts without errors
- `curl -s -X POST http://localhost:3847/api/node/A-95/revise -H 'Content-Type: application/json' -d '{"nodeId":"A-95"}'` returns 400 (no annotations) or 202 (if annotations exist)
  </verify>
  <done>revision-runner.js created following derivation-runner pattern. POST /api/node/:id/revise endpoint spawns Claude CLI with annotations bundled into prompt. On success: artifact versioned, overwritten with revised content, revisionRound incremented, review state set to in_review.</done>
</task>

<task type="auto">
  <name>Task 2: Add Request Revision button and streaming output panel to UI</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
**In src/server/public/app.js:**

1. Add module-level state: `let revisionSessionId = null; let revisionNodeId = null;`

2. In `renderAnnotationPanel()`, after the approve button logic (around line 1419), add a "Request Revision" button when there are unresolved annotations (i.e., `annotations.length > 0`). Insert before `$panelBody.appendChild(el)`:
```javascript
if (annotations.length > 0) {
  const reviseHtml = `<div class="ann-revise-section">
    <button class="ann-revise-btn" id="ann-revise-btn">Request Revision</button>
    <div class="ann-revise-hint">Send ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} to planner agent for revision</div>
  </div>`;
  el.insertAdjacentHTML('beforeend', reviseHtml);
}
```

3. Wire the click handler in the annotation panel's event delegation (inside the `el.addEventListener('click', ...)` block). Add before the final closing:
```javascript
if (e.target.id === 'ann-revise-btn') {
  e.target.disabled = true;
  e.target.textContent = 'Revising...';
  revisionNodeId = nodeId;
  try {
    const resp = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/revise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId })
    });
    if (resp.ok) {
      const data = await resp.json();
      revisionSessionId = data.sessionId;
      showRevisionPanel(nodeId);
    } else {
      e.target.disabled = false;
      e.target.textContent = 'Request Revision';
    }
  } catch (_) {
    e.target.disabled = false;
    e.target.textContent = 'Request Revision';
  }
  return;
}
```

4. Add `showRevisionPanel(nodeId)` function:
   - Create or show a `#revision-panel` div overlaid on the detail pane (or appended below annotation panel)
   - Contains: header "Revising {nodeId}...", a `<pre id="revision-output"></pre>` for streamed text, a "Stop" button
   - The pre element auto-scrolls as text arrives

5. Add SSE listener for `revision-output` and `revision-complete` events. In the existing SSE connection setup (find where `source.addEventListener` calls are), add:
```javascript
source.addEventListener('revision-output', (e) => {
  const data = JSON.parse(e.data);
  if (data.sessionId !== revisionSessionId) return;
  const outputEl = document.getElementById('revision-output');
  if (outputEl) {
    outputEl.textContent += data.text + '\n';
    outputEl.scrollTop = outputEl.scrollHeight;
  }
});

source.addEventListener('revision-complete', (e) => {
  const data = JSON.parse(e.data);
  if (data.sessionId !== revisionSessionId) return;
  revisionSessionId = null;
  const panel = document.getElementById('revision-panel');
  if (panel) {
    if (data.error) {
      panel.querySelector('.revision-panel-header').textContent = 'Revision failed';
    } else {
      panel.querySelector('.revision-panel-header').textContent = `Revision complete (Round ${data.revisionRound})`;
      // Re-render annotation panel to show updated round and refreshed content
      setTimeout(() => {
        if (revisionNodeId) {
          const type = revisionNodeId.startsWith('A-') ? 'action' : revisionNodeId.startsWith('M-') ? 'milestone' : 'declaration';
          renderAnnotationPanel(revisionNodeId, type);
        }
      }, 500);
    }
  }
});
```

6. Wire the Stop button in revision panel to `POST /api/revise/stop`.

**In src/server/public/index.html**, add CSS:

- `.ann-revise-section`: padding 12px 8px, border-top 1px solid #e5e7eb, margin-top 8px
- `.ann-revise-btn`: background #7c3aed (purple), color white, border none, padding 8px 16px, border-radius 6px, cursor pointer, font-weight 600, width 100%
- `.ann-revise-btn:hover`: background #6d28d9
- `.ann-revise-btn:disabled`: opacity 0.6, cursor not-allowed
- `.ann-revise-hint`: font-size 11px, color #6b7280, margin-top 4px, text-align center
- `#revision-panel`: background #1e1b2e, border-radius 8px, padding 12px, margin-top 12px
- `.revision-panel-header`: color #c4b5fd, font-weight 600, margin-bottom 8px, font-size 13px
- `#revision-output`: background #0f0d1a, color #e2e8f0, font-size 11px, font-family monospace, padding 8px, border-radius 4px, max-height 300px, overflow-y auto, white-space pre-wrap, word-break break-word
- `.revision-stop-btn`: background #ef4444, color white, border none, padding 4px 12px, border-radius 4px, cursor pointer, margin-top 8px, font-size 12px
  </action>
  <verify>
Open dashboard, select an action node that has annotations. Verify "Request Revision" button appears. Click it and observe streaming output in the revision panel. On completion, verify the EXEC-PLAN file was updated and a .v0.md backup was created.
  </verify>
  <done>"Request Revision" button appears when annotations exist, spawns Claude revision subprocess, streams output to dark panel, overwrites artifact on success, increments revision round, transitions review state to in_review.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Full revision request flow: button in annotation panel triggers Claude subprocess that revises EXEC-PLANs based on reviewer annotations, with real-time streaming output, artifact versioning, and round tracking.</what-built>
  <how-to-verify>
    1. Open dashboard at http://localhost:3847
    2. Select an action node (e.g., A-95 or A-96)
    3. Add 1-2 annotations via the annotation panel
    4. Verify "Request Revision" button appears with annotation count
    5. Click "Request Revision"
    6. Observe streaming output in the dark revision panel
    7. Wait for completion — verify "Revision complete (Round 1)" message
    8. Check that the EXEC-PLAN file was updated on disk
    9. Check that a .v0.md backup file was created
    10. Verify the round badge in the annotation header now shows "Round 1"
    11. Verify the node's review state badge shows "in_review" (not "revision_needed")
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- revision-runner.js follows same pattern as derivation-runner.js (singleton, SSE broadcast, line buffering)
- POST /api/node/:id/revise returns 202 and spawns subprocess
- POST /api/revise/stop kills running revision
- Artifact versioned to .vN.md before overwrite
- Revision round incremented in annotations metadata
- Review state transitions to in_review after successful revision
- UI button only appears when annotations exist
- Streaming output visible in real time
- Completion message shown with round number
</verification>

<success_criteria>
User can annotate an EXEC-PLAN, click "Request Revision", watch the agent revise the plan in real time, and see the updated artifact with incremented round counter. The old version is preserved as a backup.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-45-revision-cycle-with-agent/A-95-SUMMARY.md`
</output>
