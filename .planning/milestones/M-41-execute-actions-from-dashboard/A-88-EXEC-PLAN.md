---
milestone: M-41-execute-actions-from-dashboard
action: A-88
type: execute
wave: 2
depends_on: ["A-87"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations: ["D-08"]
must_haves:
  truths:
    - "User sees an Execute button on PENDING actions that have an exec-plan"
    - "Clicking Execute sends POST to /api/action/:id/execute and shows Running... state"
    - "A Stop button replaces Execute while the action is running"
    - "Live output streams into a monospace dark log panel below the exec-plan detail"
    - "Log panel auto-scrolls to bottom as new output arrives"
    - "On action-complete SSE event, exit code is shown, Execute re-enables, and graph refreshes"
    - "Running actions show a pulsing border indicator on their graph node"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Execute/Stop button logic, SSE output subscription, running indicator on nodes"
    - path: "src/server/public/index.html"
      provides: "CSS for execute button, output log panel, running node animation"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/action/:id/execute"
      via: "fetch POST on button click"
      pattern: "fetch.*api/action.*execute"
    - from: "src/server/public/app.js"
      to: "/api/action/:id/stop"
      via: "fetch POST on stop button click"
      pattern: "fetch.*api/action.*stop"
    - from: "src/server/public/app.js"
      to: "/events SSE"
      via: "EventSource listener for action-output and action-complete events"
      pattern: "addEventListener.*action-output|action-complete"
    - from: "src/server/public/app.js"
      to: "/api/running"
      via: "fetch on graph load to mark running actions"
      pattern: "fetch.*api/running"
---

<objective>
Add an Execute button, Stop button, live output panel, and running indicator to the dashboard so users can trigger and monitor action execution directly from the browser.

Purpose: This is the frontend half of M-41 (Execute actions from dashboard). A-87 provides the server endpoints; this action wires the UI to those endpoints.
Output: Modified app.js and index.html with execution controls and live streaming output.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-41-execute-actions-from-dashboard/PLAN.md
@.planning/milestones/M-41-execute-actions-from-dashboard/A-87-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CSS styles and wire Execute/Stop button + live output panel into the action detail view</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**index.html changes — add these CSS rules inside the existing style block:**

1. `.exec-btn` — button base style matching dashboard aesthetic:
   - `background: var(--act-bg); border: 1px solid var(--act-border); color: var(--act-color);`
   - `padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;`
   - `display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s, border-color 0.15s;`
   - Hover: `background: #0d2818; border-color: #2a6a48;`
   - `&:disabled` — `opacity: 0.5; cursor: not-allowed;`

2. `.exec-btn.stop` — stop button variant:
   - `background: var(--broken-bg); border-color: var(--broken-border); color: var(--broken-color);`
   - Hover: `background: #3a0e18; border-color: #7a2035;`

3. `.output-log` — live output log panel:
   - `background: #0a0a0e; border: 1px solid var(--border); border-radius: 6px;`
   - `padding: 10px 12px; margin-top: 12px; max-height: 300px; overflow-y: auto;`
   - `font-family: monospace; font-size: 11px; line-height: 1.5; color: var(--text-dim);`
   - `white-space: pre-wrap; word-break: break-all;`
   - Custom scrollbar: same as `#panel-body` scrollbar styles.

4. `.output-log .exit-code` — exit code display:
   - `display: block; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);`
   - `font-weight: 700;`
   - `.exit-code.success` — `color: var(--act-color);`
   - `.exit-code.failure` — `color: var(--broken-color);`

5. Running node animation — `.node.is-running`:
   - `animation: running-pulse 1.8s ease-in-out infinite;`
   - `box-shadow: 0 0 0 2px var(--executing-color), 0 0 16px rgba(251,191,36,0.2);`
   - `@keyframes running-pulse { 0%,100% { box-shadow: 0 0 0 2px var(--executing-color), 0 0 16px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 0 3px var(--executing-color), 0 0 24px rgba(251,191,36,0.35); } }`

**app.js changes — add execution UI logic:**

1. **Add state tracking** at the top state section:
   - `let runningActions = new Set();` — tracks which action IDs are currently executing
   - `let outputEventSource = null;` — current SSE connection for action output
   - `let currentOutputActionId = null;` — which action's output we're listening to

2. **Add `fetchRunningActions()` function:**
   - `GET /api/running` — returns `{ running: ["A-88", ...] }` (array of action IDs)
   - On success, store result in `runningActions` Set
   - Call this from `loadData()` right after the existing `Promise.all` (add it as a third fetch, catching errors so it doesn't block)
   - After storing, call `updateRunningIndicators()`

3. **Add `updateRunningIndicators()` function:**
   - Query all `.node-action` elements
   - For each, check if its `data-node-id` is in `runningActions`
   - If yes, add class `is-running`; if no, remove class `is-running`
   - Call this at the end of `renderGraph()` as well

4. **Modify `loadExecPlan()` function** to inject the Execute/Stop button:
   - After the metadata bar (the `metaParts` / `modelBadgeHtml` div), insert a button container div
   - Find the action in `graphData.actions` to get its status
   - Conditions for showing Execute button:
     - Action status is NOT in COMPLETED set (`DONE`, `KEPT`, `HONORED`)
     - Exec-plan was successfully loaded (no `data.error` and `data.execPlan` exists)
     - Action is NOT in `runningActions` set
   - If action IS in `runningActions`, show Stop button instead
   - Button HTML for Execute: `<button class="exec-btn" id="exec-action-btn" data-action-id="${actionId}">&#9654; Execute</button>`
   - Button HTML for Stop: `<button class="exec-btn stop" id="stop-action-btn" data-action-id="${actionId}">&#9632; Stop</button>`
   - After setting `container.innerHTML`, attach click handlers:
     - `#exec-action-btn` click: call `executeAction(actionId)`
     - `#stop-action-btn` click: call `stopAction(actionId)`

5. **Add `executeAction(actionId)` function:**
   - `POST /api/action/${actionId}/execute` with empty body
   - On response: if OK, add actionId to `runningActions`, call `updateRunningIndicators()`
   - Disable the button, change text to "Running..."
   - Call `subscribeToOutput(actionId)` to start listening for output
   - On error: show error in the output log panel

6. **Add `stopAction(actionId)` function:**
   - `POST /api/action/${actionId}/stop` with empty body
   - On response: disable the stop button, change text to "Stopping..."

7. **Add `subscribeToOutput(actionId)` function:**
   - If `outputEventSource` exists, close it first
   - Set `currentOutputActionId = actionId`
   - Create or clear the output log div: find or create `#output-log` element below `#exec-plan-detail`
   - Connect to the existing `/events` SSE (reuse the global EventSource — do NOT create a second one)
   - Instead: Add event listeners to the existing EventSource connection for `action-output` and `action-complete` events
   - **Approach:** Modify the existing `connectSSE()` function to also listen for `action-output` and `action-complete` events:
     - `action-output` event: parse `data` as JSON `{ actionId, text }`. If `actionId` matches `currentOutputActionId`, append `text` to the `#output-log` element. Auto-scroll to bottom: `logEl.scrollTop = logEl.scrollHeight`
     - `action-complete` event: parse `data` as JSON `{ actionId, exitCode }`. If `actionId` matches `currentOutputActionId`:
       - Append exit code line: `<span class="exit-code ${exitCode === 0 ? 'success' : 'failure'}">Process exited with code ${exitCode}</span>`
       - Remove actionId from `runningActions`
       - Call `updateRunningIndicators()`
       - Call `loadData()` to refresh the graph (action status may have changed)
       - Re-render the exec-plan panel to swap Stop back to Execute (call `loadExecPlan(actionId)` or find and swap the button)
       - Set `currentOutputActionId = null`

8. **Add the output log panel creation:**
   - In `loadExecPlan()`, after all the exec-plan HTML, append: `<div id="output-log" class="output-log" style="display:none"></div>`
   - When `subscribeToOutput` is called, show it (`style.display = ''`) and clear its content
   - If the action is already running when the panel loads (action is in `runningActions`), immediately show the log panel and call `subscribeToOutput(actionId)`

9. **Modify `connectSSE()`** to add the two new event listeners:
   - `es.addEventListener('action-output', (e) => { ... })` — route to output log
   - `es.addEventListener('action-complete', (e) => { ... })` — route to completion handler
   - Keep all existing listeners (change, activity, error) untouched

10. **CORS for POST:** The server route function in index.js currently only allows GET. A-87 will have added POST support. In app.js, use `fetch(url, { method: 'POST' })` — the server's CORS headers from A-87 will handle it. No changes needed to CORS in app.js.
  </action>
  <verify>
Run `node -c src/server/public/app.js` to verify no syntax errors.
Run `grep -c 'executeAction\|stopAction\|subscribeToOutput\|output-log\|is-running\|exec-btn' src/server/public/app.js` — should return 6+ matches.
Run `grep -c 'exec-btn\|output-log\|is-running\|running-pulse' src/server/public/index.html` — should return 4+ matches.
  </verify>
  <done>
Execute button appears on PENDING actions with exec-plans. Stop button appears when running. Live output panel streams text from SSE action-output events. Running actions have pulsing border on graph nodes. On action-complete, exit code shown, button reverts, graph refreshes.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Execute/Stop button and live output panel in the dashboard action detail view, with running indicators on graph nodes</what-built>
  <how-to-verify>
    1. Start the server: `node dist/declare-tools.cjs serve` (or however the dev server starts)
    2. Open http://localhost:3847 in a browser
    3. Click on any PENDING action node that has an exec-plan
    4. Verify the Execute button appears after the metadata bar (wave, autonomous, model badge)
    5. Click Execute — verify:
       - Button changes to "Running..." and is disabled
       - A Stop button appears
       - The output log panel appears below the exec-plan
       - Streaming text appears in the log panel as SSE events arrive
       - The action's graph node gets a pulsing yellow border
    6. When execution completes, verify:
       - Exit code appears at bottom of log
       - Button reverts to Execute
       - Graph refreshes (action status may change)
       - Pulsing border disappears
    7. If an action is already running when you click on it, verify the Stop button and live log are shown immediately
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `node -c src/server/public/app.js` — no syntax errors
- Execute button only appears for PENDING actions with exec-plans (not DONE actions)
- Stop button replaces Execute while running
- Output log panel streams SSE events with auto-scroll
- Running actions have visible pulsing indicator on graph nodes
- action-complete event triggers cleanup: exit code shown, button restored, graph refreshed
</verification>

<success_criteria>
Users can trigger action execution from the dashboard, monitor live output in a streaming log panel, stop running actions, and see running indicators on graph nodes. The full execute-monitor-complete cycle works end-to-end through the browser.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-41-execute-actions-from-dashboard/A-88-SUMMARY.md`
</output>
