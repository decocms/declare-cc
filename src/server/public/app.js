/**
 * Declare DAG Visualizer — app.js
 *
 * Fetches /api/graph and /api/status, renders a layered DAG with SVG edges,
 * supports node click for full details in a side panel, and live-updates via SSE when .planning/ changes.
 *
 * Zero external dependencies. Vanilla JS, no build step.
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const API_GRAPH        = '/api/graph';
const API_STATUS       = '/api/status';

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {{ declarations: any[], milestones: any[], actions: any[], stats: any } | null} */
let graphData = null;

/** @type {any} */
let statusData = null;

/** @type {string | null} */
let selectedNodeId = null;

/** @type {string | null} Focus node ID — the declaration or milestone being focused */
let focusNodeId = null;


// ─── DOM refs ─────────────────────────────────────────────────────────────────

const $overlay       = document.getElementById('overlay');
const $overlayMsg    = document.getElementById('overlay-message');
const $overlayErr    = document.getElementById('overlay-error');
const $overlayRetry  = document.getElementById('overlay-retry');
const $spinner       = document.querySelector('.spinner');

const $projectName   = document.getElementById('project-name');
const $statDecls     = document.getElementById('stat-decls');
const $statMiles     = document.getElementById('stat-miles');
const $statActs      = document.getElementById('stat-acts');
const $healthBadge   = document.getElementById('health-badge');
const $lastUpdated   = document.getElementById('last-updated');
const $refreshBtn    = document.getElementById('refresh-btn');

const $nodesDecls    = document.getElementById('nodes-declarations');
const $nodesMiles    = document.getElementById('nodes-milestones');
const $nodesActs     = document.getElementById('nodes-actions');
const $edgesSvg      = document.getElementById('edges-svg');

const $sidePanel     = document.getElementById('side-panel');
const $panelBody     = document.getElementById('panel-body');
const $panelEmpty    = document.getElementById('panel-empty');

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Truncate text to maxLen characters, appending ellipsis if needed.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

/**
 * Format a Date as "HH:MM:SS".
 * @param {Date} d
 * @returns {string}
 */
function fmtTime(d) {
  return d.toTimeString().slice(0, 8);
}

/**
 * Derive a CSS class suffix for a status string.
 * @param {string} status
 * @returns {string}
 */
function statusClass(status) {
  if (!status) return 'pending';
  return status.toLowerCase().replace(/[^a-z]/g, '-');
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Fetch JSON from a URL, returning null on network/parse errors.
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────

function showLoading() {
  $overlayMsg.textContent  = 'Loading graph…';
  $overlayErr.textContent  = '';
  $overlayRetry.style.display = 'none';
  $spinner.style.display   = 'block';
  $overlay.classList.remove('hidden');
}

function showError(msg) {
  $overlayMsg.textContent  = '';
  $overlayErr.textContent  = msg;
  $overlayRetry.style.display = 'inline-block';
  $spinner.style.display   = 'none';
  $overlay.classList.remove('hidden');
}

function hideOverlay() {
  $overlay.classList.add('hidden');
}

// ─── Data loading ─────────────────────────────────────────────────────────────

/**
 * Load /api/graph and /api/status in parallel.
 * On success: hide overlay, render.
 * On failure: show error overlay.
 */
async function loadData() {
  try {
    const [graph, status] = await Promise.all([
      fetchJson(API_GRAPH),
      fetchJson(API_STATUS).catch(() => null), // status is supplementary
    ]);

    if (graph && graph.error) {
      throw new Error(graph.error);
    }

    graphData  = graph;
    statusData = status;

    hideOverlay();
    renderStatusBar();
    renderGraph();
    updateLastUpdated();
    checkProjectComplete(graph);

    // Re-apply selection highlight if node still exists
    if (selectedNodeId) {
      const el = document.querySelector(`[data-node-id="${selectedNodeId}"]`);
      if (el) el.classList.add('selected');
    }
  } catch (err) {
    showError(
      `Could not reach the Declare server.\n${err.message}\n\nMake sure the server is running:\n  node dist/declare-tools.cjs serve`
    );
  }
}

function updateLastUpdated() {
  $lastUpdated.textContent = `Last updated: ${fmtTime(new Date())}`;
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function renderStatusBar() {
  // Project name from status or graph stats
  const project = statusData ? statusData.project : null;
  if (project) $projectName.textContent = project;

  // Counts
  const stats = (graphData && graphData.stats) || {};
  $statDecls.textContent = stats.declarations != null ? stats.declarations : '–';
  $statMiles.textContent = stats.milestones   != null ? stats.milestones   : '–';
  $statActs.textContent  = stats.actions      != null ? stats.actions      : '–';

  // Health badge
  const health = statusData ? statusData.health : null;
  const healthLabel = health || 'unknown';
  $healthBadge.textContent = healthLabel;
  $healthBadge.className   = `health-badge health-${healthLabel}`;

  // Performance summary from /api/status
  if (statusData && statusData.performance && statusData.performance.rollup) {
    const rollup = statusData.performance.rollup;
    // Inject a performance pill next to health if not already present
    let perfPill = document.getElementById('perf-pill');
    if (!perfPill) {
      perfPill = document.createElement('span');
      perfPill.id = 'perf-pill';
      perfPill.style.cssText = 'font-size:11px;color:var(--text-dim);';
      $healthBadge.after(perfPill);
    }
    const align = rollup.alignment   ? rollup.alignment.level   : '–';
    const integ = rollup.integrity   ? rollup.integrity.level   : '–';
    const perf  = rollup.performance || '–';
    perfPill.textContent = `Alignment: ${align}  ·  Integrity: ${integ}  ·  Performance: ${perf}`;
  }
}

// ─── Node element builder ─────────────────────────────────────────────────────

/**
 * Build a node DOM element.
 * @param {{ id: string, title?: string, statement?: string, status?: string }} item
 * @param {'declaration'|'milestone'|'action'} type
 * @returns {HTMLElement}
 */
function buildNodeEl(item, type) {
  const el = document.createElement('div');
  el.className = `node node-${type} status-${statusClass(item.status || 'pending')}`;
  el.dataset.nodeId = item.id;
  el.dataset.nodeType = type;

  const title = item.title || item.statement || item.id;

  el.innerHTML = `
    <div class="node-id">${item.id}</div>
    <div class="node-title">${truncate(title, 55)}</div>
    <span class="status-badge">${item.status || 'PENDING'}</span>
  `;

  el.addEventListener('click', () => selectNode(item.id, type));
  return el;
}

// ─── Graph renderer ───────────────────────────────────────────────────────────

function renderGraph() {
  if (!graphData) return;

  const { declarations, milestones, actions } = graphData;

  // Clear containers
  $nodesDecls.innerHTML = '';
  $nodesMiles.innerHTML = '';
  $nodesActs.innerHTML  = '';

  // Render declarations
  (declarations || []).forEach(d => {
    $nodesDecls.appendChild(buildNodeEl(d, 'declaration'));
  });

  // Render milestones
  (milestones || []).forEach(m => {
    $nodesMiles.appendChild(buildNodeEl(m, 'milestone'));
  });

  // Render actions
  (actions || []).forEach(a => {
    $nodesActs.appendChild(buildNodeEl(a, 'action'));
  });

  // Draw edges after layout settles
  requestAnimationFrame(() => drawEdges());
}

// ─── Edge drawing ─────────────────────────────────────────────────────────────

/**
 * Get the center-bottom point of a DOM element relative to #canvas-container.
 * @param {Element} el
 * @returns {{ x: number, y: number }}
 */
function getBottomCenter(el) {
  const containerRect = document.getElementById('canvas-container').getBoundingClientRect();
  const scrollLeft = document.getElementById('canvas-wrap').scrollLeft;
  const scrollTop  = document.getElementById('canvas-wrap').scrollTop;
  const r = el.getBoundingClientRect();
  return {
    x: r.left - containerRect.left + scrollLeft + r.width / 2,
    y: r.top  - containerRect.top  + scrollTop  + r.height,
  };
}

/**
 * Get the center-top point of a DOM element relative to #canvas-container.
 * @param {Element} el
 * @returns {{ x: number, y: number }}
 */
function getTopCenter(el) {
  const containerRect = document.getElementById('canvas-container').getBoundingClientRect();
  const scrollLeft = document.getElementById('canvas-wrap').scrollLeft;
  const scrollTop  = document.getElementById('canvas-wrap').scrollTop;
  const r = el.getBoundingClientRect();
  return {
    x: r.left - containerRect.left + scrollLeft + r.width / 2,
    y: r.top  - containerRect.top  + scrollTop,
  };
}

/**
 * Draw a cubic bezier SVG path from (x1,y1) to (x2,y2).
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {string}
 */
function curvePath(x1, y1, x2, y2) {
  const cy = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`;
}

/**
 * Build an SVG path element for an edge.
 * @param {string} d
 * @param {boolean} highlight
 * @returns {SVGPathElement}
 */
function makePath(d, highlight) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', highlight ? 'edge highlight' : 'edge');
  return path;
}

function drawEdges() {
  if (!graphData) return;

  const { milestones, actions } = graphData;
  const container = document.getElementById('canvas-container');

  // Resize SVG to container dimensions
  $edgesSvg.setAttribute('width',  String(container.scrollWidth));
  $edgesSvg.setAttribute('height', String(container.scrollHeight));
  $edgesSvg.innerHTML = '';

  const fragment = document.createDocumentFragment();

  // Milestone → Declaration edges (realizes)
  (milestones || []).forEach(m => {
    const mEl = document.querySelector(`[data-node-id="${m.id}"]`);
    if (!mEl) return;
    const mTop = getTopCenter(mEl);

    (m.realizes || []).forEach(dId => {
      const dEl = document.querySelector(`[data-node-id="${dId}"]`);
      if (!dEl) return;
      const dBot = getBottomCenter(dEl);
      const isHighlighted = selectedNodeId === m.id || selectedNodeId === dId;
      fragment.appendChild(makePath(curvePath(dBot.x, dBot.y, mTop.x, mTop.y), isHighlighted));
    });
  });

  // Action → Milestone edges (causes)
  (actions || []).forEach(a => {
    const aEl = document.querySelector(`[data-node-id="${a.id}"]`);
    if (!aEl) return;
    const aTop = getTopCenter(aEl);

    (a.causes || []).forEach(mId => {
      const mEl = document.querySelector(`[data-node-id="${mId}"]`);
      if (!mEl) return;
      const mBot = getBottomCenter(mEl);
      const isHighlighted = selectedNodeId === a.id || selectedNodeId === mId;
      fragment.appendChild(makePath(curvePath(mBot.x, mBot.y, aTop.x, aTop.y), isHighlighted));
    });
  });

  $edgesSvg.appendChild(fragment);
}

// ─── Side panel ───────────────────────────────────────────────────────────────

/**
 * Select a node and show its details.
 * @param {string} nodeId
 * @param {string} type
 */
function selectNode(nodeId, type) {
  // Deselect previous
  document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));

  if (selectedNodeId === nodeId) {
    // Toggle off
    selectedNodeId = null;
    exitFocusMode();
    if ($panelEmpty) $panelEmpty.style.display = '';
    return;
  }

  selectedNodeId = nodeId;

  // Highlight node
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (el) el.classList.add('selected');

  // If clicking a node already visible in the current focused subtree, skip re-animation
  const alreadyInFocus = focusNodeId && getFocusSubtree(
    focusNodeId,
    document.querySelector(`[data-node-id="${focusNodeId}"]`)?.dataset.nodeType || 'declaration'
  ).has(nodeId);

  if (!alreadyInFocus) {
    enterFocusMode(nodeId, type);
  }

  // Populate panel
  let item = null;
  if (graphData) {
    if (type === 'declaration') item = graphData.declarations.find(d => d.id === nodeId);
    if (type === 'milestone')   item = graphData.milestones.find(m => m.id === nodeId);
    if (type === 'action')      item = graphData.actions.find(a => a.id === nodeId);
  }
  if (!item) return;

  if ($panelEmpty) $panelEmpty.style.display = 'none';
  renderPanelChain(item, type);
}

/**
 * Render the detail panel for a selected node.
 * @param {any} item
 * @param {string} type
 */
function renderPanelContent(item, type) {
  const status = item.status || 'PENDING';

  // Color for badge
  const colorMap = {
    declaration: 'var(--decl-color)',
    milestone:   'var(--mile-color)',
    action:      'var(--act-color)',
  };
  const bgMap = {
    declaration: 'var(--decl-bg)',
    milestone:   'var(--mile-bg)',
    action:      'var(--act-bg)',
  };

  let badgeStyle = `background:${bgMap[type]};color:${colorMap[type]};border:1px solid;`;
  if (['DONE', 'HONORED', 'KEPT'].includes(status)) {
    badgeStyle = 'background:var(--done-bg);color:var(--done-color);border:1px solid var(--done-border);';
  } else if (status === 'BROKEN') {
    badgeStyle = 'background:var(--broken-bg);color:var(--broken-color);border:1px solid var(--broken-border);';
  } else if (status === 'RENEGOTIATED') {
    badgeStyle = 'background:var(--renegotiated-bg);color:var(--renegotiated-color);border:1px solid var(--renegotiated-border);';
  }

  const title = item.title || item.statement || item.id;

  let html = `
    <div class="detail-id">${type.toUpperCase()} · ${item.id}</div>
    <div class="detail-title">${escHtml(title)}</div>
    <div class="detail-badge" style="${badgeStyle}">${status}</div>
  `;

  // Type-specific fields
  if (type === 'declaration') {
    if (item.statement) {
      html += section('Statement', escHtml(item.statement));
    }
    if (item.integrity) {
      html += section('Integrity', escHtml(String(item.integrity)));
    }
    // Realized by
    const realizedBy = (graphData.milestones || []).filter(m =>
      (m.realizes || []).some(r => r === item.id)
    );
    if (realizedBy.length) {
      html += tagSection('Realized by', realizedBy, 'milestone');
    }
  }

  if (type === 'milestone') {
    if (item.produces) {
      html += section('Produces', escHtml(item.produces));
    }
    if (item.realizes && item.realizes.length) {
      const decls = (graphData.declarations || []).filter(d => item.realizes.includes(d.id));
      html += tagSection('Realizes', decls.length ? decls : item.realizes.map(id => ({ id })), 'declaration');
    }
    // Actions that cause this milestone
    const causedBy = (graphData.actions || []).filter(a =>
      (a.causes || []).some(c => c === item.id)
    );
    if (causedBy.length) {
      html += tagSection('Caused by actions', causedBy, 'action');
    }
    if (item.integrity) {
      html += section('Integrity', escHtml(String(item.integrity)));
    }
  }

  if (type === 'action') {
    if (item.produces) {
      html += section('Produces', escHtml(item.produces));
    }
    if (item.causes && item.causes.length) {
      const miles = (graphData.milestones || []).filter(m => item.causes.includes(m.id));
      html += tagSection('Causes milestones', miles.length ? miles : item.causes.map(id => ({ id })), 'milestone');
    }
    if (item.integrity) {
      html += section('Integrity', escHtml(String(item.integrity)));
    }
    if (item.wave != null) {
      html += section('Wave', escHtml(String(item.wave)));
    }
  }

  $panelBody.innerHTML = html;

  // Wire tag clicks to jump to that node
  $panelBody.querySelectorAll('.detail-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const tid  = tag.dataset.nodeId;
      const ttype = tag.dataset.nodeType;
      if (tid && ttype) selectNode(tid, ttype);
    });
  });
}

/**
 * Build a detail section with label and text value.
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function section(label, value) {
  return `
    <div class="detail-section">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${value}</div>
    </div>
  `;
}

/**
 * Build a tag list section for linked nodes.
 * @param {string} label
 * @param {Array<{id: string, title?: string, statement?: string}>} items
 * @param {string} type
 * @returns {string}
 */
function tagSection(label, items, type) {
  if (!items.length) return '';
  const tags = items.map(item => {
    const name = item.title || item.statement || item.id;
    return `<span class="detail-tag" data-node-id="${item.id}" data-node-type="${type}">${item.id}: ${truncate(name, 30)}</span>`;
  }).join('');
  return `
    <div class="detail-section">
      <div class="detail-label">${label}</div>
      <div class="detail-tag-list">${tags}</div>
    </div>
  `;
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Chain panel renderer ─────────────────────────────────────────────────────

/**
 * Render the sidebar with the full chain from declarations down to the clicked node.
 * Clicking a milestone shows: parent declaration(s) → the milestone.
 * Clicking an action shows: declaration(s) → parent milestone(s) → the action.
 */
function renderPanelChain(item, type) {
  if (!graphData) return;
  const { declarations, milestones, actions } = graphData;
  const sections = [];

  if (type === 'action') {
    // Parent milestones
    const parentMilestones = milestones.filter(m => (item.causes || []).includes(m.id));
    parentMilestones.forEach(m => {
      // Parent declarations of the milestone
      const parentDecls = declarations.filter(d => (m.realizes || []).includes(d.id));
      parentDecls.forEach(d => sections.push({ item: d, type: 'declaration', role: 'context' }));
      sections.push({ item: m, type: 'milestone', role: 'context' });
    });
    sections.push({ item, type: 'action', role: 'focus' });
  } else if (type === 'milestone') {
    const parentDecls = declarations.filter(d => (item.realizes || []).includes(d.id));
    parentDecls.forEach(d => sections.push({ item: d, type: 'declaration', role: 'context' }));
    sections.push({ item, type: 'milestone', role: 'focus' });
  } else {
    sections.push({ item, type: 'declaration', role: 'focus' });
  }

  const colorMap = { declaration: 'var(--decl-color)', milestone: 'var(--mile-color)', action: 'var(--act-color)' };
  const bgMap = { declaration: 'var(--decl-bg)', milestone: 'var(--mile-bg)', action: 'var(--act-bg)' };
  const borderMap = { declaration: 'var(--decl-border)', milestone: 'var(--mile-border)', action: 'var(--act-border)' };

  let html = '';
  sections.forEach((s, idx) => {
    const isFocus = s.role === 'focus';
    const title = s.item.title || s.item.statement || s.item.id;
    const status = s.item.status || 'PENDING';
    const isDone = ['DONE','KEPT','HONORED'].includes(status);
    const isBroken = status === 'BROKEN';

    const cardBg = isFocus ? bgMap[s.type] : 'var(--surface2)';
    const cardBorder = isFocus ? borderMap[s.type] : 'var(--border)';
    const cardOpacity = isFocus ? '1' : '0.7';

    const badgeStyle = isDone
      ? 'background:var(--done-bg);color:var(--done-color);border:1px solid var(--done-border)'
      : isBroken
        ? 'background:var(--broken-bg);color:var(--broken-color);border:1px solid var(--broken-border)'
        : `background:${bgMap[s.type]};color:${colorMap[s.type]};border:1px solid ${borderMap[s.type]}`;

    // Connector line between sections
    if (idx > 0) {
      html += `<div style="display:flex;justify-content:center;margin:2px 0">
        <div style="width:1px;height:20px;background:var(--border)"></div>
      </div>`;
    }

    html += `<div style="
      background:${cardBg};
      border:1px solid ${cardBorder};
      border-radius:8px;
      padding:12px 14px;
      opacity:${cardOpacity};
      cursor:${isFocus ? 'default' : 'pointer'};
    " ${!isFocus ? `onclick="selectNode('${s.item.id}','${s.type}')"` : ''}>
      <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;opacity:0.6;margin-bottom:3px;color:${colorMap[s.type]}">${s.type.toUpperCase()} · ${s.item.id}</div>
      <div style="font-size:13px;font-weight:${isFocus ? '600' : '500'};color:var(--text-bright);line-height:1.35;margin-bottom:8px">${escHtml(title)}</div>
      <span style="${badgeStyle};display:inline-block;padding:2px 9px;border-radius:8px;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">${status}</span>
    </div>`;

    // If this is the focus node, show its type-specific details below
    if (isFocus) {
      if (s.type === 'declaration' && s.item.statement) {
        html += `<div style="margin-top:14px">
          <div class="detail-label">Statement</div>
          <div class="detail-value" style="margin-top:5px">${escHtml(s.item.statement)}</div>
        </div>`;
        const realizedBy = milestones.filter(m => (m.realizes || []).includes(s.item.id));
        if (realizedBy.length) {
          html += chainTagSection('Milestones', realizedBy, 'milestone');
        }
      }
      if (s.type === 'milestone') {
        const causedBy = actions.filter(a => (a.causes || []).includes(s.item.id));
        if (causedBy.length) html += chainTagSection('Actions', causedBy, 'action');
      }
      if (s.type === 'action') {
        if (s.item.produces) {
          html += `<div style="margin-top:14px">
            <div class="detail-label">Produces</div>
            <div class="detail-value" style="margin-top:5px">${escHtml(s.item.produces)}</div>
          </div>`;
        }
        // Exec-plan placeholder — filled asynchronously after render
        html += `<div id="exec-plan-detail" style="margin-top:16px">
          <div class="detail-label" style="opacity:0.4">Loading exec-plan…</div>
        </div>`;
      }
    }
  });

  $panelBody.innerHTML = html;

  // Wire tag clicks
  $panelBody.querySelectorAll('[data-chain-id]').forEach(tag => {
    tag.addEventListener('click', () => {
      selectNode(tag.dataset.chainId, tag.dataset.chainType);
    });
  });

  // If an action is focused, fetch and render its exec-plan
  const focusSection = sections.find(s => s.role === 'focus');
  if (focusSection && focusSection.type === 'action') {
    loadExecPlan(focusSection.item.id);
  }
}

function chainTagSection(label, items, type) {
  const tags = items.map(item => {
    const name = item.title || item.id;
    return `<span class="detail-tag" data-chain-id="${item.id}" data-chain-type="${type}" style="cursor:pointer">${item.id}: ${truncate(name, 28)}</span>`;
  }).join('');
  return `<div style="margin-top:14px">
    <div class="detail-label">${label}</div>
    <div class="detail-tag-list" style="margin-top:6px">${tags}</div>
  </div>`;
}

/**
 * Fetch /api/action/:id and render the exec-plan into #exec-plan-detail.
 * @param {string} actionId
 */
async function loadExecPlan(actionId) {
  const container = document.getElementById('exec-plan-detail');
  if (!container) return;

  try {
    const res = await fetch(`/api/action/${encodeURIComponent(actionId)}`);
    const data = await res.json();

    if (data.error || !data.execPlan) {
      container.innerHTML = `<div class="detail-label" style="opacity:0.4">No exec-plan found</div>`;
      return;
    }

    const ep = data.execPlan;
    let html = '';

    // Execution metadata bar
    const metaParts = [];
    if (ep.wave != null) metaParts.push(`Wave ${ep.wave}`);
    if (ep.autonomous != null) metaParts.push(ep.autonomous ? '⚡ Autonomous' : '🧑 Checkpoint');
    if (ep.dependsOn && ep.dependsOn.length) metaParts.push(`Depends: ${ep.dependsOn.join(', ')}`);
    if (data.summaryExists) metaParts.push('✓ Executed');

    if (metaParts.length) {
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        ${metaParts.map(p => `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;color:var(--text-dim)">${p}</span>`).join('')}
      </div>`;
    }

    // Files modified
    if (ep.filesModified && ep.filesModified.length) {
      html += `<div style="margin-bottom:14px">
        <div class="detail-label">Files</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
          ${ep.filesModified.map(f => `<span style="background:var(--act-bg);border:1px solid var(--act-border);color:var(--act-color);border-radius:4px;padding:2px 7px;font-size:10px;font-family:monospace">${escHtml(f)}</span>`).join('')}
        </div>
      </div>`;
    }

    // Objective
    if (ep.objective) {
      html += `<div style="margin-bottom:14px">
        <div class="detail-label">Objective</div>
        <div class="detail-value" style="margin-top:5px;white-space:pre-wrap">${escHtml(ep.objective)}</div>
      </div>`;
    }

    // Tasks
    if (ep.tasks && ep.tasks.length) {
      html += `<div style="margin-bottom:14px">
        <div class="detail-label">Tasks (${ep.tasks.length})</div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
          ${ep.tasks.map((t, i) => {
            const isCheckpoint = t.type && t.type.includes('checkpoint');
            const typeColor = isCheckpoint ? 'var(--renegotiated-color)' : 'var(--act-color)';
            const typeBg = isCheckpoint ? 'var(--renegotiated-bg)' : 'var(--act-bg)';
            const typeBorder = isCheckpoint ? 'var(--renegotiated-border)' : 'var(--act-border)';
            const taskText = t.action || t.whatBuilt || '';
            const verifyText = t.howToVerify || t.verify || '';
            return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 12px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="font-size:10px;font-weight:700;color:var(--text-dim)">${i + 1}</span>
                <span style="font-weight:600;font-size:12px;color:var(--text-bright);flex:1">${escHtml(t.name)}</span>
                <span style="background:${typeBg};color:${typeColor};border:1px solid ${typeBorder};border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;white-space:nowrap">${escHtml(t.type)}</span>
              </div>
              ${taskText ? `<div style="font-size:11px;color:var(--text-dim);white-space:pre-wrap;margin-bottom:6px">${escHtml(taskText.slice(0, 300))}${taskText.length > 300 ? '…' : ''}</div>` : ''}
              ${verifyText ? `<div style="font-size:10px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:4px;white-space:pre-wrap"><span style="font-weight:700">Verify:</span> ${escHtml(verifyText.slice(0, 200))}${verifyText.length > 200 ? '…' : ''}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    // Must-haves
    if (ep.mustHaves) {
      if (ep.mustHaves.truths && ep.mustHaves.truths.length) {
        html += `<div style="margin-bottom:14px">
          <div class="detail-label">Must be true</div>
          <ul style="margin-top:6px;padding-left:16px;display:flex;flex-direction:column;gap:3px">
            ${ep.mustHaves.truths.map(t => `<li style="font-size:11px;color:var(--text-dim)">${escHtml(t)}</li>`).join('')}
          </ul>
        </div>`;
      }
      if (ep.mustHaves.artifacts && ep.mustHaves.artifacts.length) {
        html += `<div style="margin-bottom:14px">
          <div class="detail-label">Artifacts</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">
            ${ep.mustHaves.artifacts.map(a => `<div style="font-size:11px;color:var(--text-dim)">
              <span style="font-family:monospace;color:var(--act-color)">${escHtml(a.path || '')}</span>
              ${a.provides ? ` — ${escHtml(a.provides)}` : ''}
            </div>`).join('')}
          </div>
        </div>`;
      }
    }

    // Success criteria
    if (ep.successCriteria) {
      html += `<div style="margin-bottom:8px">
        <div class="detail-label">Success criteria</div>
        <div class="detail-value" style="margin-top:5px;white-space:pre-wrap">${escHtml(ep.successCriteria)}</div>
      </div>`;
    }

    container.innerHTML = html || `<div class="detail-label" style="opacity:0.4">No exec-plan details</div>`;

  } catch (e) {
    if (container) container.innerHTML = `<div class="detail-label" style="opacity:0.4">Could not load exec-plan</div>`;
  }
}

// ─── Focus mode — FLIP technique ──────────────────────────────────────────────
// Exiting nodes: removed from flow instantly (→ flex re-centers), then overlaid
// at their original positions via position:fixed for the directional slide-out.
// Subtree nodes: FLIP'd from old positions to new centered positions simultaneously.

const $focusHint = document.getElementById('focus-hint');
const FOCUS_DUR = 380;

/**
 * Compute the set of node IDs that belong to a focused subtree.
 * - declaration: itself + all its milestones + all their actions
 * - milestone:   itself + its declarations + its actions
 * - action:      itself + its parent milestone + that milestone's declaration + all sibling actions
 * @param {string} nodeId
 * @param {string} type
 * @returns {Set<string>}
 */
function getFocusSubtree(nodeId, type) {
  if (!graphData) return new Set();
  const { milestones, actions } = graphData;
  const visible = new Set();

  if (type === 'declaration') {
    visible.add(nodeId);
    milestones.filter(m => (m.realizes || []).includes(nodeId)).forEach(m => {
      visible.add(m.id);
      actions.filter(a => (a.causes || []).includes(m.id)).forEach(a => visible.add(a.id));
    });
  } else if (type === 'milestone') {
    visible.add(nodeId);
    const m = milestones.find(x => x.id === nodeId);
    if (m) {
      (m.realizes || []).forEach(dId => visible.add(dId));
      actions.filter(a => (a.causes || []).includes(nodeId)).forEach(a => visible.add(a.id));
    }
  } else if (type === 'action') {
    visible.add(nodeId);
    const a = actions.find(x => x.id === nodeId);
    if (a) {
      (a.causes || []).forEach(mId => {
        visible.add(mId);
        const m = milestones.find(x => x.id === mId);
        if (m) {
          // parent declarations
          (m.realizes || []).forEach(dId => visible.add(dId));
          // sibling actions (all actions that cause the same milestone)
          actions.filter(sa => (sa.causes || []).includes(mId)).forEach(sa => visible.add(sa.id));
        }
      });
    }
  }

  return visible;
}

/** Clear all focus-mode inline styles from a node element. */
function clearNodeFocusStyles(el) {
  el.style.cssText = ''; // wipe all inline styles at once
  el.classList.remove('focus-exiting', 'focus-active');
  el.dataset.focusDir = '';
}

/** @type {Array<{el: HTMLElement, rect: DOMRect, dirLeft: boolean}>} */
let exitedNodes = [];
/** @type {ReturnType<typeof setTimeout> | null} Shared cleanup timer — covers both enter and exit cleanups so each cancels the other */
let focusCleanupTimer = null;

/**
 * Snapshot getBoundingClientRect for a set of node IDs.
 * @param {Set<string>} ids
 * @returns {Map<string, DOMRect>}
 */
function snapshotRects(ids) {
  const map = new Map();
  ids.forEach(id => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    if (el) map.set(id, el.getBoundingClientRect());
  });
  return map;
}

/**
 * Enter focus mode using FLIP:
 * 1. Snapshot subtree node positions (FIRST)
 * 2. Remove exiting nodes from flow + overlay them fixed at their original positions
 * 3. Flex re-centers remaining nodes instantly
 * 4. Snapshot new subtree positions (LAST)
 * 5. INVERT: push subtree nodes back to original positions via transform (no transition)
 * 6. PLAY: animate subtree to new center + animate fixed-overlay exits to slide out
 */
function enterFocusMode(nodeId, type) {
  if (!graphData) return;
  // Always cancel any pending cleanup (enter or exit) before starting a new animation
  if (focusCleanupTimer) { clearTimeout(focusCleanupTimer); focusCleanupTimer = null; }
  if (focusNodeId) {
    // Restore everything cleanly before re-entering
    exitedNodes.forEach(({ el }) => {
      el.style.cssText = '';
      el.classList.remove('focus-exiting', 'focus-active');
    });
    document.querySelectorAll('.node.focus-active').forEach(el => el.classList.remove('focus-active'));
    exitedNodes = [];
  }

  focusNodeId = nodeId;
  const subtree = getFocusSubtree(nodeId, type);

  // Determine focus center X for directional exits
  const focusEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!focusEl) return;
  const focusCenterX = focusEl.getBoundingClientRect().left + focusEl.getBoundingClientRect().width / 2;

  // Classify all nodes
  const subtreeEls = new Map(); // id → el
  exitedNodes = [];
  document.querySelectorAll('.node').forEach(el => {
    const id = el.dataset.nodeId;
    if (!id) return;
    el.style.cssText = '';
    el.classList.remove('focus-exiting', 'focus-active');
    if (subtree.has(id)) {
      el.classList.add('focus-active');
      subtreeEls.set(id, el);
    } else {
      const rect = el.getBoundingClientRect();
      exitedNodes.push({ el, rect, dirLeft: (rect.left + rect.width / 2) < focusCenterX });
    }
  });

  // FIRST: snapshot subtree positions before layout change
  const firstRects = snapshotRects(subtree);

  // Remove exiting nodes from flow (instantly invisible — opacity handled separately)
  // Pin them fixed at their current viewport positions for the slide-out overlay
  exitedNodes.forEach(({ el, rect, dirLeft }) => {
    el.dataset.focusDir = dirLeft ? 'left' : 'right';
    el.classList.add('focus-exiting');
    el.style.position = 'fixed';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.margin = '0';
    el.style.zIndex = '15';
    el.style.pointerEvents = 'none';
    el.style.opacity = '1';
    el.style.transform = 'none';
  });

  // Force reflow: flex now sees only subtree nodes → re-centers them
  void document.body.offsetWidth;

  // LAST: snapshot new positions
  const lastRects = snapshotRects(subtree);

  // INVERT: push subtree nodes to appear at their old positions (no transition)
  subtreeEls.forEach((el, id) => {
    const first = firstRects.get(id);
    const last = lastRects.get(id);
    if (!first || !last) return;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  });

  // Force reflow so invert transforms are painted before we play
  void document.body.offsetWidth;

  const dur = FOCUS_DUR + 'ms';
  const easeIn = 'cubic-bezier(0,0,0.2,1)';
  const easeOut = 'cubic-bezier(0.4,0,1,1)';

  // PLAY: animate subtree nodes to their new centered positions
  subtreeEls.forEach(el => {
    el.style.transition = `transform ${dur} ${easeIn}`;
    el.style.transform = '';
  });

  // Clear edges immediately (no transition lag) — redraw only after animation settles
  $edgesSvg.innerHTML = '';
  $edgesSvg.style.opacity = '0';

  // PLAY: slide + fade exiting nodes out from their fixed positions
  requestAnimationFrame(() => {
    exitedNodes.forEach(({ el, dirLeft }) => {
      el.style.transition = `opacity ${Math.round(FOCUS_DUR * 0.7)}ms ease, transform ${dur} ${easeOut}`;
      el.style.opacity = '0';
      el.style.transform = `translateX(${dirLeft ? -130 : 130}%)`;
    });
  });

  // After animation: clean up + redraw edges at final positions, then fade back in
  // Stored in focusCleanupTimer so exitFocusMode can cancel it if user exits early
  focusCleanupTimer = setTimeout(() => {
    focusCleanupTimer = null;
    exitedNodes.forEach(({ el }) => {
      el.style.cssText = '';
      el.style.display = 'none';
      el.classList.remove('focus-exiting');
    });
    subtreeEls.forEach(el => { el.style.transition = ''; el.style.transform = ''; });
    drawEdgesForSubtree(subtree);
    $edgesSvg.style.opacity = '1';
  }, FOCUS_DUR + 50);

  $focusHint.classList.add('visible');
}

/**
 * Exit focus mode — proper reverse FLIP:
 * 1. Snapshot current visual positions of subtree nodes (may be centered)
 * 2. Restore ALL nodes to normal flow (clear all inline styles)
 * 3. Force layout → nodes at natural positions
 * 4. Snapshot natural positions (LAST)
 * 5. INVERT: push subtree nodes back to where they were + push returned nodes off-screen
 * 6. Force reflow
 * 7. PLAY: animate everything to natural (transform:'')
 */
function exitFocusMode() {
  if (!focusNodeId) return;
  const prevSubtree = getFocusSubtree(
    focusNodeId,
    document.querySelector(`[data-node-id="${focusNodeId}"]`)?.dataset.nodeType || 'declaration'
  );
  focusNodeId = null;
  if (focusCleanupTimer) { clearTimeout(focusCleanupTimer); focusCleanupTimer = null; }

  const dur = FOCUS_DUR + 'ms';
  const easeIn = 'cubic-bezier(0,0,0.2,1)';

  // FIRST: snapshot current visual positions of subtree nodes (before any style changes)
  const firstRects = snapshotRects(prevSubtree);

  // Capture dirLeft for each exited node, then clear all inline styles on every node
  const capturedExits = exitedNodes.map(({ el, dirLeft }) => ({ el, dirLeft }));
  exitedNodes = [];

  document.querySelectorAll('.node').forEach(el => {
    el.style.cssText = '';
    el.classList.remove('focus-exiting', 'focus-active');
  });

  // Force layout: all nodes now at their natural flex positions
  void document.body.offsetWidth;

  // LAST: snapshot natural positions of subtree nodes
  const lastRects = snapshotRects(prevSubtree);

  // Build subtree element map
  const subtreeEls = new Map();
  prevSubtree.forEach(id => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    if (el) subtreeEls.set(id, el);
  });

  // INVERT subtree: push nodes back to where they appeared (centered)
  subtreeEls.forEach((el, id) => {
    const first = firstRects.get(id);
    const last  = lastRects.get(id);
    if (!first || !last) return;
    const dx = first.left - last.left;
    const dy = first.top  - last.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      el.style.transition = 'none';
      el.style.transform  = `translate(${dx}px, ${dy}px)`;
    }
  });

  // INVERT returned nodes: push off-screen so they slide in
  capturedExits.forEach(({ el, dirLeft }) => {
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.style.transform  = `translateX(${dirLeft ? -130 : 130}%)`;
  });

  // Force reflow to paint inverted state before PLAY
  void document.body.offsetWidth;

  // Clear edges immediately
  $edgesSvg.innerHTML = '';
  $edgesSvg.style.opacity = '0';

  // PLAY: animate all nodes to natural positions (transform:'')
  requestAnimationFrame(() => {
    subtreeEls.forEach(el => {
      el.style.transition = `transform ${dur} ${easeIn}`;
      el.style.transform  = '';
    });
    capturedExits.forEach(({ el }) => {
      el.style.transition = `opacity ${Math.round(FOCUS_DUR * 0.8)}ms ease ${Math.round(FOCUS_DUR * 0.1)}ms, transform ${dur} ${easeIn}`;
      el.style.opacity    = '1';
      el.style.transform  = '';
    });
  });

  // Cleanup: remove inline styles, redraw edges at settled positions
  focusCleanupTimer = setTimeout(() => {
    document.querySelectorAll('.node').forEach(el => {
      el.style.transition = '';
      el.style.transform  = '';
      el.style.opacity    = '';
    });
    void document.body.offsetWidth;
    requestAnimationFrame(() => {
      drawEdges();
      $edgesSvg.style.opacity = '1';
    });
    focusCleanupTimer = null;
  }, FOCUS_DUR + 80);

  $focusHint.classList.remove('visible');
}

/**
 * Draw edges but dim those outside the given subtree.
 * @param {Set<string>} subtree
 */
function drawEdgesForSubtree(subtree) {
  if (!graphData) return;
  const { milestones, actions } = graphData;
  const container = document.getElementById('canvas-container');

  $edgesSvg.setAttribute('width',  String(container.scrollWidth));
  $edgesSvg.setAttribute('height', String(container.scrollHeight));
  $edgesSvg.innerHTML = '';

  const fragment = document.createDocumentFragment();

  (milestones || []).forEach(m => {
    const mEl = document.querySelector(`[data-node-id="${m.id}"]`);
    if (!mEl) return;
    const mTop = getTopCenter(mEl);

    (m.realizes || []).forEach(dId => {
      const dEl = document.querySelector(`[data-node-id="${dId}"]`);
      if (!dEl) return;
      const dBot = getBottomCenter(dEl);
      const inSubtree = subtree.has(m.id) && subtree.has(dId);
      const path = makePath(curvePath(dBot.x, dBot.y, mTop.x, mTop.y), inSubtree);
      if (!inSubtree) path.classList.add('focus-dim');
      fragment.appendChild(path);
    });
  });

  (actions || []).forEach(a => {
    const aEl = document.querySelector(`[data-node-id="${a.id}"]`);
    if (!aEl) return;
    const aTop = getTopCenter(aEl);

    (a.causes || []).forEach(mId => {
      const mEl = document.querySelector(`[data-node-id="${mId}"]`);
      if (!mEl) return;
      const mBot = getBottomCenter(mEl);
      const inSubtree = subtree.has(a.id) && subtree.has(mId);
      const path = makePath(curvePath(mBot.x, mBot.y, aTop.x, aTop.y), inSubtree);
      if (!inSubtree) path.classList.add('focus-dim');
      fragment.appendChild(path);
    });
  });

  $edgesSvg.appendChild(fragment);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

$refreshBtn.addEventListener('click', () => {
  loadData();
});

// ESC to exit focus mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && focusNodeId) {
    document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
    selectedNodeId = null;
    exitFocusMode();
    if ($panelEmpty) $panelEmpty.style.display = '';
  }
});

// Click on canvas background to exit focus mode
document.getElementById('canvas-wrap').addEventListener('click', (e) => {
  if (!focusNodeId) return;
  if (!e.target.closest('.node')) {
    document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
    selectedNodeId = null;
    exitFocusMode();
    if ($panelEmpty) $panelEmpty.style.display = '';
  }
});

$overlayRetry.addEventListener('click', () => {
  showLoading();
  loadData();
});

// Redraw edges on window resize or scroll (layout may shift)
window.addEventListener('resize', () => {
  if (graphData) requestAnimationFrame(() => drawEdges());
});

document.getElementById('canvas-wrap').addEventListener('scroll', () => {
  if (graphData) requestAnimationFrame(() => drawEdges());
});

// ─── Confetti ────────────────────────────────────────────────────────────────
// Fires once when all declarations reach a completed state (DONE/KEPT/HONORED).
// Pure canvas — no external deps.

let confettiFired = false;

const COMPLETED_STATES = new Set(['DONE', 'KEPT', 'HONORED']);

/**
 * Check if all declarations are complete and fire confetti if so.
 * @param {{ declarations: any[] } | null} graph
 */
function checkProjectComplete(graph) {
  if (confettiFired) return;
  if (!graph || !graph.declarations || graph.declarations.length === 0) return;
  const allDone = graph.declarations.every(d => COMPLETED_STATES.has(d.status));
  if (!allDone) return;
  confettiFired = true;
  fireConfetti();
}

function fireConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = [
    '#5ba3ff', '#a66bff', '#34d399',   // brand: blue, purple, green
    '#fbbf24', '#f87171', '#38bdf8',   // yellow, red, sky
    '#ffffff',                          // white
  ];

  const count  = 180;
  const pieces = Array.from({ length: count }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height * -0.5 - 10,
    w:    6 + Math.random() * 8,
    h:    3 + Math.random() * 5,
    rot:  Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.2,
    vx:   (Math.random() - 0.5) * 4,
    vy:   2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 1,
  }));

  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of pieces) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.07;           // gravity
      p.vx  *= 0.99;           // drag
      p.rot += p.rotV;
      // fade out once off-screen bottom
      if (p.y > canvas.height * 0.85) p.alpha -= 0.025;
      if (p.alpha <= 0) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive > 0) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  frame = requestAnimationFrame(draw);

  // Safety cleanup after 8s
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 8000);
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const $activityFeed   = document.getElementById('activity-feed');
const $activityList   = document.getElementById('activity-list');
const $activityPulse  = document.getElementById('activity-pulse');
const $activityToggle = document.getElementById('activity-toggle');
let activityExpanded  = false;

$activityToggle.addEventListener('click', () => {
  activityExpanded = !activityExpanded;
  $activityFeed.classList.toggle('expanded', activityExpanded);
});

/**
 * Fetch /api/activity and render the event list.
 */
async function loadActivity() {
  try {
    const res = await fetch('/api/activity');
    const { events } = await res.json();
    if (!events || events.length === 0) return;

    $activityFeed.classList.add('has-events');

    const html = events.slice(0, 50).map(ev => {
      const time = new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (ev.tool === 'Task') {
        const icon = ev.phase === 'start' ? '⟳' : '✓';
        const cls  = ev.phase === 'start' ? 'agent-start' : 'agent-done';
        const label = ev.phase === 'start'
          ? `Spawning ${ev.agent || 'agent'}: ${ev.desc}`
          : `Done: ${ev.desc}`;
        return `<div class="activity-event"><span class="ae-time">${time}</span><span class="ae-icon">${icon}</span><span class="ae-text ${cls}">${escHtml(label)}</span></div>`;
      }
      if (ev.tool === 'Bash') {
        const icon = ev.phase === 'start' ? '▶' : '■';
        return `<div class="activity-event"><span class="ae-time">${time}</span><span class="ae-icon" style="opacity:0.5">${icon}</span><span class="ae-text bash">${escHtml(ev.cmd || '')}</span></div>`;
      }
      if (ev.tool === 'Write') {
        return `<div class="activity-event"><span class="ae-time">${time}</span><span class="ae-icon" style="opacity:0.5">✎</span><span class="ae-text write">${escHtml(ev.file || '')}</span></div>`;
      }
      return '';
    }).filter(Boolean).join('');

    $activityList.innerHTML = html || $activityList.innerHTML;

    // Flash pulse
    $activityPulse.classList.add('live');
    clearTimeout($activityPulse._timer);
    $activityPulse._timer = setTimeout(() => $activityPulse.classList.remove('live'), 3000);
  } catch (_) {}
}

// ─── Live updates via Server-Sent Events ─────────────────────────────────────
// Server watches .planning/ with fs.watch and pushes a 'change' event.
// Client re-renders only when idle (not mid-animation).

function connectSSE() {
  const es = new EventSource('/events');
  es.addEventListener('change', () => {
    if (focusNodeId || focusCleanupTimer) return; // skip during animation
    loadData();
  });
  es.addEventListener('activity', () => {
    loadActivity();
  });
  es.addEventListener('error', () => {
    // Connection dropped — reconnect after 3s
    es.close();
    setTimeout(connectSSE, 3000);
  });
}

connectSSE();

// ─── Bootstrap ───────────────────────────────────────────────────────────────

showLoading();
loadData();
loadActivity();
