---
milestone: M-50-execution-order-configuration
action: A-109
type: execute
wave: 2
depends_on: ["A-108", "A-110"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations: ["D-15"]

must_haves:
  truths:
    - "Milestones within the same wave can be dragged to reorder"
    - "Actions within the same milestone can be dragged to reorder"
    - "Cross-wave drag is visually blocked — items cannot be dropped into a different wave"
    - "Valid drop zones highlight on drag, invalid zones gray out"
    - "Confirming order after reorder saves the new order to execution manifest via POST /api/execution-manifest"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "HTML5 drag-and-drop handlers for wave-constrained reordering"
      contains: "dragstart|dragover|drop"
    - path: "src/server/public/index.html"
      provides: "CSS for drag feedback — valid/invalid drop zones, dragging state"
      contains: "exec-drag"
  key_links:
    - from: "renderPreExecutionView drag handlers"
      to: "POST /api/execution-manifest"
      via: "Confirm Order button saves reordered waves"
      pattern: "execution-manifest"
    - from: "dragstart on milestone/action"
      to: "dragover/drop validation"
      via: "data-wave-idx attribute constrains drops to same wave"
      pattern: "data-wave-idx"
---

<objective>
Add drag-to-reorder capability within dependency constraints to the pre-execution wave order view. Milestones can be reordered within their wave, actions within their milestone. Cross-wave reordering is blocked with visual feedback. On confirm, the reordered state is saved to the execution manifest.

Purpose: D-15 requires the user to confirm (and optionally adjust) execution order. This action adds the adjustment capability — reordering within safe boundaries that cannot violate dependency constraints.

Output: Drag-and-drop reordering in the pre-execution view with constraint enforcement and visual feedback.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@.planning/milestones/M-50-execution-order-configuration/A-108-SUMMARY.md
@.planning/milestones/M-50-execution-order-configuration/A-110-SUMMARY.md
@src/server/public/app.js (renderPreExecutionView from A-108, computeWaveOrder helper, orderConfirmed state)
@src/server/public/index.html (exec-preorder CSS classes from A-108)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement HTML5 drag-and-drop reordering within waves</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
Using the HTML5 Drag and Drop API (no external libraries per user decision), add reorder capability to the pre-execution view created by A-108.

In app.js — modify `renderPreExecutionView()`:

1. **Track mutable wave order state.** When `renderPreExecutionView()` first computes waves (via `computeWaveOrder()`), store the result in a module-level variable `let preExecWaves = null;` so that reordering mutates this state in-place and re-renders.

2. **Make milestone items draggable.** On each milestone element in the pre-execution list:
   - Add `draggable="true"`
   - Add `data-wave-idx="${waveIdx}"` and `data-milestone-idx="${mileIdx}"` attributes
   - On `dragstart`: set `e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'milestone', waveIdx, mileIdx }))`, add class `exec-dragging` to the element, store the source wave index in a module variable `dragSourceWave`
   - On `dragend`: remove `exec-dragging` class, clear `dragSourceWave`, remove all `exec-drop-valid`/`exec-drop-invalid` classes from the DOM

3. **Make action items draggable.** On each action element:
   - Add `draggable="true"`
   - Add `data-wave-idx="${waveIdx}"` and `data-milestone-idx="${mileIdx}"` and `data-action-idx="${actIdx}"` attributes
   - On `dragstart`: set data with `{ type: 'action', waveIdx, mileIdx, actIdx }`, add `exec-dragging`, store source wave + milestone
   - On `dragend`: cleanup as above

4. **Drop zone validation on milestone groups** (for milestone reorder within wave):
   - On `dragover` of each milestone element: check if the dragged item is `type: 'milestone'` and same `waveIdx` → if yes, `e.preventDefault()` (allow drop) and add `exec-drop-valid` class. If different wave, add `exec-drop-invalid` class and do NOT preventDefault.
   - On `drop`: parse the transfer data, splice the milestone from its old index and insert at the new index within `preExecWaves[waveIdx]`, then re-render by calling `renderPreExecutionView()` (which reads from `preExecWaves` if set).
   - On `dragleave`: remove `exec-drop-valid`/`exec-drop-invalid`.

5. **Drop zone validation on action items** (for action reorder within milestone):
   - On `dragover`: check `type: 'action'` AND same `waveIdx` AND same `mileIdx` → allow. Different milestone or wave → block with `exec-drop-invalid`.
   - On `drop`: splice action from old index, insert at new index within `preExecWaves[waveIdx][mileIdx].actions`, re-render.

6. **Rendering from mutable state.** Modify `renderPreExecutionView()`:
   - If `preExecWaves` is null, compute from `computeWaveOrder()` and store
   - If `preExecWaves` is set, render from it (preserving user's reordering)
   - Reset `preExecWaves = null` when `orderConfirmed` is set to false (entering execution mode)

7. **Save reordered state on Confirm.** Modify the "Confirm Order" button handler:
   - Build manifest from `preExecWaves`: `{ waves: preExecWaves.map((wave, i) => ({ waveNumber: i + 1, milestones: wave.map(m => ({ id: m.id, actions: m.actions.map(a => a.id) })) })) }`
   - POST to `/api/execution-manifest` with this body
   - On success, set `orderConfirmed = true` and transition to live view
   - On error, show alert with error message

In index.html — add CSS:

8. Drag feedback styles:
   - `.exec-dragging` — opacity 0.4, outline 2px dashed var(--planned-color)
   - `.exec-drop-valid` — outline 2px solid var(--act-color), background rgba(var(--act-color-rgb), 0.08) (use a suitable green-tinted rgba)
   - `.exec-drop-invalid` — outline 2px solid var(--broken-color), opacity 0.5, cursor not-allowed (use `cursor: no-drop`)
   - `.exec-preorder-milestone[draggable="true"]` — cursor grab
   - `.exec-preorder-milestone[draggable="true"]:active` — cursor grabbing
   - `.exec-preorder-action[draggable="true"]` — cursor grab
   - `.exec-preorder-action[draggable="true"]:active` — cursor grabbing
   - Add a subtle drag handle indicator: `::before` pseudo-element with grip dots (content "⋮⋮" or similar) on draggable items, color var(--text-dim), margin-right 6px
  </action>
  <verify>
    1. Start server and enter execution mode
    2. Drag a milestone within its wave — it reorders and re-renders in new position
    3. Try dragging a milestone to a different wave — drop is blocked, invalid visual feedback shown
    4. Drag an action within its milestone — it reorders
    5. Try dragging an action to a different milestone — blocked
    6. After reordering, click "Confirm Order" — check that .planning/execution-manifest.json contains the reordered structure
    7. Verify the live pipeline view appears after confirming
  </verify>
  <done>Milestones draggable within their wave, actions within their milestone. Cross-wave/cross-milestone drag blocked with visual feedback. Confirmed order saved to manifest.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete execution order configuration flow: pre-execution wave view, drag-to-reorder within constraints, manifest persistence</what-built>
  <how-to-verify>
    1. Start server: `node src/server/index.js` (or `declare dashboard`)
    2. Open http://localhost:3847 in browser
    3. Enter execution mode via "Enter Execution Mode" button
    4. Verify: wave-ordered list appears with milestones and actions, "Confirm Order" button at bottom
    5. Drag a milestone within its wave — it should reorder smoothly
    6. Try dragging a milestone to another wave — should show red invalid feedback and block
    7. Drag an action within its milestone — reorders
    8. Try dragging action to different milestone — blocked
    9. Click "Confirm Order" — transitions to live pipeline view
    10. Check .planning/execution-manifest.json exists with correct structure
    11. Exit and re-enter execution mode — pre-execution view appears again (order not auto-confirmed)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Drag reorder works for milestones within same wave
- Drag reorder works for actions within same milestone
- Cross-wave milestone drag is visually blocked (red outline, no-drop cursor)
- Cross-milestone action drag is visually blocked
- Drag feedback: valid zones highlight green, invalid zones highlight red
- Confirm Order saves reordered state to execution-manifest.json via POST API
- Manifest structure matches expected format with waveNumber, milestones, actions
- Full flow: enter exec mode -> review order -> optionally reorder -> confirm -> live pipeline
</verification>

<success_criteria>
Users can review and adjust execution order within dependency-safe boundaries before confirming. The adjusted order is persisted as execution-manifest.json and governs subsequent execution.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-50-execution-order-configuration/A-109-SUMMARY.md`
</output>
