---
milestone: M-52-pipeline-progress-and-failure-handling
action: A-115
type: execute
wave: 2
depends_on: ["A-114"]
files_modified:
  - src/commands/play.js
  - src/server/index.js
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations: ["D-15"]

must_haves:
  truths:
    - "When an action fails (after retry exhausted), the pipeline pauses execution"
    - "A modal appears showing the failed action ID, exit code, and three options"
    - "View Output scrolls to the failed action's output in the output panel"
    - "Skip and Continue resumes the pipeline, skipping the failed action"
    - "Stop Pipeline terminates execution entirely"
  artifacts:
    - path: "src/commands/play.js"
      provides: "Pause-on-failure logic and skip-action resume capability"
      contains: "pausedOnFailure"
    - path: "src/server/index.js"
      provides: "POST /api/pipeline/skip-action endpoint"
      contains: "/api/pipeline/skip-action"
    - path: "src/server/public/app.js"
      provides: "Failure modal rendering and button handlers"
      contains: "showFailureModal"
    - path: "src/server/public/index.html"
      provides: "Failure modal CSS styles"
      contains: "exec-failure-modal"
  key_links:
    - from: "play.js action-complete with failure"
      to: "SSE pipeline-paused event"
      via: "broadcast when exitCode !== 0"
      pattern: "pipeline-paused"
    - from: "app.js pipeline-paused handler"
      to: "showFailureModal"
      via: "SSE event listener"
      pattern: "showFailureModal"
    - from: "Skip button click"
      to: "POST /api/pipeline/skip-action"
      via: "fetch call"
      pattern: "api/pipeline/skip-action"
---

<objective>
Implement pause-on-failure behavior where the pipeline halts on action failure and shows a modal with View Output, Skip and Continue, and Stop Pipeline options.

Purpose: When an action fails during autonomous execution, the user needs to decide whether to skip it and keep going, or stop entirely. Without this, failures either silently continue or abort everything.
Output: Failure modal with three actionable options, backed by server-side pause/resume logic.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@.planning/milestones/M-52-pipeline-progress-and-failure-handling/A-114-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
@src/commands/play.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add pause-on-failure logic to play runner and skip-action endpoint</name>
  <files>src/commands/play.js, src/server/index.js</files>
  <action>
In play.js, modify createPlayRunner to support pause-on-failure:

1. Add state: `let pausedOnFailure = null;` (stores { actionId, exitCode, waveIndex } when paused), `let skipResolve = null;` (Promise resolver for skip/stop decision).

2. In the async wave execution loop (the `(async () => { ... })()` block), after `const results = await Promise.all(promises);` — check if any result has exitCode !== 0. If so:
   - For each failed result, broadcast a NEW SSE event `pipeline-paused`:
     ```js
     broadcast('pipeline-paused', { actionId: r.actionId, exitCode: r.exitCode, wave: wi + 1, totalWaves: waves.length });
     ```
   - Set `pausedOnFailure = { actionId: r.actionId, exitCode: r.exitCode, waveIndex: wi };`
   - Await a new Promise: `const decision = await new Promise(resolve => { skipResolve = resolve; });`
   - If decision === 'stop', set stopRequested = true and break
   - If decision === 'skip', clear pausedOnFailure, broadcast `pipeline-resumed` event, and continue to next wave
   - Note: only pause on the FIRST failure per wave (others in same wave already completed/failed concurrently)

3. Add `skip()` method to the returned object:
   ```js
   function skip() {
     if (!pausedOnFailure) return { error: 'Pipeline is not paused' };
     if (skipResolve) { skipResolve('skip'); skipResolve = null; }
     return { ok: true };
   }
   ```

4. Update `stop()` to also handle paused state — if pausedOnFailure, resolve the skip promise with 'stop':
   ```js
   if (pausedOnFailure && skipResolve) { skipResolve('stop'); skipResolve = null; }
   ```

5. Add `paused()` method returning pausedOnFailure info.

6. Update the returned object to include: `{ start, stop, skip, running, paused, status }`.

In index.js, add POST /api/pipeline/skip-action route (after the existing /api/play/stop route):
```js
if (urlPath === '/api/pipeline/skip-action') {
  const pr = getPlayRunner(cwd);
  const result = pr.skip();
  if (result.error) {
    sendJson(res, 400, { error: result.error });
  } else {
    sendJson(res, 200, { ok: true });
  }
  return;
}
```

Also update GET /api/play/status to include paused state:
```js
sendJson(res, 200, { running: pr.running(), paused: pr.paused(), status: pr.status() });
```
  </action>
  <verify>
Grep for `pausedOnFailure` in play.js to confirm pause logic exists. Grep for `/api/pipeline/skip-action` in index.js to confirm endpoint exists.
  </verify>
  <done>
Play runner pauses on action failure, broadcasts pipeline-paused SSE event, and resumes on skip or stops on stop. POST /api/pipeline/skip-action endpoint wired.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add failure modal UI with View Output, Skip, and Stop buttons</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
In index.html, add CSS for the failure modal:
- `.exec-failure-overlay`: position fixed, inset 0, background rgba(0,0,0,0.6), z-index 1000, display flex, align-items center, justify-content center
- `.exec-failure-modal`: background var(--bg-card, #1e1e1e), border 1px solid var(--border, #333), border-radius 8px, padding 24px, max-width 420px, width 90%, box-shadow 0 8px 32px rgba(0,0,0,0.4)
- `.exec-failure-title`: font-size 16px, font-weight 600, color #ff6b6b, margin-bottom 12px
- `.exec-failure-details`: font-size 13px, color var(--text-dim), margin-bottom 20px, font-family monospace
- `.exec-failure-actions`: display flex, gap 10px, flex-wrap wrap
- `.exec-failure-btn`: padding 8px 16px, border-radius 4px, border none, cursor pointer, font-size 13px, font-weight 500
- `.exec-failure-btn.view-output`: background transparent, color var(--accent, #4a9eff), border 1px solid var(--accent)
- `.exec-failure-btn.skip`: background #e8a838, color #000
- `.exec-failure-btn.stop`: background #ff4444, color #fff

Add the modal DOM (hidden by default, inside #execution-view after exec-content):
```html
<div class="exec-failure-overlay" id="exec-failure-overlay" style="display:none;">
  <div class="exec-failure-modal">
    <div class="exec-failure-title">Action Failed</div>
    <div class="exec-failure-details" id="exec-failure-details"></div>
    <div class="exec-failure-actions">
      <button class="exec-failure-btn view-output" id="exec-failure-view">View Output</button>
      <button class="exec-failure-btn skip" id="exec-failure-skip">Skip &amp; Continue</button>
      <button class="exec-failure-btn stop" id="exec-failure-stop">Stop Pipeline</button>
    </div>
  </div>
</div>
```

In app.js:
1. Cache DOM refs: `$execFailureOverlay`, `$execFailureDetails`, `$execFailureView`, `$execFailureSkip`, `$execFailureStop`.

2. Add `showFailureModal(actionId, exitCode, wave, totalWaves)`:
   - Set details text: `Action ${actionId} exited with code ${exitCode}\nWave ${wave}/${totalWaves}`
   - Show overlay (display = '')

3. Add `hideFailureModal()`: Hide overlay (display = 'none').

4. Wire SSE listener for `pipeline-paused`:
   ```js
   es.addEventListener('pipeline-paused', function(e) {
     try {
       const data = JSON.parse(e.data);
       showFailureModal(data.actionId, data.exitCode, data.wave, data.totalWaves);
     } catch (_) {}
   });
   ```

5. Wire SSE listener for `pipeline-resumed`:
   ```js
   es.addEventListener('pipeline-resumed', function(e) {
     hideFailureModal();
   });
   ```

6. Wire button click handlers:
   - View Output: `selectExecAction(failedActionId, true);` then `hideFailureModal();` — shows the failed action's output in the output panel
   - Skip & Continue: `fetch('/api/pipeline/skip-action', { method: 'POST' });` then `hideFailureModal();`
   - Stop Pipeline: `fetch('/api/play/stop', { method: 'POST' });` then `hideFailureModal();`

7. Store the failed action ID in a variable when showing modal so View Output knows which action to select.

8. Also hide the failure modal in `handlePlayComplete()` as cleanup.

Build dist: Copy src files to dist/public/.
  </action>
  <verify>
Grep for `exec-failure-overlay` in index.html. Grep for `showFailureModal` in app.js. Grep for `pipeline-paused` in app.js. Verify dist files updated.
  </verify>
  <done>
Failure modal appears when pipeline pauses on action failure. View Output shows failed action's log, Skip & Continue resumes pipeline, Stop Pipeline terminates execution. Modal dismissed on any action.
  </done>
</task>

</tasks>

<verification>
1. Play runner pauses when an action exits with non-zero code
2. SSE `pipeline-paused` event fires with action ID and exit code
3. Modal overlay appears with correct failure details
4. View Output button shows the failed action's output in the panel
5. Skip & Continue sends POST /api/pipeline/skip-action and pipeline resumes
6. Stop Pipeline sends POST /api/play/stop and pipeline terminates
7. Modal is hidden after any button press
</verification>

<success_criteria>
- Pipeline pauses on failure (does not auto-continue to next wave)
- Modal appears with three working options
- Skip resumes from next wave, Stop terminates
- View Output scrolls to failed action log
</success_criteria>

<output>
After completion, create `.planning/milestones/M-52-pipeline-progress-and-failure-handling/A-115-SUMMARY.md`
</output>
