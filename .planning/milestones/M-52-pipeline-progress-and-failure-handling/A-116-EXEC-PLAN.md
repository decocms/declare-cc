---
milestone: M-52-pipeline-progress-and-failure-handling
action: A-116
type: execute
wave: 2
depends_on: ["A-114"]
files_modified:
  - src/commands/play.js
  - src/server/index.js
  - src/server/public/app.js
autonomous: true
declarations: ["D-15"]

must_haves:
  truths:
    - "Pipeline state persists server-side on every state change"
    - "Refreshing the browser during execution restores the execution view with correct wave/action statuses"
    - "Output buffers are restored from server on page reload"
    - "SSE reconnect picks up from current state without missing events"
  artifacts:
    - path: "src/commands/play.js"
      provides: "Server-side state persistence to pipeline-state.json"
      contains: "pipeline-state.json"
    - path: "src/server/index.js"
      provides: "GET /api/pipeline/state endpoint"
      contains: "/api/pipeline/state"
    - path: "src/server/public/app.js"
      provides: "State restoration on page load"
      contains: "restoreExecState"
  key_links:
    - from: "play.js broadcast calls"
      to: "persistState()"
      via: "called after every state mutation"
      pattern: "persistState"
    - from: "app.js page load"
      to: "GET /api/pipeline/state"
      via: "fetch on init"
      pattern: "api/pipeline/state"
    - from: "GET /api/pipeline/state response"
      to: "restoreExecState"
      via: "restores playRunning, playStatus, execOutputBuffers, switches to execution view"
      pattern: "restoreExecState"
---

<objective>
Persist execution state across browser refresh so users can reload the page during pipeline execution without losing progress visibility.

Purpose: If the browser tab is refreshed or reopened during a pipeline run, the execution view should restore to its current state — showing the correct wave, action statuses, and output buffers — rather than showing a blank state.
Output: Server-side state persistence and client-side state restoration with SSE reconnect.
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
  <name>Task 1: Persist pipeline state server-side and add restore endpoint</name>
  <files>src/commands/play.js, src/server/index.js</files>
  <action>
In play.js, add state persistence:

1. Add `const STATE_FILE = '.planning/pipeline-state.json';` at top.

2. Add `persistState()` function inside createPlayRunner:
   ```js
   function persistState() {
     if (!playState) {
       // Pipeline not running — delete state file
       try { fs.unlinkSync(path.join(cwd, STATE_FILE)); } catch (_) {}
       return;
     }
     const state = {
       running: isRunning,
       currentWave: playState.currentWave,
       totalWaves: playState.totalWaves,
       waveItems: playState.waveItems,
       completedActions: playState.completedActions,
       failedActions: playState.failedActions,
       activeActions: [...activeProcesses.keys()],
       outputBuffers: outputBuffers, // see below
       pausedOnFailure: pausedOnFailure,
       timestamp: Date.now(),
     };
     try { fs.writeFileSync(path.join(cwd, STATE_FILE), JSON.stringify(state, null, 2)); } catch (_) {}
   }
   ```

3. Add output buffering server-side: `const outputBuffers = {};` alongside other state. In `executeAction()`, when broadcasting action-output, also append to `outputBuffers[actionId]`:
   ```js
   if (!outputBuffers[actionId]) outputBuffers[actionId] = '';
   outputBuffers[actionId] += line + '\n';
   ```
   Cap each buffer at 50000 chars to prevent unbounded growth (truncate from front if exceeded).

4. Call `persistState()` after every state mutation:
   - After setting playState in `start()`
   - After updating playState.currentWave in wave loop
   - After updating completedActions/failedActions in wave results
   - After setting pausedOnFailure
   - After clearing state in play-complete
   - After stop

5. Add `getFullState()` method to the returned object:
   ```js
   function getFullState() {
     if (!isRunning && !pausedOnFailure) return null;
     return {
       running: isRunning,
       currentWave: playState ? playState.currentWave : 0,
       totalWaves: playState ? playState.totalWaves : 0,
       completedActions: playState ? playState.completedActions : [],
       failedActions: playState ? playState.failedActions : [],
       activeActions: [...activeProcesses.keys()],
       outputBuffers: outputBuffers,
       pausedOnFailure: pausedOnFailure,
     };
   }
   ```

6. Return `{ start, stop, skip, running, paused, status, getFullState }`.

In index.js, add GET /api/pipeline/state route (in the GET section, near /api/play/status):
```js
if (urlPath === '/api/pipeline/state') {
  const pr = getPlayRunner(cwd);
  const state = pr.getFullState();
  if (state) {
    sendJson(res, 200, { active: true, ...state });
  } else {
    sendJson(res, 200, { active: false });
  }
  return;
}
```
  </action>
  <verify>
Grep for `pipeline-state.json` in play.js. Grep for `/api/pipeline/state` in index.js. Grep for `persistState` in play.js. Grep for `getFullState` in play.js.
  </verify>
  <done>
Pipeline state persisted to .planning/pipeline-state.json on every state change. GET /api/pipeline/state returns current execution state including output buffers.
  </done>
</task>

<task type="auto">
  <name>Task 2: Restore execution state on page load and SSE reconnect</name>
  <files>src/server/public/app.js</files>
  <action>
In app.js, add state restoration:

1. Create `async function restoreExecState()`:
   ```js
   async function restoreExecState() {
     try {
       const res = await fetch('/api/pipeline/state');
       const data = await res.json();
       if (!data.active) return;

       // Restore play state
       playRunning = data.running;
       playStatus = {
         currentWave: data.currentWave,
         totalWaves: data.totalWaves,
         activeActions: data.activeActions || [],
         completedActions: data.completedActions || [],
         failedActions: data.failedActions || [],
       };

       // Restore output buffers
       if (data.outputBuffers) {
         execOutputBuffers = data.outputBuffers;
       }

       // Restore progress tracking
       execTotalActions = (data.completedActions || []).length + (data.failedActions || []).length + (data.activeActions || []).length;
       // Note: totalActions may be larger — add any remaining queued. Use a rough estimate from totalWaves
       // Better: store totalActions in server state too
       execCompletedActions = (data.completedActions || []).length;
       execFailedActions = (data.failedActions || []).length;

       // Mark running actions
       runningActions = new Set(data.activeActions || []);

       // Switch to execution view
       switchView('execution');
       updatePlayUI();
       updateExecProgress();

       // If paused on failure, show modal
       if (data.pausedOnFailure) {
         showFailureModal(
           data.pausedOnFailure.actionId,
           data.pausedOnFailure.exitCode,
           data.currentWave,
           data.totalWaves
         );
       }

       // Auto-select first running action
       if (data.activeActions && data.activeActions.length > 0) {
         selectExecAction(data.activeActions[0], false);
       }
     } catch (_) {}
   }
   ```

2. Call `restoreExecState()` during app initialization — after loadData() completes, call restoreExecState(). Find the existing init flow (likely at bottom of app.js or in a DOMContentLoaded handler) and add the call there. It should run AFTER the graph data is loaded so renderExecutionView() has data to work with.

3. Also update the `totalActions` tracking: In play.js `persistState()`, include the totalActions count. In `start()`, compute and store it: `playState.totalActions = totalActions;`. In `getFullState()`, return it. In `restoreExecState()`, use it: `execTotalActions = data.totalActions || ...`.

4. The existing SSE reconnect is handled by the `retry: 3000` directive in the SSE response headers (index.js line 1629). When the EventSource reconnects, it will receive new events going forward. The state restoration from GET /api/pipeline/state fills the gap for any events missed during disconnect.

5. Update the localStorage guard in switchView — currently it falls back from 'execution' to 'columns' on reload. Modify: if persisted viewMode is 'execution', still default to 'columns' BUT let restoreExecState() switch to execution if pipeline is actually running. This keeps the guard safe (no exec mode without running pipeline) while allowing restoration.

Build dist: Copy src/server/public/app.js to dist/public/app.js.
  </action>
  <verify>
Grep for `restoreExecState` in app.js. Grep for `api/pipeline/state` in app.js. Verify dist files updated.
  </verify>
  <done>
Browser refresh during pipeline execution restores execution view with correct wave, action statuses, output buffers, and failure modal if paused. SSE reconnect picks up live events from current state.
  </done>
</task>

</tasks>

<verification>
1. Start pipeline execution, refresh browser — execution view restores with correct state
2. Output panel shows buffered output for completed actions after refresh
3. Progress bar shows correct percentage after refresh
4. If pipeline is paused on failure, refresh shows the failure modal
5. SSE events continue streaming after reconnect
6. pipeline-state.json is cleaned up after pipeline completes
</verification>

<success_criteria>
- Page reload during execution restores full execution view state
- Output buffers available for all completed actions after refresh
- Progress bar, wave indicator, and action statuses all correct after restore
- Failure modal restores if pipeline was paused
- No orphaned state file after pipeline completion
</success_criteria>

<output>
After completion, create `.planning/milestones/M-52-pipeline-progress-and-failure-handling/A-116-SUMMARY.md`
</output>
