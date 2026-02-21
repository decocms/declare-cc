---
milestone: M-26-real-time-agent-output-streaming
action: A-56
type: execute
wave: 3
depends_on:
  - A-55
files_modified:
  - dist/public/app.js
  - dist/public/index.html
autonomous: false
declarations:
  - D-08
user_setup: []

must_haves:
  truths:
    - "When an agent run is active, a live output panel is visible in the UI"
    - "Output lines appear in real-time as the subprocess produces them"
    - "Each line is tagged with the action ID it belongs to"
    - "stdout and stderr are visually distinguishable"
    - "The panel auto-scrolls to show the latest output"
    - "When the run completes, a done/error indicator appears"
  artifacts:
    - path: "dist/public/index.html"
      provides: "Live output panel HTML and CSS"
      contains: "live-output"
    - path: "dist/public/app.js"
      provides: "SSE /api/stream subscription and DOM rendering logic"
      contains: "api/stream"
  key_links:
    - from: "dist/public/app.js"
      to: "/api/stream"
      via: "new EventSource('/api/stream')"
      pattern: "EventSource.*api/stream"
    - from: "dist/public/app.js"
      to: "dist/public/index.html"
      via: "getElementById for live-output panel elements"
      pattern: "getElementById.*live-output"
---

<objective>
Build a live output panel in the dashboard UI that subscribes to the `/api/stream` SSE endpoint and renders agent subprocess output in real-time, scoped by action ID.

Purpose: The human sees agent work as it happens — the core promise of D-08 (Live Execution Visibility).
Output: Updated `dist/public/index.html` (HTML + CSS) and `dist/public/app.js` (JS logic).
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@dist/public/index.html
@dist/public/app.js
@.planning/milestones/M-26-real-time-agent-output-streaming/A-55-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add live output panel HTML/CSS and JS subscription</name>
  <files>dist/public/index.html, dist/public/app.js</files>
  <action>
**HTML changes (dist/public/index.html):**

Add a live output panel element. Place it as a sibling to the existing `#side-panel`, positioned at the bottom of the viewport as a collapsible drawer:

```html
<!-- Live output panel — bottom drawer for agent streaming output -->
<div id="live-output" class="live-output-collapsed">
  <div id="live-output-header">
    <span id="live-output-title">Agent Output</span>
    <span id="live-output-status"></span>
    <button id="live-output-toggle" title="Toggle output panel">&#9650;</button>
    <button id="live-output-clear" title="Clear output">&#10005;</button>
  </div>
  <div id="live-output-body">
    <pre id="live-output-log"></pre>
  </div>
</div>
```

Add CSS for the live output panel (add to the existing `<style>` block):

```css
/* ── Live output panel — bottom drawer ── */
#live-output {
  position: fixed;
  bottom: 0;
  left: 0;
  right: var(--panel-width);
  z-index: 100;
  background: var(--surface);
  border-top: 1px solid var(--border);
  transition: height 0.2s ease;
  display: flex;
  flex-direction: column;
}

#live-output.live-output-collapsed {
  height: 36px;
}

#live-output.live-output-expanded {
  height: 280px;
}

#live-output-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
  height: 36px;
}

#live-output-title {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-bright);
}

#live-output-status {
  font-size: 11px;
  color: var(--text-dim);
  flex: 1;
}

#live-output-toggle, #live-output-clear {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
}

#live-output-toggle:hover, #live-output-clear:hover {
  color: var(--text-bright);
}

#live-output-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  display: none;
}

#live-output.live-output-expanded #live-output-body {
  display: block;
}

#live-output-log {
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.5;
  padding: 8px 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
}

#live-output-log .lo-action-tag {
  color: var(--act-color);
  font-weight: 600;
  margin-right: 6px;
}

#live-output-log .lo-stderr {
  color: var(--broken-color);
}

#live-output-log .lo-done {
  color: var(--act-color);
  font-weight: 600;
}

#live-output-log .lo-error {
  color: var(--broken-color);
  font-weight: 600;
}

#live-output-body::-webkit-scrollbar { width: 4px; }
#live-output-body::-webkit-scrollbar-track { background: transparent; }
#live-output-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* When live output is expanded, reduce the DAG area height */
#live-output.live-output-expanded ~ #dag-container,
body:has(#live-output.live-output-expanded) #dag-container {
  padding-bottom: 280px;
}
```

**JS changes (dist/public/app.js):**

Add a new section after the SSE `connectSSE()` function (around line 1480). Add these pieces:

1. **DOM refs for live output:**
```js
const $liveOutput     = document.getElementById('live-output');
const $liveOutputLog  = document.getElementById('live-output-log');
const $liveOutputToggle = document.getElementById('live-output-toggle');
const $liveOutputClear  = document.getElementById('live-output-clear');
const $liveOutputStatus = document.getElementById('live-output-status');
const $liveOutputHeader = document.getElementById('live-output-header');
```

2. **Toggle behavior:**
```js
function toggleLiveOutput() {
  const isExpanded = $liveOutput.classList.contains('live-output-expanded');
  $liveOutput.classList.toggle('live-output-expanded', !isExpanded);
  $liveOutput.classList.toggle('live-output-collapsed', isExpanded);
  $liveOutputToggle.innerHTML = isExpanded ? '&#9650;' : '&#9660;';
}

$liveOutputHeader.addEventListener('click', toggleLiveOutput);
$liveOutputClear.addEventListener('click', (e) => {
  e.stopPropagation();
  $liveOutputLog.innerHTML = '';
  $liveOutputStatus.textContent = '';
});
```

3. **SSE subscription to /api/stream:**
```js
let streamSource = null;
let activeActionIds = new Set();

function connectStream() {
  if (streamSource) { try { streamSource.close(); } catch(_){} }
  streamSource = new EventSource('/api/stream');

  streamSource.addEventListener('message', (e) => {
    try {
      const event = JSON.parse(e.data);

      // Handle active_runs initial state
      if (event.type === 'active_runs') {
        event.runs.forEach(id => activeActionIds.add(id));
        updateStreamStatus();
        // Auto-expand if runs are active
        if (activeActionIds.size > 0 && $liveOutput.classList.contains('live-output-collapsed')) {
          toggleLiveOutput();
        }
        return;
      }

      const { actionId, chunk, type } = event;

      if (type === 'stdout') {
        activeActionIds.add(actionId);
        appendOutputLine(actionId, chunk, 'stdout');
      } else if (type === 'stderr') {
        activeActionIds.add(actionId);
        appendOutputLine(actionId, chunk, 'stderr');
      } else if (type === 'done') {
        activeActionIds.delete(actionId);
        appendOutputLine(actionId, `[done] exit code ${event.exitCode}`, 'done');
      } else if (type === 'error') {
        activeActionIds.delete(actionId);
        appendOutputLine(actionId, `[error] ${chunk || 'process failed'}`, 'error');
      }

      updateStreamStatus();
    } catch (_) { /* ignore parse errors */ }
  });

  streamSource.onerror = () => {
    // EventSource auto-reconnects; just update status
    $liveOutputStatus.textContent = 'reconnecting...';
  };
}

function appendOutputLine(actionId, text, type) {
  const line = document.createElement('div');

  const tag = document.createElement('span');
  tag.className = 'lo-action-tag';
  tag.textContent = `[${actionId}]`;
  line.appendChild(tag);

  const content = document.createElement('span');
  content.className = type === 'stderr' ? 'lo-stderr' : type === 'done' ? 'lo-done' : type === 'error' ? 'lo-error' : '';
  content.textContent = text;
  line.appendChild(content);

  $liveOutputLog.appendChild(line);

  // Auto-scroll if near bottom
  const body = document.getElementById('live-output-body');
  const isNearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
  if (isNearBottom) {
    body.scrollTop = body.scrollHeight;
  }

  // Auto-expand on first output
  if ($liveOutput.classList.contains('live-output-collapsed') && (type === 'stdout' || type === 'stderr')) {
    toggleLiveOutput();
  }
}

function updateStreamStatus() {
  if (activeActionIds.size === 0) {
    $liveOutputStatus.textContent = 'idle';
  } else {
    $liveOutputStatus.textContent = `running: ${Array.from(activeActionIds).join(', ')}`;
  }
}
```

4. **Initialize stream connection:**
Add `connectStream();` call right after or near the existing `connectSSE();` call at the bottom of the file.

Keep the existing `connectSSE()` for /events (file change notifications) intact — /api/stream is a separate SSE channel for agent output only.
  </action>
  <verify>
1. Start the server: `cd /Users/guilherme/Projects/declare-cc && node -e "require('./src/server/index.js').startServer(process.cwd()).then(({url}) => console.log(url))"`
2. Open the dashboard in a browser at http://localhost:3847
3. Verify the live output panel appears collapsed at the bottom
4. In another terminal, trigger a test run: `curl -X POST http://localhost:3847/api/agent/run -d '{"actionId":"test-echo","command":"echo","args":["hello from agent"]}'`
5. The live output panel should auto-expand and show `[test-echo] hello from agent` followed by `[test-echo] [done] exit code 0`
  </verify>
  <done>Live output panel visible in dashboard, auto-expands on agent output, shows tagged lines with action ID, distinguishes stdout/stderr/done/error, auto-scrolls, can be toggled and cleared.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete real-time agent output streaming pipeline: subprocess runner -> SSE endpoint -> live UI panel. The dashboard now shows a collapsible bottom drawer that streams agent subprocess output in real-time with action ID tagging.</what-built>
  <how-to-verify>
    1. Start the server: `cd /Users/guilherme/Projects/declare-cc && node -e "require('./src/server/index.js').startServer(process.cwd()).then(({url}) => console.log(url))"`
    2. Open http://localhost:3847 in the browser
    3. Verify: bottom of viewport shows a collapsed "Agent Output" bar
    4. In terminal, run: `curl -X POST http://localhost:3847/api/agent/run -d '{"actionId":"A-test","command":"echo","args":["streaming works"]}'`
    5. Verify: panel auto-expands, shows `[A-test] streaming works` then `[A-test] [done] exit code 0`
    6. Click the toggle button to collapse/expand
    7. Click the X button to clear output
    8. Test concurrent: run two curl commands with different actionIds quickly — both should appear tagged
    9. Verify existing dashboard still works (graph loads, nodes clickable, side panel works)
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues with the live output panel</resume-signal>
</task>

</tasks>

<verification>
- Live output panel renders in the dashboard
- SSE connection to /api/stream established on page load
- Agent output lines appear in real-time with action ID tags
- stdout (normal color) and stderr (red) are distinguishable
- done (green) and error (red) terminal events are visually distinct
- Panel auto-expands on first output, auto-scrolls to bottom
- Toggle and clear buttons work
- Existing dashboard functionality (graph, side panel, SSE file-change events) unaffected
</verification>

<success_criteria>
A working live output panel in the dashboard that streams agent subprocess output in real-time. When an agent run is triggered (via POST /api/agent/run), output appears line-by-line in the panel, tagged by action ID, with auto-scroll and visual distinction between stdout/stderr/done/error.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-26-real-time-agent-output-streaming/A-56-SUMMARY.md`
</output>
