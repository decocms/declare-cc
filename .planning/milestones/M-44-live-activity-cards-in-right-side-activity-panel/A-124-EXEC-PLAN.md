---
milestone: M-44-live-activity-cards-in-right-side-activity-panel
action: A-124
type: execute
wave: 1
depends_on:
  - A-123
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations:
  - D-16

must_haves:
  truths:
    - "Right-side activity panel shows two sections: active agent cards at top, completed cards below"
    - "Existing event feed log is preserved in a collapsible secondary tab"
    - "User can toggle between Cards view and Log view in the activity panel"
    - "Panel layout works in drill-down mode (where activity-feed is visible)"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "Restructured #activity-feed HTML with tabs and card containers"
      contains: "activity-cards-active"
    - path: "src/server/public/app.js"
      provides: "Tab switching logic and renderAgentPanel() function"
      contains: "function renderAgentPanel"
  key_links:
    - from: "renderAgentPanel"
      to: "renderAgentCard"
      via: "maps over agent array and calls renderAgentCard for each"
      pattern: "renderAgentCard\\("
    - from: "#activity-feed tabs"
      to: "card vs log view"
      via: "tab click toggles visibility of #activity-cards vs #activity-list"
      pattern: "activity-tab.*click|activity-cards|activity-list"
---

<objective>
Restructure the right-side activity panel from a flat event log to a card-based layout with active agents at top, recent completions below, and the old log as a secondary tab.

Purpose: D-16 requires persistent activity cards as the primary view. The old event feed becomes secondary context, not the main display.
Output: Restructured #activity-feed panel with tabs (Cards / Log), card container sections, and renderAgentPanel() orchestration function.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-123-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure #activity-feed HTML and add tab/card container CSS</name>
  <files>src/server/public/index.html</files>
  <action>
Replace the existing `#activity-feed` div (around line 3297-3306) with a restructured version:

```html
<div id="activity-feed">
  <div id="activity-toggle">
    <div id="activity-pulse"></div>
    <div id="activity-tabs">
      <span class="activity-tab active" data-tab="cards">Agents</span>
      <span class="activity-tab" data-tab="log">Log</span>
    </div>
  </div>
  <div id="activity-cards" class="activity-tab-content active">
    <div id="activity-cards-active"></div>
    <div id="activity-cards-recent"></div>
  </div>
  <div id="activity-list" class="activity-tab-content">
    <div style="padding:16px;color:var(--text-muted);font-size:11px;text-align:center;">No activity yet</div>
  </div>
</div>
```

Remove the old `<span id="activity-label">ACTIVITY</span>` and `<div id="activity-pinned"></div>` -- the pinned operation display is replaced by agent cards.

Add CSS styles (near the existing activity feed styles):

- `.activity-tab` — Font-size 10px, font-weight 700, letter-spacing 0.06em, text-transform uppercase, color var(--text-muted), cursor pointer, padding 2px 6px, border-radius 3px, transition color 0.15s and background 0.15s. On hover: color var(--text-dim).
- `.activity-tab.active` — Color var(--text-bright), background var(--surface3).
- `#activity-tabs` — Display flex, gap 4px, align-items center, flex 1.
- `.activity-tab-content` — Display none. When `.active`: display flex, flex-direction column, flex 1, overflow hidden.
- `#activity-cards` — When active: overflow-y auto, padding 8px, gap 8px.
- `#activity-cards-active` — Display flex, flex-direction column, gap 6px.
- `#activity-cards-recent` — Display flex, flex-direction column, gap 6px, margin-top 8px, padding-top 8px, border-top 1px solid var(--border). Hide when empty via `:empty { display: none; }`.
- `#activity-cards::-webkit-scrollbar` — Same scrollbar style as #activity-list (width 4px, transparent track, var(--border-strong) thumb).

Update the `#activity-toggle` style to remove `border-bottom` since tabs now serve as the visual separator. Keep padding and layout.
  </action>
  <verify>Search index.html for "activity-cards-active" — container exists. Search for "activity-tab" — tab elements and styles exist. Verify no duplicate `activity-pinned` reference remains in the HTML structure.</verify>
  <done>Activity feed HTML restructured with Agents/Log tabs and card container divs. Old activity-pinned and activity-label removed from HTML.</done>
</task>

<task type="auto">
  <name>Task 2: Add tab switching logic and renderAgentPanel() to app.js</name>
  <files>src/server/public/app.js</files>
  <action>
In the "Agent activity cards" section of app.js (added by A-123), add the following after the renderAgentCard function:

1. **DOM references** for new elements:
   ```js
   const $activityCards = document.getElementById('activity-cards');
   const $activityCardsActive = document.getElementById('activity-cards-active');
   const $activityCardsRecent = document.getElementById('activity-cards-recent');
   ```

2. **Agent state store** — A module-level Map to hold current agent state:
   ```js
   const agentCardState = new Map(); // id -> agent record
   ```

3. **`renderAgentPanel()`** — Reads from agentCardState, splits agents into active (status === 'running') and recent (status === 'done' or 'failed'), sorts active by startedAt descending (newest first), sorts recent by completedAt descending (newest first), limits recent to 10. Renders HTML into $activityCardsActive and $activityCardsRecent using renderAgentCard(). If no agents at all, shows "No active agents" placeholder in $activityCardsActive. Calls startCardTimers() if any running agents exist, stopCardTimers() if none.

4. **Tab switching** — Wire click handlers on `.activity-tab` elements:
   ```js
   document.querySelectorAll('.activity-tab').forEach(tab => {
     tab.addEventListener('click', () => {
       document.querySelectorAll('.activity-tab').forEach(t => t.classList.remove('active'));
       document.querySelectorAll('.activity-tab-content').forEach(c => c.classList.remove('active'));
       tab.classList.add('active');
       const target = tab.dataset.tab === 'cards' ? $activityCards : $activityList;
       if (target) target.classList.add('active');
     });
   });
   ```

5. **Update $activityPinned references** — The old `$activityPinned` element no longer exists. Find and remove/comment out the `const $activityPinned = document.getElementById('activity-pinned');` reference. Update `updateTopbar()` function: instead of writing to $activityPinned, this is now handled by agent cards. Set `updateTopbar` to be a no-op or remove its body — the topbar active operation display is replaced by agent cards in the panel. Keep the topbarActiveOp/topbarLastOp variables for now as they may be referenced elsewhere; just make updateTopbar() do nothing (`function updateTopbar() {}`).

6. **Update topbarOnActivity()** — Since the old pinned display is gone, simplify topbarOnActivity to just pulse the activity indicator: flash the $activityPulse.live class for 3 seconds. Remove the /api/activity fetch from it (loadActivity already does that).
  </action>
  <verify>Search app.js for "renderAgentPanel" — function exists. Search for "agentCardState" — Map exists. Search for "activity-tab.*click" — tab wiring exists. Verify no runtime errors by checking that removed $activityPinned is not referenced in updateTopbar.</verify>
  <done>Tab switching between Cards and Log works. renderAgentPanel() renders agents from agentCardState into the panel. Old $activityPinned display replaced by card-based panel. agentCardState Map ready for SSE population in A-125.</done>
</task>

</tasks>

<verification>
1. Search app.js for `renderAgentPanel` — function defined
2. Search app.js for `agentCardState` — state Map defined
3. Search index.html for `activity-cards-active` — container exists
4. Search index.html for `activity-tab` — tab elements exist
5. No references to removed `activity-pinned` element in app.js
6. Tab click toggles between cards view and log view
7. renderAgentPanel correctly splits running vs completed agents
</verification>

<success_criteria>
- Activity panel has two tabs: Agents (default) and Log
- Agents tab shows active cards section and recent cards section
- Log tab shows existing event feed (unchanged loadActivity behavior)
- renderAgentPanel() reads from agentCardState Map and renders cards
- Old activity-pinned mechanism fully replaced
- No console errors from removed DOM elements
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-124-SUMMARY.md`
</output>
