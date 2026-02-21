---
milestone: M-32-integrity-visualization-in-the-dashboard
action: A-68
type: execute
wave: 2
depends_on: ["A-67"]
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
  - dist/public/index.html
  - dist/public/app.js
autonomous: true
declarations:
  - D-10
user_setup: []

must_haves:
  truths:
    - "Each node card shows a colored left border reflecting its wholeness (green=whole, amber=partial, red=broken)"
    - "The detail panel shows a wholeness section with text label and colored badge for selected node"
    - "For milestones in detail panel, a breakdown like '3/5 actions done' appears in the wholeness section"
    - "For declarations in detail panel, a breakdown like '2/4 milestones done' appears in the wholeness section"
    - "The status bar shows overall project integrity as a percentage, replacing the current 'Integrity: undefined' text"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "CSS variables and classes for wholeness border colors and wholeness badge"
      contains: "--wholeness-whole"
    - path: "src/server/public/app.js"
      provides: "Wholeness-aware buildNodeEl, renderPanelContent, and renderStatusBar"
      contains: "item.wholeness"
    - path: "dist/public/index.html"
      provides: "Production copy of index.html"
    - path: "dist/public/app.js"
      provides: "Production copy of app.js"
  key_links:
    - from: "src/server/public/app.js (buildNodeEl)"
      to: "item.wholeness field from /api/graph"
      via: "inline style border-left based on wholeness value"
      pattern: "wholeness.*border"
    - from: "src/server/public/app.js (renderPanelContent)"
      to: "graphData.actions / graphData.milestones"
      via: "counting done vs total children for breakdown text"
      pattern: "wholeness.*section"
    - from: "src/server/public/app.js (renderStatusBar)"
      to: "graphData wholeness fields"
      via: "computing overall integrity percentage from node wholeness counts"
      pattern: "Integrity.*%"
---

<objective>
Apply integrity visualization to all node types in the dashboard. Every node card gets a wholeness-colored left border, the detail panel shows wholeness state with breakdown counts, and the status bar shows overall project integrity as a percentage.

Purpose: Makes the wholeness data (computed by M-31, wired into API by A-66/A-67) visually accessible so users can see at a glance where integrity is whole vs diminished.
Output: Updated dashboard files (src + dist copies) with wholeness visualization.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-32-integrity-visualization-in-the-dashboard/PLAN.md
@.planning/milestones/M-31-wholeness-state-computed-per-node/A-66-SUMMARY.md
@src/server/public/index.html
@src/server/public/app.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add wholeness CSS and update buildNodeEl + renderStatusBar</name>
  <files>src/server/public/index.html, src/server/public/app.js</files>
  <action>
**CSS changes in index.html** -- Add wholeness color variables to the `:root` block (after the existing `--renegotiated-*` variables around line 59):

```css
/* wholeness border indicators */
--wholeness-whole: #34d399;
--wholeness-partial: #fbbf24;
--wholeness-broken: #ff4d6d;
```

Add CSS rules for the wholeness left-border on node cards (after the `.node` base styles around line 204):

```css
/* Wholeness left-border indicator */
.node.wholeness-whole   { border-left: 3px solid var(--wholeness-whole); }
.node.wholeness-partial { border-left: 3px solid var(--wholeness-partial); }
.node.wholeness-broken  { border-left: 3px solid var(--wholeness-broken); }
```

Add CSS for the wholeness badge used in the detail panel (after `.detail-badge` styles around line 445):

```css
/* Wholeness badge in detail panel */
.wholeness-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.wholeness-badge.wb-whole   { background: #0a2018; color: var(--wholeness-whole); border: 1px solid #1a4d34; }
.wholeness-badge.wb-partial { background: #1a1200; color: var(--wholeness-partial); border: 1px solid #3d2c00; }
.wholeness-badge.wb-broken  { background: #2a0a10; color: var(--wholeness-broken); border: 1px solid #5a1520; }
```

**JS changes in app.js** -- In `buildNodeEl` (around line 272), add the wholeness class to the node element. After the line that sets `el.className`, add:

```js
// Wholeness left-border indicator
const wh = item.wholeness;
if (wh === 'whole' || wh === 'partial' || wh === 'broken') {
  el.classList.add(`wholeness-${wh}`);
}
```

In `renderStatusBar` (around line 186-201), replace the perfPill block that currently shows "Alignment: ... Integrity: ... Performance: ..." with a version that computes integrity from graphData wholeness counts. The new logic:

```js
// Compute project-wide integrity percentage from wholeness data
let perfPill = document.getElementById('perf-pill');
if (!perfPill) {
  perfPill = document.createElement('span');
  perfPill.id = 'perf-pill';
  perfPill.style.cssText = 'font-size:11px;color:var(--text-dim);';
  $healthBadge.after(perfPill);
}

// Count wholeness across all node types
const allNodes = [
  ...(graphData ? graphData.declarations || [] : []),
  ...(graphData ? graphData.milestones || [] : []),
  ...(graphData ? graphData.actions || [] : []),
];
const total = allNodes.length;
const wholeCount = allNodes.filter(n => n.wholeness === 'whole').length;
const integrityPct = total > 0 ? Math.round((wholeCount / total) * 100) : 0;

// Alignment from status rollup if available
const rollup = (statusData && statusData.performance && statusData.performance.rollup) || {};
const align = rollup.alignment ? rollup.alignment.level : null;
const perf  = rollup.performance || null;

let parts = [];
if (align) parts.push(`Alignment: ${align}`);
parts.push(`Integrity: ${integrityPct}%`);
if (perf) parts.push(`Performance: ${perf}`);
perfPill.textContent = parts.join('  \u00b7  ');
```

This replaces the existing `if (statusData && statusData.performance ...)` block entirely. The perfPill is now always created (because integrity comes from graphData, not just statusData), so move the perfPill creation outside the statusData conditional. Keep the perfPill after the healthBadge. The integrity percentage is computed from wholeness counts across all nodes, replacing the old `rollup.integrity.level` which showed "undefined".
  </action>
  <verify>
Open `src/server/public/index.html` and confirm CSS variables `--wholeness-whole`, `--wholeness-partial`, `--wholeness-broken` exist. Open `src/server/public/app.js` and confirm `buildNodeEl` adds `wholeness-*` class, and `renderStatusBar` computes `integrityPct` from node wholeness counts.
  </verify>
  <done>Node cards have wholeness-colored left borders. Status bar shows "Integrity: NN%" computed from actual wholeness data. No "undefined" shown.</done>
</task>

<task type="auto">
  <name>Task 2: Add wholeness section to detail panel + copy to dist</name>
  <files>src/server/public/app.js, dist/public/index.html, dist/public/app.js</files>
  <action>
**JS changes in app.js** -- In `renderPanelContent` (around line 514), add a wholeness section after the existing detail-badge div (after line 543 where the badge html is built). Insert a wholeness block that shows the wholeness state as a colored badge with breakdown:

After the `detail-badge` line in the html template, add logic to build a wholeness section:

```js
// Wholeness section
const wh = item.wholeness;
if (wh) {
  let breakdownHtml = '';

  if (type === 'milestone') {
    // Count done vs total actions for this milestone
    const mActions = (graphData.actions || []).filter(a =>
      (a.causes || []).some(c => c === item.id)
    );
    const doneActions = mActions.filter(a =>
      ['DONE','KEPT','HONORED'].includes(a.status)
    ).length;
    breakdownHtml = `<div class="detail-value" style="margin-top:6px">${doneActions}/${mActions.length} actions done</div>`;
  }

  if (type === 'declaration') {
    // Count done vs total milestones realizing this declaration
    const realizedBy = (graphData.milestones || []).filter(m =>
      (m.realizes || []).some(r => r === item.id)
    );
    const doneMilestones = realizedBy.filter(m =>
      ['DONE','KEPT','HONORED'].includes(m.status)
    ).length;
    breakdownHtml = `<div class="detail-value" style="margin-top:6px">${doneMilestones}/${realizedBy.length} milestones done</div>`;
  }

  html += `
    <div class="detail-section">
      <div class="detail-label">Wholeness</div>
      <span class="wholeness-badge wb-${wh}">${wh}</span>
      ${breakdownHtml}
    </div>`;
}
```

Place this block right after the `detail-badge` div is appended to `html` (after line 543) and before the type-specific fields section (before `if (type === 'declaration')` on line 547).

**Copy to dist** -- After both source files are edited, copy them to dist:

```
cp src/server/public/index.html dist/public/index.html
cp src/server/public/app.js dist/public/app.js
```
  </action>
  <verify>
Run: `node -e "const fs=require('fs'); const a=fs.readFileSync('src/server/public/app.js','utf8'); console.log(a.includes('wholeness-badge') && a.includes('actions done') && a.includes('milestones done') ? 'PASS' : 'FAIL');"` -- must print PASS.

Run: `diff src/server/public/app.js dist/public/app.js && diff src/server/public/index.html dist/public/index.html && echo SYNCED` -- must print SYNCED.
  </verify>
  <done>Detail panel shows wholeness badge (whole/partial/broken with color) plus breakdown counts for milestones and declarations. dist/public/ files are exact copies of src/server/public/ files.</done>
</task>

</tasks>

<verification>
1. Start the dashboard server: `node dist/declare-tools.cjs serve` (or use the source server)
2. Open http://localhost:3847 in browser
3. Verify node cards have thin colored left borders (green for whole, amber for partial, red for broken)
4. Click a milestone node -- detail panel should show "Wholeness" section with colored badge and "X/Y actions done"
5. Click a declaration node -- detail panel should show "Wholeness" section with colored badge and "X/Y milestones done"
6. Status bar should show "Integrity: NN%" (not "Integrity: undefined")
</verification>

<success_criteria>
- Every node card in the DAG view displays a 3px left border colored by wholeness state (green/amber/red)
- Detail panel for milestones shows wholeness badge + "N/M actions done" breakdown
- Detail panel for declarations shows wholeness badge + "N/M milestones done" breakdown
- Status bar shows "Integrity: NN%" computed from whole-node count across all node types
- dist/public/ files match src/server/public/ files exactly
</success_criteria>

<output>
After completion, create `.planning/milestones/M-32-integrity-visualization-in-the-dashboard/A-68-SUMMARY.md`
</output>
