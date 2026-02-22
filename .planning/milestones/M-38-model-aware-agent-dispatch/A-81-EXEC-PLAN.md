---
milestone: M-38-model-aware-agent-dispatch
action: A-81
type: execute
wave: 3
depends_on:
  - A-79
  - A-80
files_modified:
  - src/commands/get-exec-plan.js
  - src/server/public/app.js
  - dist/public/app.js
autonomous: true
declarations:
  - D-07

must_haves:
  truths:
    - "Each action node in the dashboard shows a small model badge (e.g. 'OPUS', 'SONNET', 'HAIKU')"
    - "The badge reads from SUMMARY.md frontmatter when the action has been executed"
    - "When no SUMMARY.md exists, the badge shows the expected model from config.json modelAssignment (executor role = opus)"
    - "The badge is visually distinct from the status badge — smaller, different color register"
    - "The /api/action/:id response includes a model field"
  artifacts:
    - path: "src/commands/get-exec-plan.js"
      provides: "model field in API response, read from SUMMARY.md or config.json fallback"
      contains: "modelAssignment"
    - path: "src/server/public/app.js"
      provides: "model badge rendering in the exec-plan detail area"
      contains: "model-badge"
    - path: "dist/public/app.js"
      provides: "built copy of app.js with model badge"
      contains: "model-badge"
  key_links:
    - from: "src/commands/get-exec-plan.js"
      to: ".planning/config.json"
      via: "require/readFileSync to read modelAssignment"
      pattern: "modelAssignment"
    - from: "src/commands/get-exec-plan.js"
      to: "A-XX-SUMMARY.md frontmatter"
      via: "readFileSync + frontmatter parse for model field"
      pattern: "summaryContent.*model|model.*summary"
    - from: "src/server/public/app.js loadExecPlan"
      to: "data.model"
      via: "metaParts push with model badge span"
      pattern: "data\\.model"
---

<objective>
Surface which model ran (or will run) each action as a small badge in the dashboard action panel, sourced from SUMMARY.md execution metadata or config.json as fallback.

Purpose: Once agents run with explicit model parameters (A-80), the dashboard should make those assignments visible. A developer looking at an action can see at a glance whether it was executed by opus, sonnet, or haiku — useful for auditing cost and understanding role assignments.

Output: `get-exec-plan.js` emits a `model` field; `app.js` renders it as a badge in the exec-plan metadata bar alongside Wave, Autonomous, and Executed.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/config.json
@src/commands/get-exec-plan.js
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model field to get-exec-plan.js API response</name>
  <files>src/commands/get-exec-plan.js</files>
  <action>
Edit `src/commands/get-exec-plan.js` to resolve and return a `model` field in the response object.

**Resolution logic (in priority order):**

1. **If SUMMARY.md exists and its frontmatter contains a `model` field:** use that value. This records the actual model used at execution time. The SUMMARY.md frontmatter is already parsed into `summaryContent` — parse its frontmatter using the same `parseFrontmatter` function already in the file.

2. **If no SUMMARY.md, or SUMMARY.md has no `model` field:** fall back to the config.json `modelAssignment` for the `"executor"` role (since all actions in this project are executed by executor agents). Read `.planning/config.json` (relative to `cwd`) using `readFileSync`. If config.json or `modelAssignment.executor` is missing, use `null`.

**Implementation steps:**

Add a helper function `resolveActionModel(cwd, summaryContent)` that:
- If `summaryContent` is provided, calls `parseFrontmatter` on the section between `---` markers in the summary (same regex used in `runGetExecPlan` for the exec-plan), extracts the `model` key
- If found and non-empty, returns that model string
- Otherwise reads `join(cwd, '.planning', 'config.json')`, parses JSON, returns `config.modelAssignment?.executor ?? null`
- Wraps in try/catch: returns `null` on any error

Call `resolveActionModel(cwd, summaryContent)` in `runGetExecPlan` after `summaryContent` is set, store result as `modelUsed`.

Add `model: modelUsed` to both return paths: the "no exec-plan found" path and the full response object.

Do NOT change the existing return shape for any other field. Do NOT remove `summaryContent` from the return (other code may depend on it).
  </action>
  <verify>
Run: `node -e "const {runGetExecPlan} = require('./src/commands/get-exec-plan'); const r = runGetExecPlan(process.cwd(), ['--action','A-79']); console.log('model:', r.model, typeof r.model)"`

Expected: prints `model: opus string` (since A-79 has no SUMMARY yet, falls back to config executor model which is opus after A-79 executes and creates the config entry).

If A-79 is not yet executed and config.json does not yet have modelAssignment, the result should be `model: null` without throwing an error.

Run: `node -e "const {runGetExecPlan} = require('./src/commands/get-exec-plan'); const r = runGetExecPlan(process.cwd(), ['--action','A-71']); console.log('has model key:', 'model' in r)"`

Expected: prints `has model key: true` (key exists even if value is null).
  </verify>
  <done>`get-exec-plan.js` exports `model` field in all response paths. Model resolves from SUMMARY.md frontmatter if present, otherwise from config.json modelAssignment.executor. Returns null on missing config without throwing.</done>
</task>

<task type="auto">
  <name>Task 2: Render model badge in dashboard app.js</name>
  <files>src/server/public/app.js, dist/public/app.js</files>
  <action>
Edit `src/server/public/app.js` in the `loadExecPlan` async function. The function fetches `/api/action/:id` and renders a metadata bar at the top of the exec-plan detail area. Currently the bar shows Wave, Autonomous, DependsOn, and Executed badges.

**Add a model badge to the metadata bar:**

Locate this block (around line 810-820 in `dist/public/app.js`):
```js
const metaParts = [];
if (ep.wave != null) metaParts.push(`Wave ${ep.wave}`);
if (ep.autonomous != null) metaParts.push(ep.autonomous ? '⚡ Autonomous' : '🧑 Checkpoint');
if (ep.dependsOn && ep.dependsOn.length) metaParts.push(`Depends: ${ep.dependsOn.join(', ')}`);
if (data.summaryExists) metaParts.push('✓ Executed');
```

After determining `metaParts`, add model badge rendering as a **separate HTML element** (not a plain string pushed into `metaParts`). Place it before the `metaParts` div or inline within it. The model badge should use a visually distinct style — smaller font, accent color based on model tier:

```js
// Model badge — separate from the generic metaParts pills
let modelBadgeHtml = '';
if (data.model) {
  const modelUpper = String(data.model).toUpperCase();
  // Color by model tier
  const modelColor = {
    'OPUS': '#a78bfa',    // purple — highest capability
    'SONNET': '#60a5fa',  // blue — mid tier
    'HAIKU': '#34d399',   // green — fast/cheap
  }[modelUpper] || 'var(--text-dim)';
  const modelBg = {
    'OPUS': 'rgba(167,139,250,0.12)',
    'SONNET': 'rgba(96,165,250,0.12)',
    'HAIKU': 'rgba(52,211,153,0.12)',
  }[modelUpper] || 'var(--surface2)';
  modelBadgeHtml = `<span class="model-badge" style="background:${modelBg};color:${modelColor};border:1px solid ${modelColor}33;border-radius:5px;padding:2px 7px;font-size:9px;font-weight:800;letter-spacing:0.08em;font-family:monospace">${modelUpper}</span>`;
}
```

Then include `modelBadgeHtml` in the rendered output. Append it inside the existing `metaParts` flex container div (after the mapped metaParts spans), or prepend it before. Example — update the metaParts container to:

```js
if (metaParts.length || modelBadgeHtml) {
  html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;align-items:center">
    ${modelBadgeHtml}
    ${metaParts.map(p => `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;color:var(--text-dim)">${p}</span>`).join('')}
  </div>`;
}
```

After editing `src/server/public/app.js`, copy it to `dist/public/app.js` (the served static file):

```bash
cp /Users/guilherme/Projects/declare-cc/src/server/public/app.js /Users/guilherme/Projects/declare-cc/dist/public/app.js
```

Do NOT change any other rendering logic. Do NOT modify CSS in index.html. The badge uses inline styles consistent with the rest of the file.
  </action>
  <verify>
Run: `grep -c "model-badge\|modelBadgeHtml\|data\.model" /Users/guilherme/Projects/declare-cc/src/server/public/app.js`

Expected: 3 or more (the class, variable, and usage).

Run: `grep -c "model-badge\|modelBadgeHtml\|data\.model" /Users/guilherme/Projects/declare-cc/dist/public/app.js`

Expected: 3 or more (dist copy matches src).

Run: `diff /Users/guilherme/Projects/declare-cc/src/server/public/app.js /Users/guilherme/Projects/declare-cc/dist/public/app.js`

Expected: no diff (files are identical).

Run: `node -e "require('./src/server/public/app.js')" 2>&1 || true`

Note: This will fail (browser-targeted file with `document`), which is expected. Verify the file is valid JS syntax: `node --check /Users/guilherme/Projects/declare-cc/src/server/public/app.js`

Expected: exits 0 (no syntax errors).
  </verify>
  <done>src/server/public/app.js and dist/public/app.js both contain model badge rendering logic. Model badge shows OPUS in purple, SONNET in blue, HAIKU in green, positioned before the metadata pills in the exec-plan detail area. Files are identical (dist is copy of src). No syntax errors.</done>
</task>

</tasks>

<verification>
- `node --check /Users/guilherme/Projects/declare-cc/src/commands/get-exec-plan.js` exits 0
- `node --check /Users/guilherme/Projects/declare-cc/src/server/public/app.js` exits 0
- `node -e "const {runGetExecPlan} = require('./src/commands/get-exec-plan'); const r = runGetExecPlan(process.cwd(), ['--action','A-79']); if (!('model' in r)) throw new Error('no model field'); console.log('model field present:', r.model)"` exits 0
- `grep "model-badge" /Users/guilherme/Projects/declare-cc/dist/public/app.js` returns a match
- `diff /Users/guilherme/Projects/declare-cc/src/server/public/app.js /Users/guilherme/Projects/declare-cc/dist/public/app.js` returns no output (files identical)
</verification>

<success_criteria>
The `/api/action/:id` endpoint returns a `model` field (string or null). The dashboard action panel shows a colored model badge (OPUS/SONNET/HAIKU) when a model is resolved. Both `src/server/public/app.js` and `dist/public/app.js` are updated and identical. No existing dashboard functionality is broken.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-38-model-aware-agent-dispatch/A-81-SUMMARY.md`
</output>
