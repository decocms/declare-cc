---
milestone: M-19-browser-based-milestone-derivation
action: A-39
type: execute
wave: 2
depends_on:
  - A-37
  - A-38
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations:
  - D-06
must_haves:
  truths:
    - "User can click a Derive Milestones button to start derivation"
    - "User sees streaming agent output in real time during derivation"
    - "User sees proposed milestones in an editable checklist after derivation completes"
    - "User can check/uncheck milestones, edit titles, then click Accept to persist"
    - "Accepted milestones appear in the graph immediately (via SSE change event)"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Derivation trigger button, streaming output panel, approval checklist"
      contains: "startDerivation"
    - path: "src/server/public/index.html"
      provides: "CSS for derivation panel"
      contains: "derivation-panel"
  key_links:
    - from: "src/server/public/app.js startDerivation"
      to: "POST /api/milestones/derive"
      via: "fetch call"
      pattern: "fetch.*milestones/derive"
    - from: "src/server/public/app.js acceptMilestones"
      to: "POST /api/milestones/derive/accept"
      via: "fetch call"
      pattern: "fetch.*derive/accept"
    - from: "src/server/public/app.js"
      to: "SSE derivation-output"
      via: "EventSource listener"
      pattern: "addEventListener.*derivation-output"
---

<objective>
Build the derivation trigger button and approval UI in the dashboard — the user clicks "Derive Milestones", sees streaming Claude output, reviews proposed milestones in a checklist, adjusts titles if needed, and accepts to persist.

Purpose: Completes the browser-based milestone derivation flow (D-06). The user never leaves the dashboard to derive milestones.

Output: Updated `src/server/public/app.js` and `src/server/public/index.html` with derivation UI.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-19-browser-based-milestone-derivation/A-37-SUMMARY.md
@.planning/milestones/M-19-browser-based-milestone-derivation/A-38-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
@src/server/derivation-runner.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add derivation UI to dashboard</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
Add milestone derivation UI to the existing dashboard. Follow the same vanilla JS patterns used throughout app.js (DOM manipulation, fetch calls, SSE listeners).

**A. CSS additions in index.html:**

Add styles for the derivation panel inside the existing `<style>` block:
```css
.derivation-panel {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  background: var(--bg);
}
.derivation-panel .output-log {
  max-height: 200px;
  overflow-y: auto;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  padding: 8px;
  background: #1a1a2e;
  color: #ccc;
  border-radius: 4px;
  white-space: pre-wrap;
  margin-bottom: 12px;
}
.derivation-checklist { list-style: none; padding: 0; margin: 8px 0; }
.derivation-checklist li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.derivation-checklist li:last-child { border-bottom: none; }
.derivation-checklist input[type="checkbox"] { flex-shrink: 0; }
.derivation-checklist input[type="text"] {
  flex: 1;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 13px;
}
.derivation-checklist .reason {
  font-size: 11px;
  color: #888;
  margin-left: 28px;
  display: block;
}
.derive-btn {
  background: var(--accent, #4a6cf7);
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.derive-btn:hover { opacity: 0.85; }
.derive-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.derive-accept-btn {
  background: #2ea043;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  margin-right: 8px;
}
.derive-cancel-btn {
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--border);
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
```

**B. JavaScript additions in app.js:**

1. **State variables** (add near top with other state):
```js
/** @type {string | null} Active derivation session ID */
let derivationSessionId = null;
/** @type {Array<{title: string, realizes: string, reason: string}> | null} */
let derivationProposals = null;
```

2. **Derive Milestones button placement.** Add the button in TWO places depending on view mode:
   - In the **column browser** declaration detail view: when a declaration is selected, show a "Derive Milestones" button if the declaration has no milestones (or few). Add this inside the declaration detail rendering function.
   - In the **DAG view** side panel: when a declaration node is selected, show the button in the panel body.

   Find where declaration detail is rendered (search for code that shows declaration info like `d.statement`). After the declaration info, add:
   ```js
   // Show derive button if declaration has few/no milestones
   html += `<div class="derivation-panel" id="derivation-panel">`;
   html += `<button class="derive-btn" id="derive-btn" onclick="startDerivation('${d.id}')">Derive Milestones</button>`;
   html += `<div id="derivation-log" class="output-log" style="display:none"></div>`;
   html += `<div id="derivation-proposals" style="display:none"></div>`;
   html += `</div>`;
   ```

3. **startDerivation(declarationId) function:**
   - POST to `/api/milestones/derive` with `{ declarationId }`
   - On success, store sessionId from response, show the log panel, disable the button
   - On error, show error message in the panel

4. **SSE listeners for derivation events.** Add alongside existing action-output/action-complete listeners in the SSE setup:
   ```js
   es.addEventListener('derivation-output', handleDerivationOutput);
   es.addEventListener('derivation-complete', handleDerivationComplete);
   ```

5. **handleDerivationOutput(e) function:**
   - Parse `{ sessionId, text }` from event data
   - If sessionId matches derivationSessionId, append text to `#derivation-log`
   - Auto-scroll to bottom (same pattern as handleActionOutput)

6. **handleDerivationComplete(e) function:**
   - Parse `{ sessionId, exitCode, milestones }` from event data
   - If sessionId matches, clear derivationSessionId
   - If milestones is a valid array, store in derivationProposals and call renderProposals()
   - If milestones is null (parse failed), show message: "Derivation finished but output could not be parsed. Check the log above."
   - If exitCode !== 0, show error message

7. **renderProposals() function:**
   - Target `#derivation-proposals` div, set display to block
   - Render a checklist with all proposed milestones checked by default:
   ```html
   <h4 style="margin:8px 0">Proposed Milestones</h4>
   <ul class="derivation-checklist">
     <li>
       <input type="checkbox" checked data-idx="0">
       <input type="text" value="milestone title" data-idx="0">
       <span class="reason">because: reason text</span>
     </li>
     ...
   </ul>
   <div style="margin-top:12px">
     <button class="derive-accept-btn" onclick="acceptDerivation()">Accept Selected</button>
     <button class="derive-cancel-btn" onclick="cancelDerivation()">Cancel</button>
   </div>
   ```

8. **acceptDerivation() function:**
   - Gather checked milestones from the checklist (read checkbox state + text input value for each)
   - Build array: `[{ title, realizes }]`
   - POST to `/api/milestones/derive/accept` with `{ milestones }`
   - On success, clear the derivation panel, show brief "N milestones created" message
   - The SSE change event will trigger graph reload automatically

9. **cancelDerivation() function:**
   - If derivation is running, POST to `/api/milestones/derive/stop`
   - Clear derivationSessionId, derivationProposals
   - Hide/reset the derivation panel

10. **stopDerivation() function:**
    - POST to `/api/milestones/derive/stop`
    - Show "Stopping..." in the button

Keep all functions in the global scope (same pattern as executeAction, stopAction). Use vanilla DOM — no frameworks. Follow the existing code style exactly (JSDoc comments, semicolons, single quotes).
  </action>
  <verify>
Start the server with `node -e "const {startServer} = require('./src/server/index.js'); startServer(process.cwd())"` and open the dashboard in a browser. Navigate to a declaration node and verify the "Derive Milestones" button appears.
  </verify>
  <done>
Derive Milestones button appears on declaration nodes. Clicking it triggers the derivation, streams output in real time, shows proposed milestones as an editable checklist, and Accept persists them to MILESTONES.md with immediate graph refresh.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete browser-based milestone derivation flow: button on declaration nodes triggers Claude derivation, streams output live, shows proposed milestones as editable checklist, accept persists to graph.</what-built>
  <how-to-verify>
    1. Start the dashboard: `declare` or `node dist/declare-tools.cjs serve`
    2. Open http://localhost:3847 in a browser
    3. Click on any declaration node (e.g., D-06)
    4. Look for the "Derive Milestones" button in the detail panel
    5. Click "Derive Milestones" — you should see streaming Claude output
    6. After derivation completes, a checklist of proposed milestones should appear
    7. Edit a milestone title, uncheck one, then click "Accept Selected"
    8. Verify the new milestones appear in the graph immediately
    9. Check MILESTONES.md to confirm they were persisted
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Dashboard loads without JS errors
- Derive button appears on declaration detail panels
- SSE derivation-output events render in the log panel
- Proposed milestones render as editable checklist after derivation-complete
- Accept call persists milestones and graph refreshes
</verification>

<success_criteria>
User can derive milestones entirely from the browser: click Derive on a declaration, watch streaming output, review/edit proposals in a checklist, accept to persist. No terminal interaction needed.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-19-browser-based-milestone-derivation/A-39-SUMMARY.md`
</output>
