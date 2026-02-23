---
milestone: M-44-live-activity-cards-in-right-side-activity-panel
action: A-125
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
    - "When an agent spawns, a new running card appears instantly in the activity panel"
    - "When an agent updates status, the card reflects the change without page reload"
    - "When an agent completes, its card transitions from running to done/failed state"
    - "Multiple concurrent agents each have their own card"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "SSE event handlers for agent-start, agent-update, agent-complete"
      contains: "agent-start"
  key_links:
    - from: "connectSSE"
      to: "agent-start handler"
      via: "es.addEventListener('agent-start', ...)"
      pattern: "addEventListener.*agent-start"
    - from: "agent-start handler"
      to: "agentCardState"
      via: "agentCardState.set(agent.id, agent)"
      pattern: "agentCardState\\.set"
    - from: "agent handlers"
      to: "renderAgentPanel"
      via: "called after every state change"
      pattern: "renderAgentPanel\\(\\)"
---

<objective>
Wire SSE agent lifecycle events (agent-start, agent-update, agent-complete) to create, update, and transition agent cards in real-time.

Purpose: D-16 requires agents to appear "instantly" as activity cards. SSE events from M-43's agent registry drive the card lifecycle.
Output: Three SSE event handlers in connectSSE() that manage agentCardState and trigger renderAgentPanel().
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-123-SUMMARY.md
@.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-124-SUMMARY.md
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add SSE agent event handlers in connectSSE()</name>
  <files>src/server/public/app.js</files>
  <action>
Inside the `connectSSE()` function, add three new SSE event listeners after the existing pipeline event listeners (before the error handler). The M-43 server will emit these events with JSON data matching the agent record shape: `{ id, type, target, milestoneId, status, startedAt, updatedAt, completedAt, exitCode, error, result }`.

1. **`agent-start`** handler:
   ```js
   es.addEventListener('agent-start', function(e) {
     try {
       const agent = JSON.parse(e.data);
       agentCardState.set(agent.id, agent);
       renderAgentPanel();
       // Flash pulse indicator
       if ($activityPulse) {
         $activityPulse.classList.add('live');
         clearTimeout($activityPulse._timer);
         $activityPulse._timer = setTimeout(() => $activityPulse.classList.remove('live'), 3000);
       }
     } catch (_) {}
   });
   ```

2. **`agent-update`** handler:
   ```js
   es.addEventListener('agent-update', function(e) {
     try {
       const agent = JSON.parse(e.data);
       // Merge with existing state to preserve any client-side additions
       const existing = agentCardState.get(agent.id);
       agentCardState.set(agent.id, Object.assign({}, existing || {}, agent));
       renderAgentPanel();
     } catch (_) {}
   });
   ```

3. **`agent-complete`** handler:
   ```js
   es.addEventListener('agent-complete', function(e) {
     try {
       const agent = JSON.parse(e.data);
       const existing = agentCardState.get(agent.id);
       agentCardState.set(agent.id, Object.assign({}, existing || {}, agent));
       renderAgentPanel();
       // Flash pulse
       if ($activityPulse) {
         $activityPulse.classList.add('live');
         clearTimeout($activityPulse._timer);
         $activityPulse._timer = setTimeout(() => $activityPulse.classList.remove('live'), 3000);
       }
     } catch (_) {}
   });
   ```

Also add a cleanup function for stale agents. After the agent event handlers, add logic to periodically prune completed agents older than 30 minutes from agentCardState to prevent unbounded growth:

```js
setInterval(function() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, agent] of agentCardState) {
    if (agent.status !== 'running' && agent.completedAt) {
      const completedTs = new Date(agent.completedAt).getTime();
      if (completedTs < cutoff) agentCardState.delete(id);
    }
  }
}, 60000); // Check every minute
```

Place this interval setup outside connectSSE(), right after the `connectSSE();` call, since it should only run once.
  </action>
  <verify>Search app.js for "agent-start" inside connectSSE — handler exists. Search for "agent-update" — handler exists. Search for "agent-complete" — handler exists. Verify each handler calls renderAgentPanel(). Verify stale agent cleanup interval exists.</verify>
  <done>SSE events agent-start, agent-update, agent-complete are handled in connectSSE(). Each event updates agentCardState and triggers renderAgentPanel(). Stale completed agents pruned after 30 minutes.</done>
</task>

</tasks>

<verification>
1. Search app.js for `agent-start` in addEventListener — handler wired
2. Search app.js for `agent-update` in addEventListener — handler wired
3. Search app.js for `agent-complete` in addEventListener — handler wired
4. Each handler: parses JSON, updates agentCardState, calls renderAgentPanel()
5. Stale agent cleanup interval running every 60s with 30-minute cutoff
6. No runtime errors from handler — all references to agentCardState and renderAgentPanel exist
</verification>

<success_criteria>
- agent-start SSE event creates a new running card in the panel
- agent-update SSE event updates the card's status/metadata
- agent-complete SSE event transitions card to done/failed
- Activity pulse flashes on start and complete events
- Completed agents older than 30 minutes are pruned from state
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-live-activity-cards-in-right-side-activity-panel/A-125-SUMMARY.md`
</output>
