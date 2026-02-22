---
milestone: M-48-execution-mode-as-dedicated-full-screen-view
action: A-105
type: execute
wave: 2
depends_on: ["A-103"]
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations: ["D-14"]
must_haves:
  truths:
    - "No edit controls visible in execution view (no + Declaration button, no edit forms, no annotation UI, no derivation triggers)"
    - "No review/approve buttons visible in execution view"
    - "Only execution controls visible: a Stop button (when playing) and output viewing"
    - "Side panel is hidden or shows only read-only action details in execution mode"
    - "Switching back to columns mode restores all edit controls"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "CSS rules hiding edit controls in execution mode"
      contains: "exec-mode-hide"
    - path: "src/server/public/app.js"
      provides: "Logic to toggle read-only state based on viewMode"
      contains: "exec-mode-hide"
  key_links:
    - from: "src/server/public/app.js"
      to: "switchView function"
      via: "Adding/removing exec-mode-hide class on body or main container"
      pattern: "exec-mode-hide"
---

<objective>
Enforce read-only mode when the execution view is active by hiding all edit controls, annotation UI, and derivation triggers.

Purpose: D-14 requires planning and execution to be distinct UX modes. In execution mode, the user should only see progress, status, and output — no editing affordances that could cause confusion or accidental modification during a running pipeline.

Output: All edit/annotation/derivation controls hidden when viewMode === 'execution'. Only Stop button and output viewing remain. Exiting execution mode restores full editing UI.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/PLAN.md
@.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-103-SUMMARY.md
@src/server/public/index.html
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hide edit controls and show only execution affordances</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**Strategy:** Use a CSS class `.exec-mode` on `<body>` to hide edit controls globally. This is cleaner than conditional JS checks in every render function.

**In index.html — add CSS rules (inside existing `<style>` block):**

```css
/* ── Execution mode: hide all edit controls ── */
body.exec-mode #new-decl-btn { display: none; }
body.exec-mode #play-btn { display: none; }
body.exec-mode #workflow-banner { display: none; }
body.exec-mode #readiness-banner { display: none; }
body.exec-mode #side-panel { display: none; }
body.exec-mode #activity-feed { display: none; }
body.exec-mode #view-toggle { display: none; }
```

Add CSS for the execution-mode header bar (a minimal bar replacing the status bar controls):

```css
.exec-topbar {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 36px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
body.exec-mode .exec-topbar { display: flex; }
.exec-topbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-bright);
  flex: 1;
}
.exec-exit-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
}
.exec-exit-btn:hover { background: var(--border); }
.exec-stop-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--broken-border);
  background: var(--broken-bg);
  color: var(--broken-color);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.exec-stop-btn:hover { opacity: 0.85; }
body:not(.exec-mode) .exec-topbar { display: none; }
```

**In index.html — add DOM for execution topbar** (inside `#execution-view`, before the `.exec-left-panel`):

```html
<div class="exec-topbar">
  <span class="exec-topbar-title">Execution Mode</span>
  <span id="exec-wave-status" style="font-size:12px;color:var(--text-dim)"></span>
  <button class="exec-stop-btn" id="exec-stop-btn">Stop</button>
  <button class="exec-exit-btn" id="exec-exit-btn">Exit</button>
</div>
```

**In app.js:**

1. In `switchView()`, when entering execution mode:
   ```js
   document.body.classList.add('exec-mode');
   ```
   When leaving execution mode (entering dag or columns):
   ```js
   document.body.classList.remove('exec-mode');
   ```

2. Wire the Exit button (`#exec-exit-btn`) to switch back to columns:
   ```js
   const $execExitBtn = document.getElementById('exec-exit-btn');
   if ($execExitBtn) {
     $execExitBtn.addEventListener('click', () => switchView('columns'));
   }
   ```

3. Wire the Stop button (`#exec-stop-btn`) to call `stopPlay()`:
   ```js
   const $execStopBtn = document.getElementById('exec-stop-btn');
   if ($execStopBtn) {
     $execStopBtn.addEventListener('click', () => stopPlay());
   }
   ```

4. Update `handlePlayWaveStart` and `handlePlayWaveComplete` to update `#exec-wave-status` with current wave progress (e.g., "Wave 2/3") when in execution mode.

5. When play completes (all waves done — detected when `play-wave-complete` fires for the last wave and no more active actions), update the exec-topbar-title to "Execution Complete" and hide the Stop button. The user can then click Exit to return to columns view.

6. On the view toggle cycling (line ~4447): remove 'execution' from the toggle cycle. Execution mode should only be entered via play start (auto-switch in handlePlayStart) or a deliberate "Execute" entry point. The toggle should only cycle between dag and columns. This keeps execution mode as a distinct, intentional state.
  </action>
  <verify>
1. Start play — verify automatic switch to execution mode with edit controls hidden.
2. Confirm these are NOT visible: "+ Declaration" button, "Play All" button, workflow banner, readiness banner, side panel, activity feed, view toggle.
3. Confirm execution topbar shows "Execution Mode", wave status, Stop button, and Exit button.
4. Click Stop — verify play stops (stopPlay called).
5. Click Exit — verify switch back to columns view with all edit controls restored.
6. Verify view toggle only cycles between dag and columns (no execution in cycle).
  </verify>
  <done>
Execution mode hides all edit/annotation/derivation controls via `body.exec-mode` CSS class. Only the execution topbar with Stop and Exit buttons is visible alongside the pipeline and output panels. Exiting restores full planning UI. Execution mode is entered only via play start, not the view toggle.
  </done>
</task>

</tasks>

<verification>
- `body.exec-mode` class applied when viewMode === 'execution'
- All edit controls (new-decl-btn, play-btn, workflow-banner, readiness-banner, side-panel, activity-feed, view-toggle) hidden via CSS
- Execution topbar visible with Stop and Exit buttons
- Stop button calls stopPlay()
- Exit button switches to columns and removes exec-mode class
- View toggle does NOT include execution in its cycle
- All controls restored when leaving execution mode
</verification>

<success_criteria>
Execution mode is a clean, read-only monitoring experience. No edit affordances are visible. The only interactive controls are Stop (halts execution), Exit (returns to planning mode), and clicking pipeline actions to view output.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-48-execution-mode-as-dedicated-full-screen-view/A-105-SUMMARY.md`
</output>
