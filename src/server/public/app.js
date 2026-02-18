/**
 * Declare DAG Visualizer — app.js
 *
 * Fetches /api/graph and /api/status, renders a layered DAG with SVG edges,
 * supports node click for full details in a side panel, and polls every 5s.
 *
 * Zero external dependencies. Vanilla JS, no build step.
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;
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

/** @type {number | null} */
let pollTimer = null;

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
    drawEdges();
    return;
  }

  selectedNodeId = nodeId;

  // Highlight node
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (el) el.classList.add('selected');

  // Enter focus mode for declarations and milestones
  if (type === 'declaration' || type === 'milestone') {
    enterFocusMode(nodeId, type);
  } else {
    // Actions: exit focus if active, redraw edges
    if (focusNodeId) exitFocusMode();
    else drawEdges();
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
  renderPanelContent(item, type);
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

// ─── Focus mode ───────────────────────────────────────────────────────────────

const $focusHint = document.getElementById('focus-hint');

/**
 * Compute the set of node IDs that belong to a focused subtree.
 * @param {string} nodeId  - declaration or milestone ID
 * @param {string} type    - 'declaration' | 'milestone'
 * @returns {Set<string>}
 */
function getFocusSubtree(nodeId, type) {
  if (!graphData) return new Set();
  const { declarations, milestones, actions } = graphData;
  const visible = new Set();

  if (type === 'declaration') {
    visible.add(nodeId);
    // milestones that realize this declaration
    const relatedMilestones = milestones.filter(m => (m.realizes || []).includes(nodeId));
    relatedMilestones.forEach(m => {
      visible.add(m.id);
      // actions that cause those milestones
      actions.forEach(a => {
        if ((a.causes || []).includes(m.id)) visible.add(a.id);
      });
    });
  } else if (type === 'milestone') {
    visible.add(nodeId);
    const m = milestones.find(x => x.id === nodeId);
    if (m) {
      // declarations this milestone realizes
      (m.realizes || []).forEach(dId => visible.add(dId));
      // actions that cause this milestone
      actions.forEach(a => {
        if ((a.causes || []).includes(nodeId)) visible.add(a.id);
      });
    }
  }

  return visible;
}

const FOCUS_EXIT_MS = 320;
const FOCUS_ENTER_MS = 340;

/**
 * Enter focus mode for a declaration or milestone.
 * Phase 1: slide + fade out (320ms). Phase 2: collapse out of flow → re-center.
 * @param {string} nodeId
 * @param {string} type
 */
function enterFocusMode(nodeId, type) {
  if (!graphData) return;

  // Clear any in-progress exit
  if (focusNodeId) clearFocusClasses();

  focusNodeId = nodeId;
  const subtree = getFocusSubtree(nodeId, type);

  const focusEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!focusEl) return;
  const focusCenterX = focusEl.getBoundingClientRect().left + focusEl.getBoundingClientRect().width / 2;

  const exitEls = [];

  document.querySelectorAll('.node').forEach(el => {
    const id = el.dataset.nodeId;
    if (!id) return;
    el.classList.remove('focus-active', 'focus-exiting', 'focus-exit-left', 'focus-exit-right', 'focus-gone', 'focus-returning', 'focus-animating-in');

    if (subtree.has(id)) {
      el.classList.add('focus-active');
    } else {
      const cx = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
      el.classList.add('focus-exiting', cx < focusCenterX ? 'focus-exit-left' : 'focus-exit-right');
      exitEls.push(el);
    }
  });

  $focusHint.classList.add('visible');
  requestAnimationFrame(() => drawEdgesForSubtree(subtree));

  // Phase 2: after animation, collapse exited nodes so flex re-centers
  setTimeout(() => {
    exitEls.forEach(el => {
      el.classList.remove('focus-exiting');
      el.classList.add('focus-gone');
    });
    // Redraw edges after re-layout
    requestAnimationFrame(() => drawEdgesForSubtree(subtree));
  }, FOCUS_EXIT_MS + 20);
}

/**
 * Exit focus mode — restore all nodes with return animation.
 */
function exitFocusMode() {
  if (!focusNodeId) return;
  const subtree = getFocusSubtree(focusNodeId, document.querySelector(`[data-node-id="${focusNodeId}"]`)?.dataset.nodeType || 'declaration');
  focusNodeId = null;

  const returnEls = [];

  document.querySelectorAll('.node').forEach(el => {
    const id = el.dataset.nodeId;
    if (!id) return;

    if (el.classList.contains('focus-gone')) {
      const isLeft = el.classList.contains('focus-exit-left');
      // Restore from gone: set offscreen without transition, then animate in
      el.classList.remove('focus-gone', 'focus-exit-left', 'focus-exit-right', 'focus-exiting');
      el.classList.add('focus-returning', isLeft ? 'focus-exit-left' : 'focus-exit-right');
      returnEls.push(el);
    }
    el.classList.remove('focus-active');
  });

  // Force reflow so returning state is painted before we add the transition
  document.body.offsetHeight; // eslint-disable-line no-unused-expressions

  returnEls.forEach(el => {
    el.classList.remove('focus-returning');
    el.classList.add('focus-animating-in');
  });

  $focusHint.classList.remove('visible');
  requestAnimationFrame(() => drawEdges());

  // Clean up after animation
  setTimeout(() => {
    returnEls.forEach(el => {
      el.classList.remove('focus-animating-in', 'focus-exit-left', 'focus-exit-right');
    });
    requestAnimationFrame(() => drawEdges());
  }, FOCUS_ENTER_MS + 20);
}

function clearFocusClasses() {
  document.querySelectorAll('.node').forEach(el => {
    el.classList.remove('focus-active', 'focus-exiting', 'focus-exit-left', 'focus-exit-right', 'focus-gone', 'focus-returning', 'focus-animating-in');
  });
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
      if (!inSubtree) path.style.opacity = '0.05';
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
      if (!inSubtree) path.style.opacity = '0.05';
      fragment.appendChild(path);
    });
  });

  $edgesSvg.appendChild(fragment);
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

$refreshBtn.addEventListener('click', () => {
  stopPolling();
  loadData().then(() => startPolling());
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
  loadData().then(() => startPolling());
});

// Redraw edges on window resize or scroll (layout may shift)
window.addEventListener('resize', () => {
  if (graphData) requestAnimationFrame(() => drawEdges());
});

document.getElementById('canvas-wrap').addEventListener('scroll', () => {
  if (graphData) requestAnimationFrame(() => drawEdges());
});

// ─── Polling ──────────────────────────────────────────────────────────────────

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(() => {
    loadData();
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

showLoading();
loadData().then(() => startPolling());
