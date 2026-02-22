---
milestone: M-29-execution-log-per-milestone
action: A-62
type: execute
wave: 2
depends_on: ["A-61"]
files_modified:
  - src/server/index.js
  - src/server/public/app.js
autonomous: true
declarations: ["D-08"]
must_haves:
  truths:
    - "GET /api/milestones/:id/log returns the execution.log content as plain text"
    - "The milestone detail panel in the dashboard shows a scrollable log viewer"
    - "The log viewer auto-scrolls to the bottom and preserves monospace formatting"
    - "Missing log files return an empty response, not an error"
  artifacts:
    - path: "src/server/index.js"
      provides: "GET /api/milestones/:id/log route handler"
      contains: "execution.log"
    - path: "src/server/public/app.js"
      provides: "Scrollable log viewer in milestone detail panel"
      contains: "execution-log"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/milestones/:id/log"
      via: "fetch call when milestone is selected"
      pattern: "fetch.*api/milestones.*log"
    - from: "src/server/index.js"
      to: ".planning/milestones/M-XX-*/execution.log"
      via: "fs.readFile in route handler"
      pattern: "execution\\.log"
---

<objective>
Add a log API endpoint and a scrollable log viewer panel so users can read the persistent execution history for any milestone directly in the dashboard.

Purpose: Complete D-08 (Live Execution Visibility) for milestone-level execution history — users see what happened during past agent runs without leaving the browser.

Output: New GET route in index.js + log viewer component in the dashboard UI.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-29-execution-log-per-milestone/A-61-SUMMARY.md
@src/server/index.js
@src/server/public/app.js
@src/artifacts/milestone-folders.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GET /api/milestones/:id/log route</name>
  <files>src/server/index.js</files>
  <action>
Add a new route handler and wire it into the router in `src/server/index.js`.

1. Add a new handler function `handleMilestoneLog(res, cwd, milestoneId)`:
   - Import `findMilestoneFolder` (already used in process-manager, add require at top): `const { findMilestoneFolder } = require('../artifacts/milestone-folders');`
   - Resolve the milestone folder: `const planningDir = path.join(cwd, '.planning');`
   - `const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);`
   - If milestoneFolder is null, return `sendJson(res, 404, { error: 'Milestone folder not found' })`.
   - `const logPath = path.join(milestoneFolder, 'execution.log');`
   - Read the file with `fs.readFile(logPath, 'utf-8', (err, data) => { ... })`.
   - If err (ENOENT), return plain text empty response: `res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end('');`
   - If success, return plain text: `res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Access-Control-Allow-Origin': '*' }); res.end(data);`

2. In the `route()` function, add a new route match BEFORE the existing `milestoneMatch` (since `/api/milestone/:id/log` is more specific than `/api/milestone/:id`):
   ```js
   const milestoneLogMatch = urlPath.match(/^\/api\/milestone\/([^/]+)\/log$/);
   if (milestoneLogMatch) {
     handleMilestoneLog(res, cwd, milestoneLogMatch[1]);
     return;
   }
   ```

Note: The route uses `/api/milestone/:id/log` (singular "milestone") to match the existing `/api/milestone/:id` pattern already in the codebase.
  </action>
  <verify>
`node -e "require('./src/server/index.js')"` — no syntax errors.
`grep "milestoneLogMatch" src/server/index.js` — route wired.
`grep "execution.log" src/server/index.js` — log file path referenced.
  </verify>
  <done>
GET /api/milestone/:id/log returns the execution.log content as plain text (or empty 200 if no log exists). 404 if milestone folder not found.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add scrollable log viewer to milestone detail panel</name>
  <files>src/server/public/app.js</files>
  <action>
Add a log viewer section to the milestone detail panel in `src/server/public/app.js`. Follow the existing patterns for the action detail panel (output-log styling).

1. Find the function that renders milestone details in the side panel (or column browser detail area). Look for where milestone node clicks are handled and the panel HTML is built — likely in a function that handles `showNodeDetail` or similar for milestones.

2. After the existing milestone detail content (actions list, wholeness badge, etc.), add a "Execution Log" section:
   ```js
   html += `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
     <div class="detail-label" style="display:flex;align-items:center;justify-content:space-between">
       Execution Log
       <button id="refresh-log-btn" style="font-size:10px;padding:2px 8px;cursor:pointer;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;color:var(--text-dim)" title="Refresh log">&#8635;</button>
     </div>
     <pre id="milestone-exec-log" class="output-log" style="margin-top:8px;max-height:300px;overflow-y:auto;font-size:11px;white-space:pre-wrap;word-break:break-all"></pre>
   </div>`;
   ```

3. Add a function `loadMilestoneLog(milestoneId)`:
   ```js
   async function loadMilestoneLog(milestoneId) {
     const logEl = document.getElementById('milestone-exec-log');
     if (!logEl) return;
     try {
       const res = await fetch(`/api/milestone/${encodeURIComponent(milestoneId)}/log`);
       const text = await res.text();
       if (text.trim()) {
         logEl.textContent = text;
         logEl.scrollTop = logEl.scrollHeight;
       } else {
         logEl.innerHTML = '<span style="opacity:0.4;font-style:italic">No execution log yet</span>';
       }
     } catch (e) {
       logEl.innerHTML = '<span style="opacity:0.4;font-style:italic">Could not load log</span>';
     }
   }
   ```

4. Call `loadMilestoneLog(milestoneId)` after rendering the milestone detail HTML. Wire the refresh button:
   ```js
   const refreshLogBtn = document.getElementById('refresh-log-btn');
   if (refreshLogBtn) {
     refreshLogBtn.addEventListener('click', () => loadMilestoneLog(milestoneId));
   }
   ```

5. Reuse the existing `.output-log` CSS class (already styled for the action execution output panel — monospace, dark background, scrollable). If the class isn't defined in the CSS, add it in the `<style>` block of index.html:
   ```css
   .output-log {
     background: var(--bg-main, #1a1a2e);
     border: 1px solid var(--border);
     border-radius: 6px;
     padding: 10px;
     font-family: 'SF Mono', Menlo, monospace;
     font-size: 11px;
     line-height: 1.5;
     color: var(--text-dim);
   }
   ```

The log viewer should appear in BOTH the side panel (DAG view) and the column browser detail view if milestones render details in both places. Check where milestone detail rendering happens and add the log section to all code paths.
  </action>
  <verify>
`grep "milestone-exec-log" src/server/public/app.js` — log viewer element exists.
`grep "loadMilestoneLog" src/server/public/app.js` — fetch function exists.
`grep "/api/milestone.*log" src/server/public/app.js` — API call wired.
  </verify>
  <done>
The milestone detail panel shows a scrollable "Execution Log" section with monospace-formatted log content, a refresh button, and graceful handling of empty/missing logs. The viewer appears wherever milestone details are rendered in the dashboard.
  </done>
</task>

<task type="auto">
  <name>Task 3: Rebuild bundle</name>
  <files>dist/declare-tools.cjs</files>
  <action>
Run `npm run build` to rebuild the CJS bundle with the updated server index.js.

After build, verify:
1. `grep "execution.log" dist/declare-tools.cjs` returns matches
2. `grep "milestoneLogMatch" dist/declare-tools.cjs` returns matches
3. `node dist/declare-tools.cjs --help` runs without error

Note: The frontend app.js is served as a static file, not bundled — it just needs to exist in src/server/public/. But index.js IS bundled into declare-tools.cjs, so the build is required for the API route.
  </action>
  <verify>
`npm run build` exits 0.
`grep -c "milestoneLogMatch" dist/declare-tools.cjs` returns >= 1.
  </verify>
  <done>
dist/declare-tools.cjs rebuilt with the log API route. Dashboard serves the updated app.js with the log viewer.
  </done>
</task>

</tasks>

<verification>
1. `node -e "require('./src/server/index.js')"` — no errors
2. `npm run build` — exits 0
3. Start server with `node dist/declare-tools.cjs serve`, then:
   - `curl http://localhost:3847/api/milestone/M-29/log` — returns 200 (empty or with log content)
   - Open `http://localhost:3847` — milestone detail shows "Execution Log" section
</verification>

<success_criteria>
GET /api/milestone/:id/log serves execution log content as plain text. The dashboard milestone detail panel displays a scrollable, monospace-formatted log viewer with a refresh button. Empty logs show a graceful placeholder message.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-29-execution-log-per-milestone/A-62-SUMMARY.md`
</output>
