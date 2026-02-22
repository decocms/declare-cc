---
milestone: M-49-mode-transition-gate
action: A-107
type: execute
wave: 2
depends_on: ["A-106"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations: ["D-14"]

must_haves:
  truths:
    - "When all nodes are approved, a prominent green 'Enter Execution Mode' button appears in the readiness banner"
    - "When unapproved nodes remain, the button is disabled with a tooltip explaining why"
    - "Clicking the button shows a brief confirmation before transitioning"
    - "After confirming, the view transitions to execution mode"
    - "The button is not visible in DAG view, only in column browser"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "CSS styles for enter-exec-btn in readiness banner"
      contains: "enter-exec-btn"
    - path: "src/server/public/app.js"
      provides: "Enter Execution Mode button rendering and click handler with confirmation"
      contains: "enter-exec-btn"
  key_links:
    - from: "Enter Execution Mode button click"
      to: "switchView('execution')"
      via: "confirm dialog then switchView call"
      pattern: "switchView.*execution"
    - from: "renderReadinessBanner()"
      to: "canEnterExecution()"
      via: "button enabled/disabled state"
      pattern: "canEnterExecution"
---

<objective>
Add a prominent "Enter Execution Mode" button to the readiness banner that appears when all plans are approved, with disabled+tooltip state when plans are pending, and a confirmation step before transitioning.

Purpose: D-14 requires an explicit, intentional transition from planning to execution. The button makes this transition discoverable and deliberate — you can't accidentally end up in execution mode.

Output: Green "Enter Execution Mode" button in the readiness banner with confirmation UX.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-49-mode-transition-gate/PLAN.md
@.planning/milestones/M-49-mode-transition-gate/A-106-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Enter Execution Mode button to readiness banner</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**In index.html — CSS styles:**

Add styles for the enter-exec button near the existing readiness banner styles (around line 2142):

```css
.enter-exec-btn {
  margin-left: auto;
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  background: var(--act-color);
  color: #fff;
  transition: opacity 0.15s;
}
.enter-exec-btn:hover:not(:disabled) { opacity: 0.85; }
.enter-exec-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

Use `var(--act-color)` for the green — this is the action/success color already used throughout the app. The `margin-left: auto` pushes it to the right edge of the flex banner.

**In app.js — modify renderReadinessBanner():**

The function currently renders the banner content at lines 929-988. Modify it to always include the "Enter Execution Mode" button:

1. When ALL nodes are approved (the `unapproved.length === 0` branch at line 955):
   - Keep the "All N nodes approved" text
   - Append an enabled button: `<button class="enter-exec-btn" id="enter-exec-btn">Enter Execution Mode</button>`

2. When some nodes are unapproved (the else branch at line 960):
   - Keep the existing progress text and links
   - Append a disabled button with title tooltip: `<button class="enter-exec-btn" id="enter-exec-btn" disabled title="All nodes must be approved before entering execution mode">Enter Execution Mode</button>`

3. After setting innerHTML in both branches, wire the click handler:
   ```javascript
   const execBtn = document.getElementById('enter-exec-btn');
   if (execBtn && !execBtn.disabled) {
     execBtn.addEventListener('click', () => {
       if (confirm('Enter execution mode? You will not be able to edit plans until you exit.')) {
         switchView('execution');
       }
     });
   }
   ```

Use `confirm()` for the confirmation dialog — simple, native, consistent with the project's vanilla JS approach. Do NOT build a custom modal.

The button relies on `canEnterExecution()` from A-106 being in place, but the disabled state is driven by the unapproved count (which is the same check, just from the banner's perspective). The switchView guard from A-106 is the safety net.
  </action>
  <verify>
  - Search app.js for `enter-exec-btn` — must appear in renderReadinessBanner
  - Search index.html for `.enter-exec-btn` — CSS styles must exist
  - `node -c src/server/public/app.js` passes
  - Verify button is enabled only when unapproved.length === 0
  - Verify button is disabled with title attribute when unapproved nodes remain
  - Verify confirm() is called before switchView('execution')
  </verify>
  <done>
  - Green "Enter Execution Mode" button appears in readiness banner
  - Button is enabled and clickable when all nodes are approved
  - Button is disabled with explanatory tooltip when unapproved nodes remain
  - Clicking enabled button shows native confirm dialog
  - Confirming transitions to execution mode via switchView('execution')
  - Button not visible in DAG view (banner already hidden in DAG mode)
  </done>
</task>

</tasks>

<verification>
- `node -c src/server/public/app.js` passes
- grep confirms enter-exec-btn in both app.js and index.html
- Button disabled state tied to unapproved count, enabled state allows transition with confirmation
- No new DOM elements outside the readiness banner
</verification>

<success_criteria>
The readiness banner now serves as the explicit gate: it shows approval progress AND provides the single entry point to execution mode. Users see a clear, prominent green button when ready, and a disabled button with explanation when not. The transition is intentional (confirm dialog) and guarded (A-106 switchView gate).
</success_criteria>

<output>
After completion, create `.planning/milestones/M-49-mode-transition-gate/A-107-SUMMARY.md`
</output>
