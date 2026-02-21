---
milestone: M-32-integrity-visualization-in-the-dashboard
action: A-67
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/public/index.html
  - src/server/public/app.js
autonomous: true
declarations: ["D-10"]
must_haves:
  truths:
    - "Every node in the DAG shows a visual integrity indicator reflecting its wholeness state"
    - "Whole nodes display a green indicator, partial nodes amber, broken nodes red"
    - "Nodes with no children or PENDING status show no integrity indicator (neutral)"
    - "The integrity indicator is visually distinct from the status badge — it supplements, not replaces"
    - "The side panel shows the wholeness state for the selected node"
  artifacts:
    - path: "src/server/public/index.html"
      provides: "CSS variables for integrity colors and integrity-dot styling"
      contains: "--integrity-whole"
    - path: "src/server/public/app.js"
      provides: "buildNodeEl renders integrity dot; panel shows wholeness"
      contains: "integrity-dot"
  key_links:
    - from: "src/server/public/app.js"
      to: "wholeness field in API response"
      via: "item.wholeness read in buildNodeEl"
      pattern: "item\\.wholeness"
    - from: "src/server/public/index.html"
      to: "src/server/public/app.js"
      via: "CSS variables consumed by integrity-dot class"
      pattern: "--integrity-whole"
---

<objective>
Design and implement the integrity visual language for the Declare dashboard. Every node in the DAG will show a small colored integrity indicator (dot) that communicates its wholeness state at a glance: green for whole, amber for partial, red for broken, and no indicator for pending/not-yet-computable nodes.

Purpose: This is the first half of D-10 (Integrity as Architecture) visualization -- establishing the color system and applying it to node rendering so the user can see where the project is whole vs. where integrity is diminished.

Output: Updated index.html with integrity CSS variables + updated app.js with integrity dot rendering in buildNodeEl and wholeness display in the side panel.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/public/index.html
@src/server/public/app.js
@src/graph/engine.js
@src/commands/load-graph.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add integrity CSS variables and integrity-dot styles to index.html</name>
  <files>src/server/public/index.html</files>
  <action>
Add three new CSS custom properties inside the existing `:root` block, grouped after the existing `--broken-*` variables with a comment `/* integrity wholeness indicators */`:

```css
--integrity-whole: #34d399;
--integrity-whole-glow: rgba(52, 211, 153, 0.25);
--integrity-partial: #fbbf24;
--integrity-partial-glow: rgba(251, 191, 36, 0.25);
--integrity-broken: #ff4d6d;
--integrity-broken-glow: rgba(255, 77, 109, 0.25);
```

Then add a new CSS rule block for the integrity dot indicator, placed after the `.status-badge` rules (around line 364):

```css
/* Integrity wholeness dot */
.integrity-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: middle;
  position: relative;
  top: -0.5px;
}
.integrity-dot.integrity-whole {
  background: var(--integrity-whole);
  box-shadow: 0 0 6px var(--integrity-whole-glow);
}
.integrity-dot.integrity-partial {
  background: var(--integrity-partial);
  box-shadow: 0 0 6px var(--integrity-partial-glow);
}
.integrity-dot.integrity-broken {
  background: var(--integrity-broken);
  box-shadow: 0 0 6px var(--integrity-broken-glow);
}
```

Do NOT modify any existing CSS rules. Only add new variables and new rules.
  </action>
  <verify>Open src/server/public/index.html and confirm the CSS variables exist in :root and the .integrity-dot rules exist. No existing styles should be changed.</verify>
  <done>index.html contains --integrity-whole, --integrity-partial, --integrity-broken CSS variables and .integrity-dot CSS rules with the three state classes.</done>
</task>

<task type="auto">
  <name>Task 2: Render integrity dots in buildNodeEl and show wholeness in side panel</name>
  <files>src/server/public/app.js</files>
  <action>
Modify the `buildNodeEl` function to add an integrity dot next to the status badge. The wholeness field is already present in the API response data (set by load-graph.js from engine.js computeWholeness).

**Integrity dot logic inside buildNodeEl:**

After the existing `badgeLabel` computation (around line 296), add logic to compute the integrity dot HTML:

```javascript
// Integrity indicator — small colored dot next to status badge
// Skip for "broken" when node has no children (treat as pending/not-yet-computable)
let integrityDotHtml = '';
const wh = item.wholeness;
if (wh === 'whole' || wh === 'partial') {
  integrityDotHtml = `<span class="integrity-dot integrity-${wh}" title="Integrity: ${wh}"></span>`;
} else if (wh === 'broken') {
  // Only show broken dot if this node actually has children (not just "nothing to compute")
  // For milestones: check derived.totalCount > 0
  // For declarations: check if any milestones realize it (we can infer from context)
  // For actions: always show (actions are leaf nodes, broken = not completed)
  if (type === 'action') {
    integrityDotHtml = `<span class="integrity-dot integrity-broken" title="Integrity: broken"></span>`;
  } else if (type === 'milestone' && derived.totalCount > 0) {
    integrityDotHtml = `<span class="integrity-dot integrity-broken" title="Integrity: broken"></span>`;
  } else if (type === 'declaration') {
    // Declarations always come from graphData context; check if they have child milestones
    const hasChildren = graphData && (graphData.milestones || []).some(m => (m.realizes || []).includes(item.id));
    if (hasChildren) {
      integrityDotHtml = `<span class="integrity-dot integrity-broken" title="Integrity: broken"></span>`;
    }
  }
  // If none of the above matched, no dot shown (pending/not-computable)
}
```

Then modify the innerHTML template to append `integrityDotHtml` right after the status-badge span:

```javascript
el.innerHTML = `
  <div class="node-id">${item.id}</div>
  <div class="node-title">${truncate(title, 55)}</div>
  <span class="status-badge">${badgeLabel}</span>${integrityDotHtml}
  ${progressHtml}
`;
```

**Side panel wholeness display:**

In the `renderPanelChain` function, inside the focus-node card rendering (the `if (isFocus)` block, around line 733), add a wholeness section. After the existing type-specific detail sections (statement, milestones, actions, produces), add:

```javascript
// Wholeness indicator in panel
if (s.item.wholeness && s.item.wholeness !== 'pending') {
  const whColors = {
    whole: { color: 'var(--integrity-whole)', label: 'Whole' },
    partial: { color: 'var(--integrity-partial)', label: 'Partial' },
    broken: { color: 'var(--integrity-broken)', label: 'Broken' },
  };
  const wc = whColors[s.item.wholeness] || whColors.broken;
  html += `<div style="margin-top:14px">
    <div class="detail-label">Integrity</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${wc.color};display:inline-block"></span>
      <span style="font-size:12px;color:${wc.color};font-weight:600">${wc.label}</span>
    </div>
  </div>`;
}
```

Place this wholeness section BEFORE the exec-plan placeholder div (the `exec-plan-detail` section) so it appears in the natural flow of node details.

IMPORTANT: The `item.wholeness` field already exists in the API response -- load-graph.js computes it via engine.js `computeWholeness()` and attaches it to every node. No backend changes needed.
  </action>
  <verify>
1. Run `node /Users/guilherme/Projects/declare-cc/dist/declare-tools.cjs serve` and open the dashboard in a browser.
2. Verify nodes show colored dots: green for completed subtrees, amber for partially complete, red for broken (with children), no dot for pending nodes with no children.
3. Click a node and verify the side panel shows "Integrity: Whole/Partial/Broken" with the matching color dot.
4. Alternatively, grep app.js for "integrity-dot" and "integrity-whole" to confirm the code was added.
  </verify>
  <done>
- buildNodeEl renders an integrity dot (colored circle) next to the status badge for every node with a meaningful wholeness state
- Nodes with no children show no dot (neutral/pending treatment)
- The side panel chain view shows the wholeness state with a colored dot and label for the focused node
- All three states (whole=green, partial=amber, broken=red) are visually distinct
  </done>
</task>

</tasks>

<verification>
1. `grep -c "integrity-dot" src/server/public/app.js` returns at least 3 (the class references)
2. `grep -c "integrity-whole" src/server/public/index.html` returns at least 2 (CSS variable + class rule)
3. `grep -c "integrity-partial" src/server/public/index.html` returns at least 2
4. `grep -c "integrity-broken" src/server/public/index.html` returns at least 2
5. `grep "item.wholeness" src/server/public/app.js` confirms the wholeness field is read from node data
6. No changes to src/graph/engine.js or src/commands/load-graph.js (wholeness data already flows correctly)
</verification>

<success_criteria>
- Dashboard nodes display a small colored integrity dot (green/amber/red) next to their status badge
- The dot color corresponds to the node's computed wholeness: whole=green, partial=amber, broken=red
- Nodes with no children (milestones with 0 actions, declarations with 0 milestones) show NO dot
- The side panel shows an "Integrity" section with the wholeness state and matching color
- No regressions: existing status badges, progress bars, focus mode, and edge drawing work as before
- CSS variables --integrity-whole, --integrity-partial, --integrity-broken are defined for reuse by A-68
</success_criteria>

<output>
After completion, create `.planning/milestones/M-32-integrity-visualization-in-the-dashboard/A-67-SUMMARY.md`
</output>
