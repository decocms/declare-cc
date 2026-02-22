---
milestone: M-52-pipeline-progress-and-failure-handling
action: A-114
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations: ["D-15"]

must_haves:
  truths:
    - "Execution view shows current wave number as 'Wave X/Y' in the topbar"
    - "Progress bar shows percentage of completed actions across all waves"
    - "Per-action status dots transition live as SSE events arrive (queued -> running -> done/failed)"
    - "Progress percentage updates in real time as actions complete"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "Progress bar CSS and DOM elements in exec-topbar"
      contains: "exec-progress-bar"
    - path: "src/server/public/app.js"
      provides: "Progress calculation and live update logic"
      contains: "updateExecProgress"
  key_links:
    - from: "handlePlayStart"
      to: "updateExecProgress"
      via: "stores totalActions count from play-start event data"
      pattern: "totalActions"
    - from: "handleActionComplete"
      to: "updateExecProgress"
      via: "increments completed count and recalculates percentage"
      pattern: "updateExecProgress"
---

<objective>
Build wave-by-wave progress display in the execution view with progress bar, wave indicator, and live status transitions.

Purpose: Users need clear visual feedback on pipeline execution progress — which wave is running, how far along, and what each action's status is — all updating in real time via SSE events.
Output: Enhanced execution view with progress bar header showing Wave X/Y, N% complete, and live-transitioning status indicators.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-103-SUMMARY.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-104-SUMMARY.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-105-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
@src/commands/play.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add progress bar UI and percentage calculation to execution topbar</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
In index.html, add CSS for a progress bar inside `.exec-topbar`:
- `.exec-progress-container`: height 6px, background var(--bg-dim), border-radius 3px, flex: 1, margin 0 16px, min-width 120px
- `.exec-progress-fill`: height 100%, background var(--accent, #4a9eff), border-radius 3px, transition width 0.3s ease
- `.exec-progress-pct`: font-size 13px, color var(--text-dim), min-width 40px, text-align right

Add DOM elements in the exec-topbar div (after exec-wave-status span, before the stop/exit buttons):
```html
<div class="exec-progress-container"><div class="exec-progress-fill" id="exec-progress-fill"></div></div>
<span class="exec-progress-pct" id="exec-progress-pct"></span>
```

In app.js:
1. Add state variables at top near existing exec state:
   - `let execTotalActions = 0;` (total actions across all waves)
   - `let execCompletedActions = 0;` (actions completed so far)
   - `let execFailedActions = 0;` (actions failed so far)

2. Cache DOM refs alongside existing exec refs:
   - `const $execProgressFill = document.getElementById('exec-progress-fill');`
   - `const $execProgressPct = document.getElementById('exec-progress-pct');`

3. Create `updateExecProgress()` function:
   - Calculate pct = totalActions > 0 ? Math.round(((execCompletedActions + execFailedActions) / execTotalActions) * 100) : 0
   - Set $execProgressFill.style.width = pct + '%'
   - Set $execProgressPct.textContent = pct + '%'

4. Update `handlePlayStart()`: Parse totalActions from play-start event data (count all actions across all waves in the event's waves array). Reset execCompletedActions = 0, execFailedActions = 0. Call updateExecProgress().

5. Update `handleActionComplete()`: After updating runningActions, check if exitCode === 0 to increment execCompletedActions else increment execFailedActions. Call updateExecProgress().

6. Update `handlePlayComplete()`: Reset progress to show 100% if not stopped, or keep current if stopped.

7. Update the play-start broadcast in play.js to include `totalActions` count — sum all actions across all waves. The data already has a `waves` array with milestones and their actions, so the client CAN compute this, but adding `totalActions` as a top-level field is cleaner. In play.js `start()` function, after computing waves, count total: `const totalActions = waves.reduce((sum, w) => sum + w.reduce((s, e) => s + e.actions.length, 0), 0);` and include in the broadcast: `broadcast('play-start', { totalWaves: waves.length, totalActions, waves: ... })`.

The existing `updateExecTopbar()` already shows "Wave X/Y" via playStatus.currentWave/totalWaves — keep that as-is but ensure it still works alongside the new progress bar.
  </action>
  <verify>
Run `node dist/declare-tools.cjs serve` and start a pipeline execution. Verify:
- Progress bar appears in the execution topbar between wave status and stop button
- Percentage starts at 0% and increments as actions complete
- Wave X/Y label continues to update correctly
- On pipeline completion, progress shows 100%
  </verify>
  <done>
Execution topbar shows "Wave X/Y" label, a progress bar with fill animation, and percentage text — all updating live via SSE events as actions complete.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add status transition animations for action dots</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
In index.html CSS, enhance status dot transitions:
- Add `transition: background 0.3s ease, box-shadow 0.3s ease;` to `.exec-status-dot` base class
- Add `.exec-status-dot.done` with a brief scale-up animation: `@keyframes dotComplete { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }` and apply `animation: dotComplete 0.3s ease` to done dots
- The existing `.exec-status-dot.running` already has a pulse animation — keep it

In app.js, ensure `renderExecutionView()` produces correct dot classes based on current state:
- The existing logic already checks runningActions Set and COMPLETED statuses — verify it handles the transition correctly when an action goes from running to done/failed
- The key is that `handleActionComplete()` already calls `renderExecutionView()` which re-renders all dots — the CSS transition handles the visual smoothness

No functional changes needed to the dot logic — it already works. The improvement is purely CSS transitions making the state changes visually smooth rather than instant jumps.

Build dist: Copy src/server/public/index.html to dist/public/index.html and src/server/public/app.js to dist/public/app.js.
  </action>
  <verify>
Check that CSS contains transition properties on `.exec-status-dot` and the `@keyframes dotComplete` animation. Verify dist files are updated.
  </verify>
  <done>
Status dots animate smoothly when transitioning between states (queued->running->done/failed) with CSS transitions and a completion scale animation.
  </done>
</task>

</tasks>

<verification>
1. `node dist/declare-tools.cjs serve` starts without errors
2. Start pipeline execution — execution view shows progress bar at 0%
3. As actions complete, progress bar fills and percentage updates
4. Wave X/Y indicator still works in topbar
5. Status dots animate when transitioning between states
6. On pipeline completion, progress reaches 100%
</verification>

<success_criteria>
- Progress bar visible in exec topbar with percentage, updating live
- Wave X/Y display works alongside progress bar
- Status dot transitions are smooth (CSS animated)
- All driven by existing SSE events (no new event types needed)
</success_criteria>

<output>
After completion, create `.planning/milestones/M-52-pipeline-progress-and-failure-handling/A-114-SUMMARY.md`
</output>
