---
milestone: M-44-live-activity-cards-in-right-side-activity-panel
action: A-126
type: execute
wave: 2
depends_on:
  - A-123
  - A-124
files_modified:
  - src/server/public/app.js
autonomous: true
declarations:
  - D-16

must_haves:
  truths:
    - "Agent cards survive full page refresh — running agents still show as running after F5"
    - "Agent cards survive client-side navigation between views — switching from drill to DAG mode and back preserves cards"
    - "On initial load, cards appear immediately from /api/agents before any SSE events arrive"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "loadAgentCards() function that fetches /api/agents and populates agentCardState"
      contains: "function loadAgentCards"
  key_links:
    - from: "loadAgentCards"
      to: "/api/agents"
      via: "fetch('/api/agents')"
      pattern: "fetch.*api/agents"
    - from: "loadAgentCards"
      to: "agentCardState"
      via: "populates Map from API response"
      pattern: "agentCardState\\.set"
    - from: "bootstrap"
      to: "loadAgentCards"
      via: "called on page load alongside loadData and loadActivity"
      pattern: "loadAgentCards\\(\\)"
---

<objective>
Persist agent card state across page refreshes and navigation by hydrating from the /api/agents endpoint on load.

Purpose: D-16 explicitly requires cards to "survive page refresh and navigation." This action ensures the client-side agentCardState is populated from the server on every page load, not just from SSE events.
Output: loadAgentCards() function called at bootstrap and on navigation events.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-124-SUMMARY.md
@.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-125-SUMMARY.md
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create loadAgentCards() and wire into bootstrap</name>
  <files>src/server/public/app.js</files>
  <action>
In the "Agent activity cards" section of app.js, add `loadAgentCards()` function:

```js
/**
 * Fetch current agent state from server and populate card state.
 * Called on page load and SSE reconnect to ensure cards survive refresh.
 */
async function loadAgentCards() {
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) return; // API not available yet (M-43 not deployed) — fail silently
    const data = await res.json();
    const agents = data.agents || [];

    // Replace entire state with server truth
    agentCardState.clear();
    for (const agent of agents) {
      agentCardState.set(agent.id, agent);
    }
    renderAgentPanel();
  } catch (_) {
    // /api/agents not available — M-43 not yet deployed, silently skip
  }
}
```

Key design decisions:
- **Fail silently** if /api/agents returns 404 or network error. M-43 may not be deployed yet, and the dashboard should still work.
- **Replace entire state** on load (agentCardState.clear() then repopulate). Server is the single source of truth.
- The /api/agents endpoint (from M-43) returns both active and recently completed agents.

Wire into bootstrap — at the bottom of app.js, in the Bootstrap section (around line 6828-6832), add `loadAgentCards()` alongside the existing `loadData()` and `loadActivity()` calls:

```js
// existing:
showLoading();
loadData().then(() => restoreExecState());
loadActivity();
// add:
loadAgentCards();
```

Wire into SSE reconnect — inside `connectSSE()`, in the error handler where it reconnects (`setTimeout(connectSSE, 3000)`), the loadAgentCards call will naturally happen on the next page load. But also call loadAgentCards() at the START of connectSSE after creating the EventSource and its 'open' event:

```js
es.addEventListener('open', function() {
  // Re-sync agent state on reconnect
  loadAgentCards();
});
```

This ensures that after an SSE connection drop and reconnect, any events missed during the gap are recovered from the server.

Wire into the SSE 'change' event handler — when graph data changes (file system watch), also refresh agent cards since agent state may have changed:

```js
// Update the existing 'change' handler:
es.addEventListener('change', () => {
  if (focusNodeId || focusCleanupTimer) return;
  loadData();
  loadAgentCards(); // refresh agent cards on any .planning/ change
});
```
  </action>
  <verify>Search app.js for "function loadAgentCards" — exists. Search for "loadAgentCards()" — called in bootstrap section, in SSE open handler, and in change handler. Verify /api/agents fetch has try/catch with silent failure. Verify agentCardState.clear() is called before repopulation.</verify>
  <done>loadAgentCards() fetches /api/agents on page load, SSE reconnect, and file change events. agentCardState is hydrated from server on every load. Cards survive page refresh. Graceful fallback when M-43 API not yet available.</done>
</task>

</tasks>

<verification>
1. Search app.js for `loadAgentCards` — function defined and called in 3 places (bootstrap, SSE open, change handler)
2. Function fetches `/api/agents` and populates agentCardState Map
3. Function fails silently if /api/agents is not available
4. agentCardState.clear() called before repopulation (server is truth)
5. renderAgentPanel() called after hydration
6. On page refresh: loadAgentCards runs, fetches current agents, renders cards immediately
</verification>

<success_criteria>
- Page refresh with running agents: cards reappear immediately from /api/agents
- SSE reconnect after connection drop: agent state is re-synced
- Dashboard works normally when M-43 is not yet deployed (silent 404 handling)
- Server is single source of truth — client state replaced on each load
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-126-SUMMARY.md`
</output>
