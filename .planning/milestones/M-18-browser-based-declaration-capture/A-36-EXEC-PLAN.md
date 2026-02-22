---
milestone: M-18-browser-based-declaration-capture
action: A-36
type: execute
wave: 2
depends_on: ["A-34", "A-35"]
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: false
declarations: ["D-06"]

must_haves:
  truths:
    - "User can click an edit button on any declaration in the detail panel to enter inline edit mode"
    - "In edit mode, title and statement become editable fields pre-filled with current values"
    - "Saving an edit calls PUT /api/declarations/:id and the updated declaration appears immediately"
    - "User can delete a declaration (with no linked milestones) via a delete button with confirmation"
    - "Status field is editable via a dropdown or toggle in the declaration detail panel"
    - "All changes persist to FUTURE.md and are committed to git"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Inline edit mode for declaration detail panel"
      contains: "renderDeclEditMode"
    - path: "src/server/public/index.html"
      provides: "CSS for edit mode inputs and delete confirmation"
      contains: "decl-edit"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/declarations/:id"
      via: "fetch PUT on save"
      pattern: "fetch.*api/declarations.*PUT"
    - from: "src/server/public/app.js"
      to: "/api/declarations/:id"
      via: "fetch DELETE on confirm delete"
      pattern: "fetch.*api/declarations.*DELETE"
    - from: "src/server/public/app.js"
      to: "renderPanelContent"
      via: "edit mode replaces static panel content with editable fields"
      pattern: "renderDeclEditMode"
---

<objective>
Add inline approve/adjust flow for declarations in the dashboard.

Purpose: Complete the browser-based declaration capture by enabling users to edit, update status, and delete declarations without leaving the UI. This makes the dashboard the primary surface for declaration management per D-06.

Output: Inline-editable declaration nodes with edit/save/cancel/delete actions and immediate graph update.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/server/public/app.js
@src/server/public/index.html
@src/server/index.js
@.planning/milestones/M-18-browser-based-declaration-capture/A-34-SUMMARY.md
@.planning/milestones/M-18-browser-based-declaration-capture/A-35-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add inline edit mode to declaration detail panel</name>
  <files>
    src/server/public/app.js
    src/server/public/index.html
  </files>
  <action>
**In src/server/public/index.html:**

Add CSS styles for the edit mode UI:
- `.decl-edit-mode input, .decl-edit-mode textarea` — same input styles as the creation form from A-34
- `.decl-edit-actions` — button row with save/cancel/delete
- `.decl-edit-actions .btn-save` — uses `var(--decl-color)` background
- `.decl-edit-actions .btn-cancel` — ghost style
- `.decl-edit-actions .btn-delete` — `background: transparent; color: var(--broken-color); border: 1px solid var(--broken-border);`
- `.delete-confirm` — confirmation prompt: "Are you sure? This cannot be undone." with confirm/cancel buttons
- `.decl-status-select` — styled select/dropdown matching theme: `background: var(--surface2); color: var(--text); border: 1px solid var(--border);`

**In src/server/public/app.js:**

1. Add state:
   ```js
   let editingDeclId = null;  // ID of declaration currently being edited
   let editFormLoading = false;
   let editFormError = null;
   let deleteConfirmId = null; // ID showing delete confirmation
   ```

2. Modify `renderPanelContent()` for declaration type: When `type === 'declaration'` AND `editingDeclId === item.id`, instead of rendering the static view, call `renderDeclEditMode(item)` and return. Otherwise render as normal but add an "Edit" button and a "Delete" button at the bottom of the declaration detail section.

3. Create `renderDeclEditMode(item)` function:
   - Renders into `$panelBody`:
     ```html
     <div class="detail-id">DECLARATION . {item.id}</div>
     <div class="decl-edit-mode">
       <label>Title</label>
       <input id="edit-decl-title" value="{item.title}" />
       <label>Statement</label>
       <textarea id="edit-decl-statement" rows="4">{item.statement}</textarea>
       <label>Status</label>
       <select id="edit-decl-status">
         <option value="PENDING" {selected}>PENDING</option>
         <option value="ACTIVE" {selected}>ACTIVE</option>
         <option value="DONE" {selected}>DONE</option>
         <option value="HONORED" {selected}>HONORED</option>
         <option value="KEPT" {selected}>KEPT</option>
       </select>
       <div class="decl-edit-actions">
         <button class="btn-save" id="edit-decl-save">Save</button>
         <button class="btn-cancel" id="edit-decl-cancel">Cancel</button>
       </div>
       <div class="form-error" id="edit-decl-error"></div>
     </div>
     ```
   - Wire save button: read values, call `saveDeclEdit(item.id)`
   - Wire cancel button: set `editingDeclId = null`, re-render panel with original item
   - Wire Cmd/Ctrl+Enter in textarea to save

4. Create `saveDeclEdit(id)` async function:
   - Read title, statement, status from form inputs
   - Validate: title and statement required
   - Set `editFormLoading = true`, disable save button, show "Saving..."
   - Call `fetch('/api/declarations/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, statement, status }) })`
   - On success: set `editingDeclId = null`, call `loadData()` to refresh
   - On error: show error in `#edit-decl-error`
   - Set `editFormLoading = false`

5. Add "Edit" button to declaration detail panel (in the non-edit rendering path of `renderPanelContent` for declarations). When clicked: `editingDeclId = item.id` and re-render panel.

6. Add "Delete" button to declaration detail panel. When clicked: show delete confirmation inline (set `deleteConfirmId = item.id`, re-render). The confirmation shows "Delete {id}? This removes it from FUTURE.md." with "Confirm Delete" and "Cancel" buttons.

7. Create `deleteDeclaration(id)` async function:
   - Call `fetch('/api/declarations/' + id, { method: 'DELETE' })`
   - On success: close panel (`selectedNodeId = null`), call `loadData()` to refresh
   - On error (e.g., has linked milestones): show error message in panel
   - Reset `deleteConfirmId = null`

8. Ensure that when `loadData()` completes and the panel is showing a declaration that was being edited, the edit mode is exited cleanly (editingDeclId reset if the node no longer exists).
  </action>
  <verify>
Start the server, open the dashboard. Click a declaration to open the detail panel. Click "Edit" — fields become editable. Change the title, click "Save" — panel updates with new title, FUTURE.md shows the change. Click "Edit" then "Cancel" — reverts to static view. Click "Delete" on a declaration with no milestones — shows confirmation, confirm — declaration removed. Click "Delete" on a declaration with milestones — shows error message.
  </verify>
  <done>Declaration detail panel supports inline editing of title, statement, and status. Delete with confirmation works for unlinked declarations. All changes persist via API and refresh the graph.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete browser-based declaration capture: create form (A-34), CRUD API (A-35), and inline edit/delete flow (A-36). The full lifecycle of a declaration can now be managed from the dashboard.</what-built>
  <how-to-verify>
    1. Open http://localhost:3847 in the browser
    2. Switch to column browser view if not already
    3. Click "+" in the declarations column — form appears
    4. Enter title "Test Declaration" and statement "This is a test" — click Create
    5. New declaration should appear in the list immediately
    6. Click the new declaration to open detail panel
    7. Click "Edit" — fields become editable with current values
    8. Change the title to "Updated Test" — click Save
    9. Panel should show "Updated Test" as the title
    10. Click "Delete" — confirmation prompt appears
    11. Click "Confirm Delete" — declaration removed from list
    12. Check `git log --oneline -5` — should see 3 commits (add, update, delete)
    13. Check .planning/FUTURE.md — should be in canonical format
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Edit button on declaration detail opens inline edit mode
- Save persists changes via PUT /api/declarations/:id
- Cancel reverts to read-only view without API call
- Status dropdown allows changing declaration status
- Delete shows confirmation, then removes via DELETE /api/declarations/:id
- Delete blocked for declarations with linked milestones (shows error)
- All mutations trigger graph refresh via SSE
- FUTURE.md stays in canonical format throughout
</verification>

<success_criteria>
Users can perform the complete declaration lifecycle (create, read, update, delete) entirely from the browser dashboard. The inline edit flow is smooth — no page reloads, no terminal required. Git commits are created for each change.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-18-browser-based-declaration-capture/A-36-SUMMARY.md`
</output>
