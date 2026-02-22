---
milestone: M-18-browser-based-declaration-capture
action: A-34
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations: ["D-06"]

must_haves:
  truths:
    - "User sees a 'New Declaration' button in the dashboard UI"
    - "Clicking the button opens an inline form with title and statement fields"
    - "Submitting the form calls POST /api/declarations and the new declaration appears in the graph"
    - "User can cancel the form without side effects"
    - "Form shows loading state during submission and error messages on failure"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Declaration input form rendering and submission logic"
      contains: "renderDeclForm"
    - path: "src/server/public/index.html"
      provides: "CSS styles for declaration form"
      contains: "decl-form"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/declarations"
      via: "fetch POST on form submit"
      pattern: "fetch.*api/declarations.*POST"
    - from: "src/server/public/app.js"
      to: "renderColumnBrowser"
      via: "data reload after successful creation triggers re-render"
      pattern: "loadData"
---

<objective>
Build the declaration input UI in the Declare dashboard.

Purpose: Allow users to create new declarations directly from the browser without switching to the terminal. This is the primary user-facing surface for M-18's declaration capture.

Output: Inline form component in the dashboard for entering declaration title and statement, wired to POST /api/declarations.
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
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add declaration input form UI and CSS</name>
  <files>
    src/server/public/index.html
    src/server/public/app.js
  </files>
  <action>
**In src/server/public/index.html:**

Add CSS styles for the declaration form. Place them in the existing `<style>` block, following the dark theme design language (var(--surface), var(--border), var(--decl-color), etc.):

```css
/* Declaration form */
.decl-form-trigger { /* "+" or "New Declaration" button */ }
.decl-form-overlay { /* inline form container, not a modal — appears at top of declaration column or in the side panel */ }
.decl-form input, .decl-form textarea { /* dark inputs matching the theme */ }
.decl-form-actions { /* submit/cancel buttons */ }
.decl-form .form-error { /* error message display */ }
```

Style specifics:
- Form inputs: `background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 8px 12px; width: 100%; font-size: 13px;`
- Title input: single line `<input type="text">`
- Statement input: `<textarea>` with 3 rows, resize vertical
- Submit button: `background: var(--decl-color); color: #fff; border: none; border-radius: 4px; padding: 6px 16px; cursor: pointer;`
- Cancel button: ghost style, `background: transparent; border: 1px solid var(--border); color: var(--text-dim);`
- Error text: `color: var(--broken-color); font-size: 12px; margin-top: 4px;`
- Loading state: submit button text changes to "Creating..." and is disabled

Also add a small "+" button element in the declaration column header area of the column browser. The column browser header for declarations (look for where `$colDeclList` or the declarations column label is rendered) should get a clickable "+" icon.

**In src/server/public/app.js:**

1. Add state variables:
   ```js
   let declFormVisible = false;
   let declFormLoading = false;
   let declFormError = null;
   ```

2. Add a `renderDeclForm()` function that:
   - Creates or updates a form container element (id: `decl-form-container`) at the top of the declarations column in the column browser
   - If `declFormVisible` is false, hides/removes the form
   - If true, renders:
     ```html
     <div class="decl-form">
       <input id="decl-title" placeholder="Declaration title" />
       <textarea id="decl-statement" rows="3" placeholder="What future state are you declaring?"></textarea>
       <div class="decl-form-actions">
         <button id="decl-submit">Create</button>
         <button id="decl-cancel">Cancel</button>
       </div>
       <div class="form-error" id="decl-error"></div>
     </div>
     ```
   - Wires submit button click to `submitDeclaration()`
   - Wires cancel button click to hide form and clear state
   - Wires Enter key in title field to move focus to statement
   - Wires Cmd/Ctrl+Enter in statement to submit

3. Add a `submitDeclaration()` async function that:
   - Reads title and statement from the form inputs
   - Validates: title required (show error if empty), statement required
   - Sets `declFormLoading = true`, updates button text to "Creating...", disables inputs
   - Calls `fetch('/api/declarations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, statement }) })`
   - On success (201): hides form, clears state, calls `loadData()` to refresh the graph
   - On error: displays error message in the form, re-enables inputs
   - Sets `declFormLoading = false`

4. Add a "+" button in the column browser's declaration column header. Wire its click to toggle `declFormVisible` and call `renderDeclForm()`. Insert this button rendering into `renderColumnBrowser()` — add it before the declaration list items, right after clearing `$colDeclList.innerHTML`.

5. The form should also work in DAG view: add a "New Declaration" button somewhere accessible (e.g., in the status bar area near the declaration count, or at the top of the declarations layer). When clicked, if in DAG view, switch to column view and show the form. Alternatively, render the form in the side panel. Use judgment here — the simplest approach is to place the button in the status bar and render the form in the side panel regardless of view mode.
  </action>
  <verify>
Start the server, open the dashboard. In column browser view, click the "+" button in the declarations column. A form should appear. Type a title and statement, click Create. The form should show loading state, then disappear and the new declaration should appear in the list. Test cancel button. Test empty field validation.
  </verify>
  <done>Dashboard has a working inline declaration form. Users can create declarations from the browser. Form validates input, shows loading/error states, and refreshes the graph on success.</done>
</task>

</tasks>

<verification>
- "+" button visible in column browser declaration column header
- Clicking "+" shows inline form with title and statement fields
- Submitting with valid data creates declaration (visible in graph after refresh)
- Submitting with empty fields shows validation error
- Cancel dismisses form cleanly
- Loading state visible during API call
- API error messages displayed in form
</verification>

<success_criteria>
Users can create new declarations entirely from the browser dashboard without any terminal interaction. The form integrates naturally with the existing dark theme and column browser layout.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-18-browser-based-declaration-capture/A-34-SUMMARY.md`
</output>
