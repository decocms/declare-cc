---
milestone: M-45-agent-completion-with-result-navigation
action: A-128
type: execute
wave: 2
depends_on: ["A-129"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "Completed agent cards show a 'View Result' button"
    - "Clicking 'View Result' navigates to the agent's result view via navigateToResult()"
    - "Completed cards show elapsed time (startedAt to completedAt)"
    - "Completed cards show a completion summary appropriate to agent type"
    - "Failed agent cards show error state with red styling, no 'View Result' button"
    - "Done-state cards are visually distinct from running cards (green check vs spinning indicator)"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Done-state card rendering with View Result button"
      contains: "View Result"
    - path: "src/server/public/index.html"
      provides: "CSS styles for done-state and failed-state cards"
      contains: "agent-card-done"
  key_links:
    - from: "src/server/public/app.js renderAgentCard"
      to: "src/server/public/app.js navigateToResult"
      via: "Click handler on View Result button calls navigateToResult(agent)"
      pattern: "navigateToResult.*agent"
---

<objective>
Build the done-state variant of the activity card that appears when an agent completes. The card shows what happened (completion summary, elapsed time) and provides a "View Result" button that navigates to the artifact.

Purpose: This is the payoff of D-16 — the card doesn't just tell you something finished, it takes you there. Completed cards transition from the running state (added by M-44 A-123) to a done state with navigation.
Output: Done-state card rendering in app.js, styled in index.html, wired to navigateToResult().
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-45-agent-completion-with-result-navigation/A-129-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add done-state and failed-state card rendering</name>
  <files>src/server/public/app.js</files>
  <action>
Modify the `renderAgentCard(agent)` function (added by M-44 A-123) to handle completed and failed agents with distinct card variants.

The existing renderAgentCard (from M-44) renders running agents. Extend it to handle done/failed states:

**After the existing running-state rendering, add status-specific logic:**

```js
// Inside renderAgentCard(agent), after creating the base card element:

if (agent.status === 'complete' || agent.status === 'failed') {
  // Compute elapsed time
  const elapsed = formatAgentElapsed(agent.startedAt, agent.completedAt);

  if (agent.status === 'complete') {
    card.classList.add('agent-card-done');

    // Completion summary based on agent type
    const summary = getAgentCompletionSummary(agent);

    // Replace the status badge content
    statusBadge.textContent = 'Done';
    statusBadge.className = 'agent-status-badge agent-status-done';

    // Replace elapsed timer with final elapsed time
    timerEl.textContent = elapsed;
    timerEl.classList.add('agent-timer-final');

    // Add completion summary line
    const summaryEl = document.createElement('div');
    summaryEl.className = 'agent-card-summary';
    summaryEl.textContent = summary;
    card.appendChild(summaryEl);

    // Add "View Result" button
    const viewBtn = document.createElement('button');
    viewBtn.className = 'agent-card-view-result';
    viewBtn.textContent = 'View Result';
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateToResult(agent);
    });
    card.appendChild(viewBtn);

  } else if (agent.status === 'failed') {
    card.classList.add('agent-card-failed');

    statusBadge.textContent = 'Failed';
    statusBadge.className = 'agent-status-badge agent-status-failed';

    timerEl.textContent = elapsed;
    timerEl.classList.add('agent-timer-final');

    // Show error message if available
    if (agent.error) {
      const errorEl = document.createElement('div');
      errorEl.className = 'agent-card-error';
      errorEl.textContent = agent.error;
      card.appendChild(errorEl);
    }

    // No "View Result" button for failed agents
  }
}
```

**Add two helper functions near renderAgentCard:**

```js
/**
 * Format elapsed time between two ISO timestamps as human-readable string.
 * @param {string} startIso
 * @param {string|null} endIso
 * @returns {string}
 */
function formatAgentElapsed(startIso, endIso) {
  if (!startIso) return '';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) return minutes + 'm ' + remSec + 's';
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return hours + 'h ' + remMin + 'm';
}

/**
 * Generate a human-readable completion summary for an agent.
 * @param {object} agent
 * @returns {string}
 */
function getAgentCompletionSummary(agent) {
  const result = agent.result || {};
  switch (agent.type) {
    case 'execution':
      return 'Executed ' + (result.actionId || agent.target);
    case 'derivation': {
      const count = result.milestones ? result.milestones.length : 0;
      return count > 0 ? 'Derived ' + count + ' milestone' + (count !== 1 ? 's' : '') : 'Derivation complete';
    }
    case 'action-derivation': {
      const count = result.actionCount;
      const mId = result.milestoneId || agent.target;
      return count != null ? 'Derived ' + count + ' action' + (count !== 1 ? 's' : '') + ' for ' + mId : 'Actions derived for ' + mId;
    }
    case 'revision':
      return 'Revised ' + (result.nodeId || agent.target);
    case 'pipeline': {
      const c = result.completed || 0;
      const f = result.failed || 0;
      return c + ' completed' + (f > 0 ? ', ' + f + ' failed' : '');
    }
    default:
      return 'Completed';
  }
}
```

IMPORTANT: The exact structure of renderAgentCard depends on what M-44 A-123 produces. The above assumes the card has a status badge element and a timer element. Read the actual renderAgentCard function from A-123's output and adapt accordingly. The key contract is:
- Done cards get `.agent-card-done` class
- Failed cards get `.agent-card-failed` class
- Done cards get a "View Result" button that calls `navigateToResult(agent)`
- Both show final elapsed time and a summary line
  </action>
  <verify>
Grep for `agent-card-done` in app.js — should appear in the done-state card logic.
Grep for `navigateToResult` in app.js — should appear in the View Result click handler.
Grep for `getAgentCompletionSummary` in app.js — should appear as function definition and usage.
Grep for `formatAgentElapsed` in app.js — should appear as function definition and usage.
  </verify>
  <done>
renderAgentCard handles complete and failed states. Done cards show green "Done" badge, final elapsed time, type-specific completion summary, and a "View Result" button wired to navigateToResult(). Failed cards show red "Failed" badge, elapsed time, and error message. No View Result on failed cards.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add CSS styles for done-state and failed-state cards</name>
  <files>src/server/public/index.html</files>
  <action>
Add CSS styles in the existing style block of index.html for the done-state and failed-state card variants. Place near where M-44 adds the base agent-card styles.

```css
/* Agent card — done state */
.agent-card-done {
  border-left: 3px solid #22c55e;
  opacity: 0.9;
}

.agent-status-done {
  background: #166534;
  color: #bbf7d0;
}

.agent-card-summary {
  font-size: 12px;
  color: #a1a1aa;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-card-view-result {
  display: inline-block;
  margin-top: 6px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  color: #22c55e;
  background: transparent;
  border: 1px solid #22c55e;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.agent-card-view-result:hover {
  background: #22c55e;
  color: #0a0a0a;
}

/* Agent card — failed state */
.agent-card-failed {
  border-left: 3px solid #ef4444;
  opacity: 0.9;
}

.agent-status-failed {
  background: #7f1d1d;
  color: #fecaca;
}

.agent-card-error {
  font-size: 11px;
  color: #f87171;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Final elapsed time (not ticking) */
.agent-timer-final {
  color: #71717a;
}
```

Style notes:
- Green theme (#22c55e) for done — matches typical dashboard success indicators
- Red theme (#ef4444) for failed — matches existing error patterns in the dashboard
- `border-left` for state indication (unobtrusive, visible)
- `opacity: 0.9` for completed cards so active cards stand out more
- "View Result" button is minimal — outline style, inverts on hover
- Uses the existing dashboard color palette (zinc/neutral dark theme based on the existing app)
  </action>
  <verify>
Grep for `agent-card-done` in index.html — should find the CSS class.
Grep for `agent-card-view-result` in index.html — should find the button styles.
Grep for `agent-card-failed` in index.html — should find the failed state styles.
Load the dashboard in a browser — no CSS parse errors in console.
  </verify>
  <done>
CSS styles exist for done-state cards (green border, green status badge, View Result button with hover), failed-state cards (red border, red status badge, error text), completion summary text, and final elapsed timer. Styles match the dark theme of the existing dashboard.
  </done>
</task>

</tasks>

<verification>
- Completed agent cards visually transition from running to done state
- "View Result" button appears on done cards, not on failed cards
- Clicking "View Result" calls navigateToResult(agent) and navigates to the correct view
- Completion summaries are type-specific and human-readable
- Elapsed time displays correctly (formatted as Xs, Xm Ys, or Xh Ym)
- Failed cards show red error styling with error message
- All styles work in the existing dark-themed dashboard
</verification>

<success_criteria>
Done-state agent cards display completion summary, elapsed time, and a "View Result" button. Clicking the button navigates to the agent's result via navigateToResult(). Failed cards show error state without navigation. Cards are visually distinct from running cards.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-45-agent-completion-with-result-navigation/A-128-SUMMARY.md`
</output>
