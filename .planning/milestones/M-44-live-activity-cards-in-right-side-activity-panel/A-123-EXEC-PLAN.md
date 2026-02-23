---
milestone: M-44-live-activity-cards-in-right-side-activity-panel
action: A-123
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations:
  - D-16

must_haves:
  truths:
    - "renderAgentCard() produces a DOM-ready HTML string for any agent status (running, done, failed)"
    - "Card displays agent type icon, target node label, elapsed timer, and status badge"
    - "Running cards show a live-updating elapsed timer"
    - "Done/failed cards show final elapsed time and appropriate status color"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "renderAgentCard(agent) function"
      contains: "function renderAgentCard"
    - path: "src/server/public/index.html"
      provides: "CSS styles for .agent-card, .agent-card-icon, .agent-card-timer, .agent-card-badge"
      contains: ".agent-card"
  key_links:
    - from: "renderAgentCard"
      to: "agent record shape"
      via: "accepts { id, type, target, milestoneId, status, startedAt, updatedAt, completedAt, exitCode, error, result }"
      pattern: "agent\\.type|agent\\.target|agent\\.status|agent\\.startedAt"
---

<objective>
Build the renderAgentCard() UI component that renders a single agent as a persistent activity card.

Purpose: This is the visual building block for D-16 (Real-Time Agent Presence). Every agent card needs to show type, target, elapsed time, and status at a glance.
Output: renderAgentCard() function in app.js + CSS styles in index.html
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add agent card CSS styles to index.html</name>
  <files>src/server/public/index.html</files>
  <action>
Add CSS styles in the existing style block (after the `.activity-pinned` styles around line 2276) for agent activity cards. Use the existing design system variables (--surface2, --surface3, --border, --text-dim, --text-bright, --act-color, --broken-color, --mile-color, etc.).

Styles needed:

- `.agent-card` — Card container: background var(--surface2), border 1px solid var(--border), border-radius var(--radius), padding 10px 12px, display flex, flex-direction column, gap 6px, transition background 0.15s. On hover: background var(--surface3).
- `.agent-card.status-running` — Left border accent: border-left 3px solid var(--executing-color).
- `.agent-card.status-done` — Left border accent: border-left 3px solid var(--act-color). Opacity 0.8.
- `.agent-card.status-failed` — Left border accent: border-left 3px solid var(--broken-color). Opacity 0.8.
- `.agent-card-header` — Display flex, align-items center, gap 8px.
- `.agent-card-icon` — Font-size 14px, flex-shrink 0, width 20px, text-align center.
- `.agent-card-target` — Font-size 12px, font-weight 600, color var(--text-bright), overflow hidden, text-overflow ellipsis, white-space nowrap, flex 1.
- `.agent-card-badge` — Font-size 10px, font-weight 700, letter-spacing 0.04em, text-transform uppercase, padding 2px 6px, border-radius 3px, flex-shrink 0.
- `.agent-card-badge.badge-running` — Color var(--executing-color), background var(--executing-bg).
- `.agent-card-badge.badge-done` — Color var(--act-color), background var(--act-bg).
- `.agent-card-badge.badge-failed` — Color var(--broken-color), background var(--broken-bg).
- `.agent-card-meta` — Display flex, align-items center, gap 8px, font-size 11px, color var(--text-dim).
- `.agent-card-type` — Text-transform capitalize.
- `.agent-card-timer` — Font-family 'SF Mono', 'Fira Code', monospace, font-size 11px, color var(--text-dim). When inside .status-running: color var(--executing-color).
- `.agent-card-error` — Font-size 11px, color var(--broken-color), margin-top 2px, overflow hidden, text-overflow ellipsis, white-space nowrap.
  </action>
  <verify>Open index.html, search for `.agent-card` — all styles present and valid CSS.</verify>
  <done>All agent card CSS classes defined in index.html style block using existing design system variables.</done>
</task>

<task type="auto">
  <name>Task 2: Create renderAgentCard() function in app.js</name>
  <files>src/server/public/app.js</files>
  <action>
Add a new section in app.js BEFORE the "Activity topbar" section (before line ~6418). Add a section comment: `// --- Agent activity cards ---`

Create these functions:

1. **Agent type icon map** — `const AGENT_TYPE_ICONS = { executor: '\uD83E\uDD16', planner: '\uD83D\uDCCB', deriver: '\u26A1', researcher: '\uD83D\uDD0D', revision: '\uD83D\uDD04', default: '\u2699\uFE0F' };`

2. **`formatElapsed(startedAt, completedAt)`** — Returns human-readable elapsed time string. Takes startedAt (ISO string or ms timestamp) and optional completedAt. If completedAt is null/undefined, compute against Date.now() (for running agents). Format: "0:05" for under a minute, "1:23" for minutes:seconds, "1h 05m" for over an hour. Use this pattern:
   ```
   const start = typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt;
   const end = completedAt ? (typeof completedAt === 'string' ? new Date(completedAt).getTime() : completedAt) : Date.now();
   const diffSec = Math.max(0, Math.floor((end - start) / 1000));
   ```

3. **`renderAgentCard(agent)`** — Takes an agent record object `{ id, type, target, milestoneId, status, startedAt, updatedAt, completedAt, exitCode, error, result }`. Returns an HTML string.

   Structure:
   ```html
   <div class="agent-card status-{status}" data-agent-id="{id}">
     <div class="agent-card-header">
       <span class="agent-card-icon">{icon from AGENT_TYPE_ICONS[type] || AGENT_TYPE_ICONS.default}</span>
       <span class="agent-card-target">{target}</span>
       <span class="agent-card-badge badge-{status}">{STATUS_LABEL}</span>
     </div>
     <div class="agent-card-meta">
       <span class="agent-card-type">{type}</span>
       <span class="agent-card-timer" data-started="{startedAt}" data-completed="{completedAt || ''}">{formatted elapsed}</span>
     </div>
     {if error: <div class="agent-card-error" title="{full error}">{truncated error}</div>}
   </div>
   ```

   Status label map: running -> "Running", done -> "Done", failed -> "Failed", interrupted -> "Stopped".

   Use escHtml() (already exists in app.js) for all user-facing text.

4. **`startCardTimers()` / `stopCardTimers()`** — A setInterval (1 second) that finds all `.agent-card.status-running .agent-card-timer` elements and updates their text content with the current elapsed time using formatElapsed(). Store the interval ID in a module-level variable `let cardTimerInterval = null;`. startCardTimers checks if already running before creating a new interval. stopCardTimers clears it.

These are pure rendering functions with no side effects. They do NOT touch the DOM directly (except the timer updater). They will be consumed by A-124 (panel restructure) and A-125 (SSE wiring).
  </action>
  <verify>Search app.js for "function renderAgentCard" — function exists. Search for "AGENT_TYPE_ICONS" — icon map exists. Search for "formatElapsed" — timer function exists. Search for "startCardTimers" — timer interval management exists.</verify>
  <done>renderAgentCard(agent) returns correct HTML for running, done, and failed agent records. formatElapsed() computes human-readable durations. Card timer interval updates running card timers every second.</done>
</task>

</tasks>

<verification>
1. Search app.js for `renderAgentCard` — function defined
2. Search app.js for `formatElapsed` — function defined
3. Search app.js for `AGENT_TYPE_ICONS` — map defined
4. Search index.html for `.agent-card` — styles defined
5. Manually verify: calling `renderAgentCard({ id: 'test-1', type: 'executor', target: 'M-44 A-123', status: 'running', startedAt: new Date().toISOString() })` would produce valid HTML with correct classes
</verification>

<success_criteria>
- renderAgentCard() exists and produces valid HTML for all three statuses (running/done/failed)
- CSS styles for .agent-card and all sub-elements are in index.html
- formatElapsed() handles running (no completedAt) and completed agents
- Card timer interval updates running cards every second
- All functions use existing escHtml() for XSS safety
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-123-SUMMARY.md`
</output>
