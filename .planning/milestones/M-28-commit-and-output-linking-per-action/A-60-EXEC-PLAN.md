---
milestone: M-28-commit-and-output-linking-per-action
action: A-60
type: execute
wave: 2
depends_on:
  - A-59
files_modified:
  - src/server/public/app.js
  - dist/public/app.js
autonomous: true
declarations:
  - D-08

must_haves:
  truths:
    - "Action detail panel shows a Commits section with clickable short SHAs when commits exist"
    - "Each commit displays the short SHA, commit message, and relative date"
    - "Clicking a commit SHA opens the full commit in a new tab (or copies to clipboard if no remote)"
    - "Actions with no commits show no Commits section (clean, not 'No commits')"
    - "Produced files from SUMMARY.md are listed as clickable links in the action detail"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "Commit list and output links rendering in loadExecPlan()"
    - path: "dist/public/app.js"
      provides: "Built copy of the dashboard JS"
  key_links:
    - from: "src/server/public/app.js"
      to: "/api/action/:id"
      via: "fetch in loadExecPlan"
      pattern: "data\\.commits"
    - from: "src/server/public/app.js"
      to: "commit rendering"
      via: "innerHTML construction"
      pattern: "shortSha|commit.*sha"
---

<objective>
Render commit hashes and produced-file links in the action detail panel of the dashboard, making execution outputs visible and navigable.

Purpose: Complete D-08's "commit outputs are linked" requirement by showing clickable commit SHAs and produced artifacts in the UI.
Output: Enhanced action detail panel with Commits section and Files produced section.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-28-commit-and-output-linking-per-action/A-59-SUMMARY.md
@src/server/public/app.js
@src/commands/get-exec-plan.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add commits and output links to action detail panel</name>
  <files>src/server/public/app.js</files>
  <action>
In the `loadExecPlan()` function (around line 1301), after the existing metadata bar and before the Execute button section, add two new sections:

**1. Commits section** — render if `data.commits && data.commits.length > 0`:

```
<div style="margin-bottom:14px">
  <div class="detail-label">Commits ({count})</div>
  <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
    {for each commit:}
    <div style="display:flex;align-items:baseline;gap:8px;font-size:11px">
      <a href="#" class="commit-link" data-sha="{commit.sha}"
         style="font-family:monospace;font-size:11px;font-weight:700;color:#60a5fa;text-decoration:none;letter-spacing:0.03em"
         title="Click to copy full SHA">{commit.shortSha}</a>
      <span style="color:var(--text-dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{commit.message}</span>
      <span style="color:var(--text-dim);opacity:0.5;font-size:10px;white-space:nowrap">{relative date}</span>
    </div>
  </div>
</div>
```

For the relative date, add a small helper `relativeDate(dateStr)` that converts an ISO date string to "2d ago", "3h ago", "just now" etc. Keep it simple: compute diff in seconds, then pick the largest unit (years, months, days, hours, minutes).

For the commit link click handler: When clicked, copy the full SHA to clipboard using `navigator.clipboard.writeText(sha)` and briefly change the link text to "Copied!" for 1.5 seconds, then revert to shortSha. This is more useful than opening a URL since git remotes may vary.

**2. Produced files section** — render if `data.summaryContent` exists. Parse the summary content for a "## Files modified" or "## Files" section. Extract file paths (lines starting with `- ` that contain backtick-wrapped paths like `` `src/foo/bar.js` ``). Display them as monospace tags similar to the existing "Files" section but labeled "Files produced":

```
<div style="margin-bottom:14px">
  <div class="detail-label">Files produced</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
    {file path badges}
  </div>
</div>
```

Use the same badge style as the existing "Files" section (act-bg, act-border, act-color) but with a slightly different border color (use `var(--done-border)` or `var(--done-color)` tint) to distinguish "planned files" from "produced files".

Place the Commits section after the metadata bar and before the Execute button. Place the Produced files section after the existing Files section.
  </action>
  <verify>
Start the dev server and visit http://localhost:3847. Click on a completed action that has commits (e.g., A-79, A-80, A-81 in M-38). Verify:
1. A "Commits" section appears with short SHAs in blue monospace
2. Clicking a SHA copies the full hash to clipboard (check with Cmd+V)
3. Each commit shows message text and relative date
4. The commits are sorted newest-first

Click on a PENDING action with no commits (e.g., A-34). Verify no Commits section appears.
  </verify>
  <done>Completed actions show clickable commit hashes with messages and dates. Pending actions show no commit section. File paths from SUMMARY.md appear as produced-file badges.</done>
</task>

<task type="auto">
  <name>Task 2: Copy built assets to dist/public</name>
  <files>dist/public/app.js</files>
  <action>
Copy the updated `src/server/public/app.js` to `dist/public/app.js` so the built distribution serves the new UI.

Run: `cp src/server/public/app.js dist/public/app.js`

This follows the same pattern used by prior actions (A-68, A-70, A-81, A-84, A-88).
  </action>
  <verify>
`diff src/server/public/app.js dist/public/app.js` produces no output (files are identical).
  </verify>
  <done>dist/public/app.js matches src/server/public/app.js. Dashboard serves the updated commit UI from both dev and dist paths.</done>
</task>

</tasks>

<verification>
- Start server, navigate to a completed action with known commits (A-79, A-80, A-81)
- Commits section visible with blue monospace SHAs, message excerpts, relative dates
- Click SHA copies full hash to clipboard
- Pending actions (A-34) show no commits section
- dist/public/app.js matches source
</verification>

<success_criteria>
Action detail panel renders commit history for completed actions with clickable SHAs (copy-to-clipboard), commit messages, and relative dates. Produced files from SUMMARY.md appear as labeled badges. No visual regressions in existing panel sections. Both src and dist copies are in sync.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-28-commit-and-output-linking-per-action/A-60-SUMMARY.md`
</output>
