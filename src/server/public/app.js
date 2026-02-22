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

/** @type {Set<string>} Tracks which action IDs are currently executing */
let runningActions = new Set();

/** @type {string | null} Which action's output we're listening to */
let currentOutputActionId = null;

/** @type {string | null} Currently selected declaration in column browser */
let colSelectedDecl = null;
/** @type {string | null} Currently selected milestone in column browser */
let colSelectedMile = null;

/** @type {number} Column browser keyboard focus column (0=decl, 1=mile, 2=act) */
let kbColumn = 0;
/** @type {number} Column browser keyboard focus item index within the focused column */
let kbIndex = 0;

/** @type {'dag'|'columns'} Current view mode, persisted in localStorage */
let viewMode = localStorage.getItem('declare-view-mode') || 'dag';

/** @type {boolean} Whether the declaration input form is visible */
let declFormVisible = false;
/** @type {boolean} Whether a declaration creation request is in flight */
let declFormLoading = false;
/** @type {string|null} Current error message shown in the declaration form */
let declFormError = null;

/** @type {string|null} ID of declaration currently being edited */
let editingDeclId = null;
/** @type {boolean} Whether an edit save request is in flight */
let editFormLoading = false;
/** @type {string|null} Current error message shown in the edit form */
let editFormError = null;
/** @type {string|null} ID of declaration showing delete confirmation */
let deleteConfirmId = null;

/** @type {string | null} Active derivation session ID */
let derivationSessionId = null;
/** @type {Array<{title: string, realizes: string, reason: string}> | null} */
let derivationProposals = null;

/** @type {string | null} Active action derivation session ID */
let actionDerivationSessionId = null;
/** @type {string | null} Milestone ID for the current action derivation */
let actionDerivationMilestoneId = null;
/** @type {Array<{title: string, produces: string, reason: string}> | null} */
let actionDerivationProposals = null;

/** @type {number|null} Line number currently being annotated */
let annotatingLine = null;
/** @type {string|null} Node ID of the currently displayed annotation panel */
let annotationNodeId = null;

/** @type {boolean} Whether the diff view is showing */
let showingDiff = false;

/** @type {string|null} Active revision session ID */
let revisionSessionId = null;
/** @type {string|null} Node ID being revised */
let revisionNodeId = null;

/** @type {boolean} Whether the play sequence is currently running */
let playRunning = false;
/** @type {{ currentWave: number, totalWaves: number, activeActions: string[], completedActions: string[], failedActions: string[] } | null} */
let playStatus = null;


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

const $colBrowser    = document.getElementById('column-browser');
const $colDeclList   = document.getElementById('col-decl-list');
const $colMileList   = document.getElementById('col-mile-list');
const $colActList    = document.getElementById('col-act-list');

const $viewToggle    = document.getElementById('view-toggle');
const $viewToggleLabel = document.getElementById('view-toggle-label');
const $canvasWrap    = document.getElementById('canvas-wrap');

const $declFormContainer = document.getElementById('decl-form-container');
const $colDeclAddBtn     = document.getElementById('col-decl-add-btn');
const $newDeclBtn        = document.getElementById('new-decl-btn');

const $workflowBanner   = document.getElementById('workflow-banner');
const $wfStateLabel      = document.getElementById('wf-state-label');
const $wfProgressFill    = document.getElementById('wf-progress-fill');
const $wfPct             = document.getElementById('wf-pct');
const $wfNextLabel       = document.getElementById('wf-next-label');
const $wfActionBtn       = document.getElementById('wf-action-btn');

/** @type {{ state: string, nextStep: { label: string, action: string, targetId?: string }, progress: { percentage: number, declarations: number, milestones: number, actions: number, actionsDone: number } } | null} */
let workflowState = null;

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

// ─── Review state helpers ────────────────────────────────────────────────────

const REVIEW_DISPLAY = {
  draft: 'Draft',
  in_review: 'In Review',
  revision_needed: 'Needs Revision',
  approved: 'Approved',
};

const REVIEW_CYCLE = ['draft', 'in_review', 'revision_needed', 'approved'];

function reviewBadgeHtml(nodeId, reviewState) {
  const state = reviewState || 'draft';
  const label = REVIEW_DISPLAY[state] || state;
  return `<span class="review-badge review-${state}" data-node-id="${escHtml(nodeId)}" data-review-state="${escHtml(state)}" title="Click to change review state">${escHtml(label)}</span>`;
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

    // Fetch running actions (non-blocking — catch errors so it doesn't fail the whole load)
    await fetchRunningActions();

    // Sync topbar with running operations
    syncTopbarFromRunning();

    hideOverlay();
    renderStatusBar();
    renderGraph();
    renderColumnBrowser();
    updateLastUpdated();
    checkProjectComplete(graph);
    loadWorkflowState();

    // Apply persisted view mode (shows correct container, hides the other)
    switchView(viewMode);

    // Re-apply selection highlight if node still exists
    if (selectedNodeId) {
      const el = document.querySelector(`[data-node-id="${selectedNodeId}"]`);
      if (el) el.classList.add('selected');
    }

    // Clean up edit state if the edited declaration no longer exists
    if (editingDeclId && graph && graph.declarations) {
      const stillExists = graph.declarations.some(d => d.id === editingDeclId);
      if (!stillExists) {
        editingDeclId = null;
        editFormError = null;
        editFormLoading = false;
      }
    }
  } catch (err) {
    showError(
      `Could not reach the Declare server.\n${err.message}\n\nMake sure the server is running:\n  node dist/declare-tools.cjs serve`
    );
  }
}

/**
 * Fetch /api/running and update the runningActions set.
 */
async function fetchRunningActions() {
  try {
    const data = await fetchJson('/api/running');
    runningActions = new Set(data.running || []);
  } catch (_) {
    // Non-critical — keep existing set
  }
}

/**
 * Update is-running class on action node elements based on runningActions set.
 */
function updateRunningIndicators() {
  document.querySelectorAll('.node-action').forEach(el => {
    const id = el.dataset.nodeId;
    if (runningActions.has(id)) {
      el.classList.add('is-running');
    } else {
      el.classList.remove('is-running');
    }
  });
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
}

// ─── Node element builder ─────────────────────────────────────────────────────

const COMPLETED = new Set(['DONE','KEPT','HONORED']);
const IN_PROGRESS_STORED = new Set(['ACTIVE']);

/**
 * Compute derived workflow status for a milestone from its action statuses.
 * This overrides the stored MILESTONES.md status so the dashboard always
 * reflects reality even if sync-status hasn't been called.
 *
 * @param {{ id: string, status: string, hasPlan: boolean }} milestone
 * @param {Array<{ id: string, status: string, causes: string[] }>} allActions
 * @returns {{ displayStatus: string, doneCount: number, totalCount: number }}
 */
function deriveMilestoneStatus(milestone, allActions) {
  // Authoritative integrity/terminal states — always trust these
  if (['KEPT','HONORED','BROKEN','RENEGOTIATED'].includes(milestone.status)) {
    const myActions = allActions.filter(a => (a.causes||[]).includes(milestone.id));
    return { displayStatus: milestone.status, doneCount: myActions.filter(a=>COMPLETED.has(a.status)).length, totalCount: myActions.length };
  }

  const myActions = allActions.filter(a => (a.causes||[]).includes(milestone.id));
  const doneCount  = myActions.filter(a => COMPLETED.has(a.status)).length;
  const totalCount = myActions.length;

  let displayStatus;
  if (totalCount === 0) {
    displayStatus = milestone.hasPlan ? 'PLANNED' : 'PENDING';
  } else if (doneCount === totalCount) {
    displayStatus = 'DONE';
  } else if (doneCount > 0) {
    displayStatus = 'EXECUTING';
  } else {
    displayStatus = 'PLANNED';
  }

  return { displayStatus, doneCount, totalCount };
}

/**
 * Compute derived workflow status for a declaration from its milestone statuses.
 * @param {{ id: string, status: string, milestones: string[] }} declaration
 * @param {Array<{ id: string, displayStatus: string }>} enrichedMilestones
 * @returns {string}
 */
function deriveDeclarationStatus(declaration, enrichedMilestones) {
  if (['KEPT','HONORED','BROKEN','RENEGOTIATED'].includes(declaration.status)) return declaration.status;

  const myMilestones = enrichedMilestones.filter(m => (declaration.milestones||[]).includes(m.id));
  if (myMilestones.length === 0) return 'PENDING';

  const doneCount     = myMilestones.filter(m => COMPLETED.has(m.displayStatus)).length;
  const executingCount = myMilestones.filter(m => m.displayStatus === 'EXECUTING').length;
  const plannedCount  = myMilestones.filter(m => m.displayStatus === 'PLANNED').length;

  if (doneCount === myMilestones.length) return 'DONE';
  if (executingCount > 0 || doneCount > 0) return 'EXECUTING';
  if (plannedCount > 0) return 'PLANNED';
  return 'PENDING';
}

/**
 * Build a node DOM element.
 * @param {object} item
 * @param {'declaration'|'milestone'|'action'} type
 * @param {{ displayStatus?: string, doneCount?: number, totalCount?: number }} [derived]
 * @returns {HTMLElement}
 */
function buildNodeEl(item, type, derived = {}) {
  const displayStatus = derived.displayStatus || item.status || 'PENDING';
  const el = document.createElement('div');
  el.className = `node node-${type} status-${statusClass(displayStatus)}`;
  el.dataset.nodeId   = item.id;
  el.dataset.nodeType = type;

  // Wholeness left-border indicator
  const wh = item.wholeness;
  if (wh === 'whole' || wh === 'partial' || wh === 'broken') {
    el.classList.add(`wholeness-${wh}`);
  }

  const title = item.title || item.statement || item.id;

  // Progress bar for milestones with actions
  let progressHtml = '';
  if (type === 'milestone' && derived.totalCount > 0) {
    const pct = Math.round((derived.doneCount / derived.totalCount) * 100);
    const countLabel = `${derived.doneCount}/${derived.totalCount}`;
    progressHtml = `
      <div class="node-progress" title="${countLabel} actions done">
        <div class="node-progress-fill" style="width:${pct}%"></div>
      </div>`;
  }

  // Badge label — show progress count for executing milestones
  let badgeLabel = displayStatus;
  if (type === 'milestone' && displayStatus === 'EXECUTING' && derived.totalCount > 0) {
    badgeLabel = `${derived.doneCount}/${derived.totalCount} DONE`;
  }

  // Integrity indicator — small colored dot next to status badge
  // Skip for "broken" when node has no children (treat as pending/not-yet-computable)
  let integrityDotHtml = '';
  if (wh === 'whole' || wh === 'partial') {
    integrityDotHtml = `<span class="integrity-dot integrity-${wh}" title="Integrity: ${wh}"></span>`;
  } else if (wh === 'broken') {
    // Only show broken dot if this node actually has children (not just "nothing to compute")
    if (type === 'action') {
      integrityDotHtml = `<span class="integrity-dot integrity-broken" title="Integrity: broken"></span>`;
    } else if (type === 'milestone' && derived.totalCount > 0) {
      integrityDotHtml = `<span class="integrity-dot integrity-broken" title="Integrity: broken"></span>`;
    } else if (type === 'declaration') {
      // Declarations: check if they have child milestones
      const hasChildren = graphData && (graphData.milestones || []).some(m => (m.realizes || []).includes(item.id));
      if (hasChildren) {
        integrityDotHtml = `<span class="integrity-dot integrity-broken" title="Integrity: broken"></span>`;
      }
    }
    // If none of the above matched, no dot shown (pending/not-computable)
  }

  // Classification icon for milestones (robot for agent, person for human)
  let classIconHtml = '';
  if (type === 'milestone' && item.classification) {
    const isHuman = item.classification === 'human';
    const icon = isHuman ? '\u{1F464}' : '\u{1F916}';
    const label = isHuman ? 'Human' : 'Agent';
    classIconHtml = `<span class="class-icon" title="${label}">${icon}</span>`;
  }

  // Dependency indicator for milestones
  let depIndicatorHtml = '';
  if (type === 'milestone' && item.dependsOn && item.dependsOn.length > 0) {
    depIndicatorHtml = `<span class="dep-indicator" title="Blocked by: ${item.dependsOn.join(', ')}">&#8592; ${item.dependsOn.length}</span>`;
  }

  // Readiness badge for milestones
  let readinessBadgeHtml = '';
  if (type === 'milestone' && item.readiness) {
    const rs = item.readiness.state;
    if (rs === 'ready') {
      readinessBadgeHtml = '<span class="readiness-badge readiness-ready">READY</span>';
    } else if (rs === 'blocked') {
      const blockers = (item.readiness.blockedBy || []).join(', ');
      readinessBadgeHtml = `<span class="readiness-badge readiness-blocked" title="Blocked by: ${blockers}">BLOCKED</span>`;
    } else if (rs === 'no-actions') {
      readinessBadgeHtml = '<span class="readiness-badge readiness-no-actions">NO ACTIONS</span>';
    }
    // done state: no badge needed (status already shows DONE)
  }

  el.innerHTML = `
    <div class="node-id">${classIconHtml}${item.id}${depIndicatorHtml}</div>
    <div class="node-title">${truncate(title, 55)}</div>
    <span class="status-badge">${badgeLabel}</span>${readinessBadgeHtml}${integrityDotHtml}${reviewBadgeHtml(item.id, item.reviewState)}
    ${progressHtml}
  `;

  el.addEventListener('click', () => selectNode(item.id, type));
  return el;
}

// ─── Graph renderer ───────────────────────────────────────────────────────────

function renderGraph() {
  if (!graphData) return;

  const { declarations, milestones, actions } = graphData;

  // ── Compute derived statuses from action data (always reflects reality) ──────
  // Milestones
  const enrichedMilestones = (milestones || []).map(m => ({
    ...m,
    ...deriveMilestoneStatus(m, actions || []),
  }));

  // Declarations
  const enrichedDeclarations = (declarations || []).map(d => ({
    ...d,
    displayStatus: deriveDeclarationStatus(d, enrichedMilestones),
  }));

  // Clear containers
  $nodesDecls.innerHTML = '';
  $nodesMiles.innerHTML = '';
  $nodesActs.innerHTML  = '';

  // Render
  enrichedDeclarations.forEach(d => {
    $nodesDecls.appendChild(buildNodeEl(d, 'declaration', { displayStatus: d.displayStatus }));
  });

  // Sort milestones: ready first, then no-actions, then blocked, then done
  const readinessOrder = { ready: 0, 'no-actions': 1, blocked: 2, done: 3 };
  const sortedMilestones = [...enrichedMilestones].sort((a, b) => {
    const aState = (a.readiness && a.readiness.state) || 'blocked';
    const bState = (b.readiness && b.readiness.state) || 'blocked';
    return (readinessOrder[aState] ?? 2) - (readinessOrder[bState] ?? 2);
  });

  sortedMilestones.forEach(m => {
    $nodesMiles.appendChild(buildNodeEl(m, 'milestone', {
      displayStatus: m.displayStatus,
      doneCount:     m.doneCount,
      totalCount:    m.totalCount,
    }));
  });

  (actions || []).forEach(a => {
    $nodesActs.appendChild(buildNodeEl(a, 'action'));
  });

  // Draw edges after layout settles
  requestAnimationFrame(() => drawEdges());

  // Mark running actions with pulsing indicator
  updateRunningIndicators();
}

// ─── Declaration input form ───────────────────────────────────────────────────

/**
 * Render or hide the declaration input form in the column browser.
 * Inserts the form into #decl-form-container at the top of the declarations column.
 */
function renderDeclForm() {
  if (!$declFormContainer) return;

  if (!declFormVisible) {
    $declFormContainer.innerHTML = '';
    return;
  }

  const submitLabel = declFormLoading ? 'Creating...' : 'Create';
  const disabledAttr = declFormLoading ? 'disabled' : '';
  const errorHtml = declFormError
    ? `<div class="form-error" id="decl-error">${escHtml(declFormError)}</div>`
    : '<div class="form-error" id="decl-error"></div>';

  $declFormContainer.innerHTML = `
    <div class="decl-form-overlay">
      <div class="decl-form">
        <input type="text" id="decl-title" placeholder="Declaration title" ${disabledAttr} />
        <textarea id="decl-statement" rows="3" placeholder="What future state are you declaring?" ${disabledAttr}></textarea>
        <div class="decl-form-actions">
          <button class="decl-submit-btn" id="decl-submit" ${disabledAttr}>${submitLabel}</button>
          <button class="decl-cancel-btn" id="decl-cancel">Cancel</button>
        </div>
        ${errorHtml}
      </div>
    </div>
  `;

  // Wire events
  const $submit = document.getElementById('decl-submit');
  const $cancel = document.getElementById('decl-cancel');
  const $title  = document.getElementById('decl-title');
  const $stmt   = document.getElementById('decl-statement');

  if ($submit) $submit.addEventListener('click', submitDeclaration);
  if ($cancel) $cancel.addEventListener('click', hideDeclForm);

  // Enter in title -> focus statement
  if ($title) {
    $title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if ($stmt) $stmt.focus();
      }
    });
  }

  // Cmd/Ctrl+Enter in statement -> submit
  if ($stmt) {
    $stmt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitDeclaration();
      }
    });
  }

  // Auto-focus the title input
  if ($title && !declFormLoading) {
    requestAnimationFrame(() => $title.focus());
  }
}

/**
 * Hide the declaration form and reset state.
 */
function hideDeclForm() {
  declFormVisible = false;
  declFormLoading = false;
  declFormError = null;
  renderDeclForm();
}

/**
 * Show the declaration form in the column browser.
 * If not in column view, switch to it first.
 */
function showDeclForm() {
  if (viewMode !== 'columns') {
    switchView('columns');
  }
  declFormVisible = true;
  declFormLoading = false;
  declFormError = null;
  renderDeclForm();
}

/**
 * Submit the declaration form data to POST /api/declarations.
 * Validates inputs, shows loading state, handles success/error.
 */
async function submitDeclaration() {
  if (declFormLoading) return;

  const $title = document.getElementById('decl-title');
  const $stmt  = document.getElementById('decl-statement');

  const title     = ($title ? $title.value : '').trim();
  const statement = ($stmt  ? $stmt.value  : '').trim();

  // Validate
  if (!title) {
    declFormError = 'Title is required';
    renderDeclForm();
    return;
  }
  if (!statement) {
    declFormError = 'Statement is required';
    renderDeclForm();
    return;
  }

  // Set loading state
  declFormLoading = true;
  declFormError = null;
  renderDeclForm();

  try {
    const res = await fetch('/api/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, statement }),
    });

    if (res.ok || res.status === 201) {
      // Success: hide form, refresh graph
      hideDeclForm();
      await loadData();
    } else {
      const data = await res.json().catch(() => ({}));
      declFormError = data.error || `Server error (${res.status})`;
      declFormLoading = false;
      renderDeclForm();
    }
  } catch (err) {
    declFormError = err.message || 'Network error';
    declFormLoading = false;
    renderDeclForm();
  }
}

// ─── Column browser ───────────────────────────────────────────────────────────

/**
 * Render the three-column Finder-style browser using existing graphData.
 * Column 1: Declarations, Column 2: Milestones (filtered), Column 3: Actions (filtered).
 */
function renderColumnBrowser() {
  if (!$colBrowser || !graphData) return;

  const { declarations, milestones, actions } = graphData;

  // Compute enriched milestones and declarations (same logic as renderGraph)
  const enrichedMilestones = (milestones || []).map(m => ({
    ...m,
    ...deriveMilestoneStatus(m, actions || []),
  }));

  const enrichedDeclarations = (declarations || []).map(d => ({
    ...d,
    displayStatus: deriveDeclarationStatus(d, enrichedMilestones),
  }));

  // ── Column 1: Declarations ──
  $colDeclList.innerHTML = '';
  enrichedDeclarations.forEach(d => {
    const el = document.createElement('div');
    el.className = 'col-item';
    if (d.wholeness) el.classList.add('wholeness-' + d.wholeness);
    if (colSelectedDecl === d.id) el.classList.add('col-selected');

    const title = d.title || d.statement || d.id;
    el.innerHTML = `
      <span class="col-item-id">${escHtml(d.id)}</span>
      <span class="col-item-title">${escHtml(truncate(title, 55))}</span>
      <div class="col-item-meta">
        <span class="status-badge">${escHtml(d.displayStatus)}</span>${reviewBadgeHtml(d.id, d.reviewState)}
      </div>
    `;

    el.addEventListener('click', () => {
      colSelectedDecl = d.id;
      colSelectedMile = null;
      kbColumn = 0;
      kbIndex = enrichedDeclarations.indexOf(d);
      renderColumnBrowser();
      selectNode(d.id, 'declaration');
      updateKbFocus();
    });

    $colDeclList.appendChild(el);
  });

  // ── Column 2: Milestones ──
  $colMileList.innerHTML = '';
  if (!colSelectedDecl) {
    $colMileList.innerHTML = '<div class="col-empty">Select a declaration</div>';
  } else {
    const readinessSort = { ready: 0, 'no-actions': 1, blocked: 2, done: 3 };
    const filtered = enrichedMilestones
      .filter(m => (m.realizes || []).includes(colSelectedDecl))
      .sort((a, b) => {
        const aS = (a.readiness && a.readiness.state) || 'blocked';
        const bS = (b.readiness && b.readiness.state) || 'blocked';
        return (readinessSort[aS] ?? 2) - (readinessSort[bS] ?? 2);
      });
    if (filtered.length === 0) {
      $colMileList.innerHTML = '<div class="col-empty">No milestones</div>';
    } else {
      filtered.forEach(m => {
        const el = document.createElement('div');
        el.className = 'col-item';
        if (m.wholeness) el.classList.add('wholeness-' + m.wholeness);
        if (colSelectedMile === m.id) el.classList.add('col-selected');

        const title = m.title || m.id;
        let badgeLabel = m.displayStatus;
        if (m.totalCount > 0) {
          badgeLabel = m.displayStatus === 'EXECUTING'
            ? `${m.doneCount}/${m.totalCount} DONE`
            : `${m.doneCount}/${m.totalCount}`;
        }

        const desc = m.description ? `<span class="col-item-desc">${escHtml(truncate(m.description, 80))}</span>` : '';
        const clsIcon = m.classification === 'human' ? '\u{1F464}' : '\u{1F916}';
        const depInfo = (m.dependsOn && m.dependsOn.length > 0) ? `<span class="dep-indicator">\u2190 ${m.dependsOn.join(', ')}</span>` : '';

        // Readiness badge for column browser
        let colReadinessBadge = '';
        if (m.readiness) {
          const rs = m.readiness.state;
          if (rs === 'ready') {
            colReadinessBadge = '<span class="readiness-badge readiness-ready">READY</span>';
          } else if (rs === 'blocked') {
            const blockers = (m.readiness.blockedBy || []).join(', ');
            colReadinessBadge = `<span class="readiness-badge readiness-blocked" title="Blocked by: ${blockers}">BLOCKED</span>`;
          } else if (rs === 'no-actions') {
            colReadinessBadge = '<span class="readiness-badge readiness-no-actions">NO ACTIONS</span>';
          }
        }

        el.innerHTML = `
          <span class="col-item-id"><span class="class-icon">${clsIcon}</span>${escHtml(m.id)}${depInfo}</span>
          <span class="col-item-title">${escHtml(truncate(title, 55))}</span>
          ${desc}
          <div class="col-item-meta">
            <span class="status-badge">${escHtml(badgeLabel)}</span>${colReadinessBadge}${reviewBadgeHtml(m.id, m.reviewState)}
          </div>
        `;

        el.addEventListener('click', () => {
          colSelectedMile = m.id;
          kbColumn = 1;
          kbIndex = filtered.indexOf(m);
          renderColumnBrowser();
          selectNode(m.id, 'milestone');
          updateKbFocus();
        });

        $colMileList.appendChild(el);
      });
    }
  }

  // ── Column 3: Actions ──
  $colActList.innerHTML = '';
  if (!colSelectedMile) {
    $colActList.innerHTML = '<div class="col-empty">Select a milestone</div>';
  } else {
    const filtered = (actions || []).filter(a => (a.causes || []).includes(colSelectedMile));
    if (filtered.length === 0) {
      $colActList.innerHTML = '<div class="col-empty">No actions</div>';
    } else {
      filtered.forEach(a => {
        const el = document.createElement('div');
        el.className = 'col-item';
        if (a.wholeness) el.classList.add('wholeness-' + a.wholeness);
        if (runningActions.has(a.id)) el.classList.add('is-running');

        const title = a.title || a.id;
        const status = a.status || 'PENDING';

        el.innerHTML = `
          <span class="col-item-id">${escHtml(a.id)}</span>
          <span class="col-item-title">${escHtml(truncate(title, 55))}</span>
          <div class="col-item-meta">
            <span class="status-badge">${escHtml(status)}</span>${reviewBadgeHtml(a.id, a.reviewState)}
          </div>
        `;

        el.addEventListener('click', () => {
          kbColumn = 2;
          kbIndex = filtered.indexOf(a);
          selectNode(a.id, 'action');
          updateKbFocus();
        });

        $colActList.appendChild(el);
      });
    }
  }

  // Restore keyboard focus after DOM rebuild (if column browser is active)
  if (isColumnBrowserActive()) {
    updateKbFocus();
  }
}

// ─── Column browser keyboard navigation ──────────────────────────────────────

// Inject kb-focus CSS rule
(function injectKbFocusStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .col-item.kb-focus {
      outline: 2px solid currentColor;
      outline-offset: -2px;
      background: var(--surface2);
    }
  `;
  document.head.appendChild(style);
})();

/**
 * Check if the column browser view is currently active.
 * @returns {boolean}
 */
function isColumnBrowserActive() {
  return $colBrowser && $colBrowser.classList.contains('active');
}

/**
 * Get the list of .col-item elements in a given column index.
 * @param {number} col 0=declarations, 1=milestones, 2=actions
 * @returns {HTMLElement[]}
 */
function getColumnItems(col) {
  const lists = [$colDeclList, $colMileList, $colActList];
  const list = lists[col];
  if (!list) return [];
  return Array.from(list.querySelectorAll('.col-item'));
}

/**
 * Remove kb-focus from all column browser items, then apply it to the
 * item at (kbColumn, kbIndex). Scrolls the focused item into view.
 */
function updateKbFocus() {
  // Remove all existing kb-focus
  document.querySelectorAll('.col-item.kb-focus').forEach(el => el.classList.remove('kb-focus'));

  const items = getColumnItems(kbColumn);
  if (items.length === 0) return;

  // Clamp index
  if (kbIndex >= items.length) kbIndex = items.length - 1;
  if (kbIndex < 0) kbIndex = 0;

  const target = items[kbIndex];
  if (target) {
    target.classList.add('kb-focus');
    target.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Initialize keyboard focus when column browser becomes active.
 */
function initColumnBrowserKbFocus() {
  kbColumn = 0;
  kbIndex = 0;
  updateKbFocus();
}

/**
 * Clear all kb-focus classes (when column browser is deactivated).
 */
function clearColumnBrowserKbFocus() {
  document.querySelectorAll('.col-item.kb-focus').forEach(el => el.classList.remove('kb-focus'));
}

/**
 * Keyboard handler for column browser navigation.
 * Only processes keys when column browser is the active view.
 * @param {KeyboardEvent} e
 */
function handleColumnKeydown(e) {
  if (!isColumnBrowserActive()) return;

  const key = e.key;

  if (key === 'ArrowDown') {
    e.preventDefault();
    const items = getColumnItems(kbColumn);
    if (items.length === 0) return;
    kbIndex = (kbIndex + 1) % items.length;
    updateKbFocus();
    return;
  }

  if (key === 'ArrowUp') {
    e.preventDefault();
    const items = getColumnItems(kbColumn);
    if (items.length === 0) return;
    kbIndex = (kbIndex - 1 + items.length) % items.length;
    updateKbFocus();
    return;
  }

  if (key === 'ArrowRight') {
    e.preventDefault();
    if (kbColumn >= 2) return;
    // Check if the next column has items before moving
    const nextItems = getColumnItems(kbColumn + 1);
    if (nextItems.length === 0) return;
    kbColumn++;
    kbIndex = 0;
    updateKbFocus();
    return;
  }

  if (key === 'ArrowLeft') {
    e.preventDefault();
    if (kbColumn <= 0) return;
    kbColumn--;
    // Try to find the parent item index (the selected item in the column we're moving to)
    const items = getColumnItems(kbColumn);
    const selectedItem = items.findIndex(el => el.classList.contains('col-selected'));
    kbIndex = selectedItem >= 0 ? selectedItem : 0;
    updateKbFocus();
    return;
  }

  if (key === 'Enter') {
    e.preventDefault();
    const items = getColumnItems(kbColumn);
    if (items.length === 0 || kbIndex >= items.length) return;
    // Simulate click on the focused item
    items[kbIndex].click();
    return;
  }

  if (key === 'Escape') {
    if (kbColumn > 0) {
      e.preventDefault();
      // Move back one column (same as ArrowLeft)
      kbColumn--;
      const items = getColumnItems(kbColumn);
      const selectedItem = items.findIndex(el => el.classList.contains('col-selected'));
      kbIndex = selectedItem >= 0 ? selectedItem : 0;
      updateKbFocus();
    }
    // If kbColumn === 0, let the event propagate (don't interfere with DAG Escape)
    return;
  }
}

// Register the column browser keyboard handler
document.addEventListener('keydown', handleColumnKeydown);

// ─── Review badge click-to-cycle ──────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const badge = e.target.closest('.review-badge');
  if (!badge) return;
  e.stopPropagation(); // Don't trigger node selection

  const nodeId = badge.dataset.nodeId;
  const currentState = badge.dataset.reviewState || 'draft';
  const currentIdx = REVIEW_CYCLE.indexOf(currentState);
  const nextState = REVIEW_CYCLE[(currentIdx + 1) % REVIEW_CYCLE.length];

  try {
    const resp = await fetch(`/api/node/${encodeURIComponent(nodeId)}/review-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewState: nextState }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      console.error('Failed to update review state:', err);
      return;
    }
    // SSE will trigger a refresh, but also update immediately for responsiveness
    badge.className = `review-badge review-${nextState}`;
    badge.dataset.reviewState = nextState;
    badge.textContent = REVIEW_DISPLAY[nextState] || nextState;
  } catch (err) {
    console.error('Failed to update review state:', err);
  }
});

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

  // Milestone → Milestone dependency edges (dashed, horizontal)
  (milestones || []).forEach(m => {
    const deps = m.dependsOn || [];
    if (deps.length === 0) return;
    const mEl = document.querySelector(`[data-node-id="${m.id}"]`);
    if (!mEl) return;

    deps.forEach(depId => {
      const depEl = document.querySelector(`[data-node-id="${depId}"]`);
      if (!depEl) return;

      // Draw from right side of dependency to left side of dependent
      const containerRect = document.getElementById('canvas-container').getBoundingClientRect();
      const scrollLeft = document.getElementById('canvas-wrap').scrollLeft;
      const scrollTop  = document.getElementById('canvas-wrap').scrollTop;

      const depRect = depEl.getBoundingClientRect();
      const mRect = mEl.getBoundingClientRect();

      const x1 = depRect.right - containerRect.left + scrollLeft;
      const y1 = depRect.top - containerRect.top + scrollTop + depRect.height / 2;
      const x2 = mRect.left - containerRect.left + scrollLeft;
      const y2 = mRect.top - containerRect.top + scrollTop + mRect.height / 2;

      const cx = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
      const isHighlighted = selectedNodeId === m.id || selectedNodeId === depId;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', isHighlighted ? 'edge dep-edge highlight' : 'edge dep-edge');
      fragment.appendChild(path);
    });
  });

  $edgesSvg.appendChild(fragment);
}

// ─── Annotation panel ─────────────────────────────────────────────────────────

/**
 * Determine the artifact file path for a node, used to load content for annotation display.
 * @param {string} nodeId
 * @param {string} type - 'declaration' | 'milestone' | 'action'
 * @returns {string|null} The file path relative to project root, or null if unknown.
 */
function getNodeArtifactPath(nodeId, type) {
  if (!graphData) return null;

  if (type === 'declaration') {
    return '.planning/FUTURE.md';
  }

  if (type === 'milestone') {
    const milestone = graphData.milestones.find(m => m.id === nodeId);
    if (!milestone) return null;
    // Construct slug from title
    const slug = (milestone.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const mNum = nodeId.replace(/^M-/, '');
    return `.planning/milestones/M-${mNum}-${slug}/PLAN.md`;
  }

  if (type === 'action') {
    // Find the milestone this action belongs to
    const action = graphData.actions.find(a => a.id === nodeId);
    if (!action) return null;
    const milestoneId = (action.causes || [])[0];
    if (!milestoneId) return null;
    const milestone = graphData.milestones.find(m => m.id === milestoneId);
    if (!milestone) return null;
    const slug = (milestone.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const mNum = milestoneId.replace(/^M-/, '');
    const aNum = nodeId.replace(/^A-/, '');
    return `.planning/milestones/M-${mNum}-${slug}/A-${aNum}-EXEC-PLAN.md`;
  }

  return null;
}

/**
 * Format a timestamp as a short relative time string (e.g. "2m ago", "3h ago", "Jan 5").
 * @param {string} ts - ISO timestamp
 * @returns {string}
 */
function fmtRelativeTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
  if (diffSec < 604800) return Math.floor(diffSec / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Compute a line-by-line diff between two texts using an LCS-based algorithm.
 * Returns an array of { type: 'same' | 'add' | 'remove', text, oldNum, newNum }.
 *
 * @param {string[]} oldLines
 * @param {string[]} newLines
 * @returns {Array<{type: string, text: string, oldNum: number|null, newNum: number|null}>}
 */
function computeDiff(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS table (O(n*m) — fine for files under 500 lines)
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build edit script
  const result = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'same', text: oldLines[i - 1], oldNum: i, newNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: newLines[j - 1], oldNum: null, newNum: j });
      j--;
    } else {
      result.push({ type: 'remove', text: oldLines[i - 1], oldNum: i, newNum: null });
      i--;
    }
  }

  result.reverse();
  return result;
}

/**
 * Render an inline diff view comparing current artifact against the previous revision round.
 * Replaces the annotation panel content with a diff display.
 *
 * @param {string} nodeId
 */
async function renderDiffView(nodeId) {
  // Remove existing annotation panel
  const existingPanel = document.getElementById('annotation-panel');
  if (!existingPanel) return;

  existingPanel.innerHTML = '<div class="detail-label" style="margin-bottom:10px">Loading diff...</div>';

  try {
    const resp = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/revisions');
    if (!resp.ok) {
      existingPanel.innerHTML = '<div class="detail-label" style="margin-bottom:10px">Failed to load revisions</div>';
      return;
    }

    const data = await resp.json();
    const { current, previous, revisionRound } = data;

    if (previous === null || previous === undefined) {
      existingPanel.innerHTML = `<div class="detail-label" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
        <span>Diff View</span>
        <button class="diff-close-btn" id="diff-close-btn">Close Diff</button>
      </div>
      <div style="color:var(--text-dim);font-size:12px;padding:8px 0">No previous version available for comparison.</div>`;

      existingPanel.querySelector('#diff-close-btn').addEventListener('click', () => {
        showingDiff = false;
        const type = nodeId.startsWith('A-') ? 'action' : nodeId.startsWith('M-') ? 'milestone' : 'declaration';
        renderAnnotationPanel(nodeId, type);
      });
      return;
    }

    const oldLines = previous.split('\n');
    const newLines = current.split('\n');
    const diffEntries = computeDiff(oldLines, newLines);

    // Build diff HTML
    let linesHtml = '';
    for (const entry of diffEntries) {
      const cls = 'diff-line diff-' + entry.type;
      const oldGutter = entry.oldNum !== null ? entry.oldNum : '';
      const newGutter = entry.newNum !== null ? entry.newNum : '';
      const prefix = entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' ';
      const prefixCls = entry.type === 'add' || entry.type === 'remove' ? ' diff-' + entry.type : '';

      linesHtml += `<div class="${cls}">`;
      linesHtml += `<span class="diff-gutter diff-gutter-old">${oldGutter}</span>`;
      linesHtml += `<span class="diff-gutter diff-gutter-new">${newGutter}</span>`;
      linesHtml += `<span class="diff-prefix${prefixCls}">${prefix}</span>`;
      linesHtml += `<span class="diff-text">${escHtml(entry.text)}</span>`;
      linesHtml += `</div>`;
    }

    const prevRound = revisionRound - 1;
    existingPanel.innerHTML = `<div class="diff-view">
      <div class="diff-header">
        <span>Diff: Round ${prevRound} &rarr; Round ${revisionRound}</span>
        <button class="diff-close-btn" id="diff-close-btn">Close Diff</button>
      </div>
      ${linesHtml}
    </div>`;

    existingPanel.querySelector('#diff-close-btn').addEventListener('click', () => {
      showingDiff = false;
      const type = nodeId.startsWith('A-') ? 'action' : nodeId.startsWith('M-') ? 'milestone' : 'declaration';
      renderAnnotationPanel(nodeId, type);
    });

  } catch (err) {
    existingPanel.innerHTML = '<div class="detail-label" style="margin-bottom:10px">Error loading diff: ' + escHtml(String(err)) + '</div>';
  }
}

/**
 * Render the annotation panel for a node. Appends to $panelBody after existing content.
 * Fetches artifact content and annotations, builds line-numbered display with inline comments.
 *
 * @param {string} nodeId
 * @param {string} type
 */
async function renderAnnotationPanel(nodeId, type) {
  annotationNodeId = nodeId;
  annotatingLine = null;

  // Look up node's current reviewState from graphData
  let nodeReviewState = 'draft';
  if (graphData) {
    let node = null;
    if (type === 'declaration') node = graphData.declarations.find(d => d.id === nodeId);
    if (type === 'milestone')   node = graphData.milestones.find(m => m.id === nodeId);
    if (type === 'action')      node = graphData.actions.find(a => a.id === nodeId);
    if (node) nodeReviewState = node.reviewState || 'draft';
  }

  const artifactPath = getNodeArtifactPath(nodeId, type);

  // Fetch annotations
  let annotations = [];
  let revisionRound = 0;
  try {
    const annRes = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/annotations');
    if (annRes.ok) {
      const annData = await annRes.json();
      annotations = annData.annotations || [];
      revisionRound = annData.revisionRound || 0;
    }
  } catch (_) { /* ignore */ }

  // Build annotations lookup by line
  const annByLine = {};
  annotations.forEach(a => {
    if (!annByLine[a.line]) annByLine[a.line] = [];
    annByLine[a.line].push(a);
  });

  // Fetch artifact content if path is available
  let lines = null;
  if (artifactPath) {
    try {
      const fileRes = await fetch('/api/files?path=' + encodeURIComponent(artifactPath));
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        const content = fileData.content || '';
        lines = content.split('\n');
      }
    } catch (_) { /* ignore */ }
  }

  // Check that we're still showing the same node (user might have clicked elsewhere)
  if (annotationNodeId !== nodeId) return;

  // Remove any existing annotation panel
  const existingPanel = document.getElementById('annotation-panel');
  if (existingPanel) existingPanel.remove();

  // Build the annotation panel HTML
  const el = document.createElement('div');
  el.className = 'annotation-panel';
  el.id = 'annotation-panel';

  const commentCount = annotations.length;
  const roundBadge = revisionRound >= 1
    ? `<span class="revision-round-badge">Round ${revisionRound}</span>`
    : '';
  const diffToggle = revisionRound >= 1
    ? `<button class="ann-diff-toggle" id="ann-diff-toggle">Show Diff</button>`
    : '';
  let headerHtml = `<div class="detail-label" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
    <span style="display:flex;align-items:center">Annotations${roundBadge}${diffToggle}</span>
    <span class="annotation-count">${commentCount} comment${commentCount !== 1 ? 's' : ''}</span>
  </div>`;

  if (lines !== null) {
    // Show line-numbered artifact content with inline annotations
    const MAX_LINES = 500;
    const showAll = lines.length <= MAX_LINES;
    const displayLines = showAll ? lines : lines.slice(0, MAX_LINES);

    let linesHtml = '';
    displayLines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const hasAnn = annByLine[lineNum] && annByLine[lineNum].length > 0;
      linesHtml += `<div class="ann-line${hasAnn ? ' has-annotation' : ''}" data-line="${lineNum}">`;
      linesHtml += `<span class="ann-line-num" title="Click to annotate line ${lineNum}">${lineNum}</span>`;
      linesHtml += `<span class="ann-line-text">${escHtml(lineText)}</span>`;
      linesHtml += `</div>`;

      // Show existing annotations for this line
      if (hasAnn) {
        annByLine[lineNum].forEach(a => {
          linesHtml += `<div class="ann-comment" data-annotation-id="${escHtml(a.id)}">`;
          linesHtml += `<span class="ann-comment-text">${escHtml(a.text)}</span>`;
          linesHtml += `<span class="ann-comment-meta">${fmtRelativeTime(a.timestamp)}</span>`;
          linesHtml += `<button class="ann-resolve-btn" data-annotation-id="${escHtml(a.id)}" title="Resolve">&times;</button>`;
          linesHtml += `</div>`;
        });
      }

      // Show input row if this line is being annotated
      if (annotatingLine === lineNum) {
        linesHtml += `<div class="ann-input-row">`;
        linesHtml += `<input type="text" class="ann-input" placeholder="Add annotation..." autofocus />`;
        linesHtml += `<button class="ann-submit-btn">Add</button>`;
        linesHtml += `</div>`;
      }
    });

    // Also show annotations on lines beyond what we displayed, or on lines without artifact content
    if (!showAll) {
      linesHtml += `<button class="ann-show-more-btn" id="ann-show-more">${lines.length - MAX_LINES} more lines... click to show all</button>`;
    }

    el.innerHTML = headerHtml + `<div class="annotation-lines">${linesHtml}</div>`;
  } else if (annotations.length > 0) {
    // No artifact content available, but show annotations in list mode
    let listHtml = '';
    annotations.forEach(a => {
      listHtml += `<div class="ann-comment" data-annotation-id="${escHtml(a.id)}" style="border-radius:4px;margin-bottom:4px">`;
      listHtml += `<span style="font-size:10px;color:var(--text-dim);min-width:28px">L${a.line}</span>`;
      listHtml += `<span class="ann-comment-text">${escHtml(a.text)}</span>`;
      listHtml += `<span class="ann-comment-meta">${fmtRelativeTime(a.timestamp)}</span>`;
      listHtml += `<button class="ann-resolve-btn" data-annotation-id="${escHtml(a.id)}" title="Resolve">&times;</button>`;
      listHtml += `</div>`;
    });
    el.innerHTML = headerHtml + `<div class="annotation-lines" style="padding:8px">${listHtml}</div>`;
  } else {
    // No artifact content and no annotations
    el.innerHTML = headerHtml + `<div class="ann-no-artifact">No artifact content available. Select a line-numbered artifact to add annotations.</div>`;
  }

  // Show approve button if all annotations are resolved and node is in a reviewable state
  if (annotations.length === 0 && nodeReviewState === 'revision_needed') {
    const approveHtml = `<div class="ann-approve-section">
      <div class="ann-approve-msg">All annotations resolved</div>
      <button class="ann-approve-btn" id="ann-approve-btn">Approve</button>
    </div>`;
    el.insertAdjacentHTML('beforeend', approveHtml);
  } else if (annotations.length === 0 && nodeReviewState === 'in_review') {
    const approveHtml = `<div class="ann-approve-section">
      <div class="ann-approve-msg">No annotations — ready to approve</div>
      <button class="ann-approve-btn" id="ann-approve-btn">Approve</button>
    </div>`;
    el.insertAdjacentHTML('beforeend', approveHtml);
  }

  // Show "Request Revision" button when there are annotations
  if (annotations.length > 0) {
    const reviseHtml = `<div class="ann-revise-section">
      <button class="ann-revise-btn" id="ann-revise-btn">Request Revision</button>
      <div class="ann-revise-hint">Send ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} to planner agent for revision</div>
    </div>`;
    el.insertAdjacentHTML('beforeend', reviseHtml);
  }

  $panelBody.appendChild(el);

  // Wire event delegation on the annotation panel
  el.addEventListener('click', async (e) => {
    // Click diff toggle button
    if (e.target.id === 'ann-diff-toggle') {
      showingDiff = !showingDiff;
      if (showingDiff) {
        renderDiffView(nodeId);
      } else {
        showingDiff = false;
        renderAnnotationPanel(nodeId, type);
      }
      return;
    }

    // Click on line number to toggle annotation input
    const lineNumEl = e.target.closest('.ann-line-num');
    if (lineNumEl) {
      const line = parseInt(lineNumEl.parentElement.dataset.line, 10);
      annotatingLine = annotatingLine === line ? null : line;
      renderAnnotationPanel(nodeId, type);
      return;
    }

    // Click submit button
    const submitBtn = e.target.closest('.ann-submit-btn');
    if (submitBtn) {
      const inputRow = submitBtn.closest('.ann-input-row');
      const input = inputRow ? inputRow.querySelector('.ann-input') : null;
      if (input && input.value.trim()) {
        try {
          await fetch('/api/node/' + encodeURIComponent(nodeId) + '/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ line: annotatingLine, text: input.value.trim() })
          });
          annotatingLine = null;
          // Update review badge immediately to revision_needed
          const badge = document.querySelector('.review-badge[data-node-id="' + nodeId + '"]');
          if (badge) {
            badge.className = 'review-badge review-revision_needed';
            badge.dataset.reviewState = 'revision_needed';
            badge.textContent = REVIEW_DISPLAY['revision_needed'] || 'Needs Revision';
          }
          if (graphData) {
            let node = null;
            if (type === 'declaration') node = graphData.declarations.find(d => d.id === nodeId);
            if (type === 'milestone')   node = graphData.milestones.find(m => m.id === nodeId);
            if (type === 'action')      node = graphData.actions.find(a => a.id === nodeId);
            if (node) node.reviewState = 'revision_needed';
          }
          renderAnnotationPanel(nodeId, type);
        } catch (_) { /* ignore */ }
      }
      return;
    }

    // Click resolve/delete button
    const resolveBtn = e.target.closest('.ann-resolve-btn');
    if (resolveBtn) {
      const annId = resolveBtn.dataset.annotationId;
      if (annId) {
        try {
          await fetch('/api/node/' + encodeURIComponent(nodeId) + '/annotations/' + encodeURIComponent(annId), {
            method: 'DELETE'
          });
          renderAnnotationPanel(nodeId, type);
        } catch (_) { /* ignore */ }
      }
      return;
    }

    // Click show more button
    if (e.target.id === 'ann-show-more') {
      // Re-render without the line limit is complex; just scroll to show we'd load all
      // For now: remove the button text and mark as "loading all"
      // Full implementation: we'd re-render with no limit
      e.target.textContent = 'Loading all lines...';
      e.target.disabled = true;
      // Re-fetch and re-render without limit by toggling a flag
      // For simplicity, just re-render the full content
      renderAnnotationPanelFull(nodeId, type);
      return;
    }

    // Click Request Revision button
    if (e.target.id === 'ann-revise-btn') {
      e.target.disabled = true;
      e.target.textContent = 'Revising...';
      revisionNodeId = nodeId;
      try {
        const resp = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId })
        });
        if (resp.ok) {
          const data = await resp.json();
          revisionSessionId = data.sessionId;
          showRevisionPanel(nodeId);
        } else {
          e.target.disabled = false;
          e.target.textContent = 'Request Revision';
        }
      } catch (_) {
        e.target.disabled = false;
        e.target.textContent = 'Request Revision';
      }
      return;
    }

    // Click approve button
    if (e.target.id === 'ann-approve-btn') {
      try {
        const resp = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/review-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewState: 'approved' }),
        });
        if (resp.ok) {
          // Update badge immediately
          const badge = document.querySelector('.review-badge[data-node-id="' + nodeId + '"]');
          if (badge) {
            badge.className = 'review-badge review-approved';
            badge.dataset.reviewState = 'approved';
            badge.textContent = REVIEW_DISPLAY['approved'] || 'Approved';
          }
          // Update local graphData so re-render picks up new state
          if (graphData) {
            let node = null;
            if (type === 'declaration') node = graphData.declarations.find(d => d.id === nodeId);
            if (type === 'milestone')   node = graphData.milestones.find(m => m.id === nodeId);
            if (type === 'action')      node = graphData.actions.find(a => a.id === nodeId);
            if (node) node.reviewState = 'approved';
          }
          renderAnnotationPanel(nodeId, type);
        }
      } catch (_) { /* ignore */ }
      return;
    }
  });

  // Wire Enter key in annotation input
  el.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('ann-input')) {
      const input = e.target;
      if (input.value.trim()) {
        try {
          await fetch('/api/node/' + encodeURIComponent(nodeId) + '/annotations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ line: annotatingLine, text: input.value.trim() })
          });
          annotatingLine = null;
          // Update review badge immediately to revision_needed
          const badge = document.querySelector('.review-badge[data-node-id="' + nodeId + '"]');
          if (badge) {
            badge.className = 'review-badge review-revision_needed';
            badge.dataset.reviewState = 'revision_needed';
            badge.textContent = REVIEW_DISPLAY['revision_needed'] || 'Needs Revision';
          }
          if (graphData) {
            let node = null;
            if (type === 'declaration') node = graphData.declarations.find(d => d.id === nodeId);
            if (type === 'milestone')   node = graphData.milestones.find(m => m.id === nodeId);
            if (type === 'action')      node = graphData.actions.find(a => a.id === nodeId);
            if (node) node.reviewState = 'revision_needed';
          }
          renderAnnotationPanel(nodeId, type);
        } catch (_) { /* ignore */ }
      }
    }
  });
}

/**
 * Re-render the annotation panel showing all lines (no 500-line limit).
 * @param {string} nodeId
 * @param {string} type
 */
async function renderAnnotationPanelFull(nodeId, type) {
  // Temporarily patch to show all lines by using a large limit approach
  // We just re-call renderAnnotationPanel but it already shows 500 lines max.
  // For the full version, we'll modify the approach:
  const artifactPath = getNodeArtifactPath(nodeId, type);
  let annotations = [];
  try {
    const annRes = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/annotations');
    if (annRes.ok) {
      const annData = await annRes.json();
      annotations = annData.annotations || [];
    }
  } catch (_) { /* ignore */ }

  const annByLine = {};
  annotations.forEach(a => {
    if (!annByLine[a.line]) annByLine[a.line] = [];
    annByLine[a.line].push(a);
  });

  let lines = null;
  if (artifactPath) {
    try {
      const fileRes = await fetch('/api/files?path=' + encodeURIComponent(artifactPath));
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        lines = (fileData.content || '').split('\n');
      }
    } catch (_) { /* ignore */ }
  }

  if (annotationNodeId !== nodeId) return;

  const existingPanel = document.getElementById('annotation-panel');
  if (!existingPanel || !lines) return;

  const commentCount = annotations.length;
  let linesHtml = '';
  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const hasAnn = annByLine[lineNum] && annByLine[lineNum].length > 0;
    linesHtml += `<div class="ann-line${hasAnn ? ' has-annotation' : ''}" data-line="${lineNum}">`;
    linesHtml += `<span class="ann-line-num" title="Click to annotate line ${lineNum}">${lineNum}</span>`;
    linesHtml += `<span class="ann-line-text">${escHtml(lineText)}</span>`;
    linesHtml += `</div>`;
    if (hasAnn) {
      annByLine[lineNum].forEach(a => {
        linesHtml += `<div class="ann-comment" data-annotation-id="${escHtml(a.id)}">`;
        linesHtml += `<span class="ann-comment-text">${escHtml(a.text)}</span>`;
        linesHtml += `<span class="ann-comment-meta">${fmtRelativeTime(a.timestamp)}</span>`;
        linesHtml += `<button class="ann-resolve-btn" data-annotation-id="${escHtml(a.id)}" title="Resolve">&times;</button>`;
        linesHtml += `</div>`;
      });
    }
    if (annotatingLine === lineNum) {
      linesHtml += `<div class="ann-input-row">`;
      linesHtml += `<input type="text" class="ann-input" placeholder="Add annotation..." autofocus />`;
      linesHtml += `<button class="ann-submit-btn">Add</button>`;
      linesHtml += `</div>`;
    }
  });

  const linesContainer = existingPanel.querySelector('.annotation-lines');
  if (linesContainer) {
    linesContainer.innerHTML = linesHtml;
  }
}

/**
 * Show the revision output panel with streaming output area.
 * @param {string} nodeId
 */
function showRevisionPanel(nodeId) {
  // Remove any existing revision panel
  const existing = document.getElementById('revision-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'revision-panel';
  panel.innerHTML = `
    <div class="revision-panel-header">Revising ${escHtml(nodeId)}...</div>
    <pre id="revision-output"></pre>
    <button class="revision-stop-btn" id="revision-stop-btn">Stop</button>
  `;

  // Append to annotation panel or panel body
  const annPanel = document.getElementById('annotation-panel');
  if (annPanel) {
    annPanel.appendChild(panel);
  } else if ($panelBody) {
    $panelBody.appendChild(panel);
  }

  // Wire stop button
  const stopBtn = panel.querySelector('#revision-stop-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/revise/stop', { method: 'POST' });
        stopBtn.textContent = 'Stopping...';
        stopBtn.disabled = true;
      } catch (_) { /* ignore */ }
    });
  }
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
  annotatingLine = null;
  renderPanelChain(item, type);
  renderAnnotationPanel(nodeId, type);
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
    if (item.description) {
      html += section('Description', escHtml(item.description));
    }
    if (item.produces) {
      html += section('Produces', escHtml(item.produces));
    }
    if (item.realizes && item.realizes.length) {
      const decls = (graphData.declarations || []).filter(d => item.realizes.includes(d.id));
      html += tagSection('Realizes', decls.length ? decls : item.realizes.map(id => ({ id })), 'declaration');
    }
    // Readiness state
    if (item.readiness) {
      const rs = item.readiness.state;
      let readinessLabel = rs.toUpperCase();
      if (rs === 'no-actions') readinessLabel = 'NO ACTIONS';
      html += section('Readiness', `<span class="readiness-badge readiness-${rs === 'no-actions' ? 'no-actions' : rs}">${readinessLabel}</span>`);

      if (rs === 'blocked' && item.readiness.blockedBy && item.readiness.blockedBy.length > 0) {
        const blockerMilestones = (graphData.milestones || []).filter(m =>
          item.readiness.blockedBy.includes(m.id)
        );
        if (blockerMilestones.length > 0) {
          html += tagSection('Blocked by', blockerMilestones, 'milestone');
        } else {
          html += section('Blocked by', escHtml(item.readiness.blockedBy.join(', ')));
        }
      }
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

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const codeBlocks = [];
  text = text.replace(/^```(\w*)\n([\s\S]*?)^```/gm, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `\x00CODEBLOCK${idx}\x00`;
  });
  function inlineFormat(line) {
    const ic = [];
    line = line.replace(/`([^`]+)`/g, (_, c) => { const x = ic.length; ic.push(`<code>${esc(c)}</code>`); return `\x01IC${x}\x01`; });
    line = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, u) => `<img src="${esc(u)}" alt="${esc(a)}">`);
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${esc(u)}">${t}</a>`);
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/__(.+?)__/g, '<strong>$1</strong>');
    line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
    line = line.replace(/(?<![a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, '<em>$1</em>');
    line = line.replace(/\x01IC(\d+)\x01/g, (_, x) => ic[parseInt(x)]);
    return line;
  }
  const lines = text.split('\n'); const output = []; let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const cb = line.match(/^\x00CODEBLOCK(\d+)\x00$/);
    if (cb) { output.push(codeBlocks[parseInt(cb[1])]); i++; continue; }
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { output.push(`<h${hm[1].length}>${inlineFormat(hm[2])}</h${hm[1].length}>`); i++; continue; }
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { output.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) { const bq = []; while (i < lines.length && /^>\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\s?/,'')); i++; } output.push(`<blockquote><p>${inlineFormat(bq.join(' '))}</p></blockquote>`); continue; }
    if (i+1 < lines.length && /^\|/.test(line) && /^\|[\s:-]+\|/.test(lines[i+1])) { const hc = line.split('|').slice(1,-1).map(c=>c.trim()); i+=2; const rs=[]; while(i<lines.length && /^\|/.test(lines[i])){rs.push(lines[i].split('|').slice(1,-1).map(c=>c.trim()));i++;} let t='<table><thead><tr>'+hc.map(c=>`<th>${inlineFormat(c)}</th>`).join('')+'</tr></thead><tbody>'; rs.forEach(r=>{t+='<tr>'+r.map(c=>`<td>${inlineFormat(c)}</td>`).join('')+'</tr>';}); output.push(t+'</tbody></table>'); continue; }
    if (/^[\s]*[-*]\s+/.test(line)) { const it=[]; while(i<lines.length && /^[\s]*[-*]\s+/.test(lines[i])){it.push(lines[i].replace(/^[\s]*[-*]\s+/,'')); i++;} output.push('<ul>'+it.map(x=>`<li>${inlineFormat(x)}</li>`).join('')+'</ul>'); continue; }
    if (/^[\s]*\d+\.\s+/.test(line)) { const it=[]; while(i<lines.length && /^[\s]*\d+\.\s+/.test(lines[i])){it.push(lines[i].replace(/^[\s]*\d+\.\s+/,'')); i++;} output.push('<ol>'+it.map(x=>`<li>${inlineFormat(x)}</li>`).join('')+'</ol>'); continue; }
    if (line.trim()==='') { i++; continue; }
    const pl=[]; while(i<lines.length && lines[i].trim()!=='' && !/^#{1,6}\s/.test(lines[i]) && !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^[\s]*[-*]\s+/.test(lines[i]) && !/^[\s]*\d+\.\s+/.test(lines[i]) && !/^\|/.test(lines[i]) && !/^\x00CODEBLOCK/.test(lines[i])){pl.push(lines[i]);i++;}
    if (pl.length) output.push(`<p>${inlineFormat(pl.join(' '))}</p>`);
  }
  return output.join('\n');
}

// ─── File Viewer ──────────────────────────────────────────────────────────────
async function openFileViewer(filePath) {
  const modal = document.getElementById('file-viewer-modal');
  const pathEl = document.getElementById('file-viewer-path');
  const bodyEl = document.getElementById('file-viewer-body');
  pathEl.textContent = filePath; bodyEl.textContent = 'Loading...'; bodyEl.className = 'file-viewer-body'; modal.classList.add('open');
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.error) { bodyEl.textContent = `Error: ${data.error}`; return; }
    if (filePath.endsWith('.md')) { bodyEl.className = 'file-viewer-body markdown'; bodyEl.innerHTML = renderMarkdown(data.content); }
    else { bodyEl.className = 'file-viewer-body preformatted'; bodyEl.textContent = data.content; }
  } catch (err) { bodyEl.textContent = `Failed to load file: ${err.message}`; }
}
function closeFileViewer() { document.getElementById('file-viewer-modal').classList.remove('open'); }

// ─── Reference section for declarations ──────────────────────────────────────

/** @type {string|null} Declaration currently showing ref editor */
let refEditingDeclId = null;

function renderRefSection(item) {
  const ref = item.ref || {};
  const hasRef = ref.url || ref.path;
  const isEditing = refEditingDeclId === item.id;
  let html = '<div class="detail-section ref-section">';
  html += '<div class="detail-label" style="display:flex;align-items:center;justify-content:space-between">Reference';
  html += '<button class="ref-edit-toggle" id="ref-edit-toggle" style="font-size:10px;padding:2px 8px;cursor:pointer;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text-dim)">' + (isEditing ? 'Cancel' : (hasRef ? 'Edit' : '+ Add')) + '</button>';
  html += '</div>';
  if (isEditing) {
    html += '<div class="ref-editor" style="margin-top:8px">';
    html += '<label style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);display:block;margin-bottom:4px">URL</label>';
    html += '<input type="text" id="ref-url-input" class="ref-input" placeholder="https://github.com/org/repo" value="' + escHtml(ref.url || '') + '" />';
    html += '<label style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);display:block;margin-bottom:4px;margin-top:8px">Local Path</label>';
    html += '<input type="text" id="ref-path-input" class="ref-input" placeholder="/path/to/project" value="' + escHtml(ref.path || '') + '" />';
    html += '<div style="margin-top:8px;display:flex;gap:8px"><button class="ref-save-btn" id="ref-save-btn">Save</button>';
    html += '<span class="form-error" id="ref-save-error" style="color:var(--broken-color);font-size:12px;line-height:28px"></span></div></div>';
  } else if (hasRef) {
    html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">';
    if (ref.url) html += '<a href="' + escHtml(ref.url) + '" target="_blank" rel="noopener" class="ref-link-badge ref-url-badge" title="' + escHtml(ref.url) + '">' + escHtml(truncate(ref.url, 40)) + '</a>';
    if (ref.path) html += '<span class="ref-link-badge ref-path-badge" title="' + escHtml(ref.path) + '">' + escHtml(truncate(ref.path, 40)) + '</span>';
    html += '</div>';
  } else {
    html += '<div style="margin-top:6px;color:var(--text-dim);font-size:11px;opacity:0.5;font-style:italic">No reference set</div>';
  }
  html += '</div>';
  return html;
}

function wireRefSection(item) {
  const toggleBtn = document.getElementById('ref-edit-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      refEditingDeclId = (refEditingDeclId === item.id) ? null : item.id;
      renderPanelChain(item, 'declaration');
    });
  }
  const saveBtn = document.getElementById('ref-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function() {
      const urlInput = document.getElementById('ref-url-input');
      const pathInput = document.getElementById('ref-path-input');
      const errorEl = document.getElementById('ref-save-error');
      const url = urlInput ? urlInput.value.trim() : '';
      const refPath = pathInput ? pathInput.value.trim() : '';
      saveBtn.disabled = true;
      try {
        const res = await fetch('/api/declarations/' + item.id + '/ref', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url || null, path: refPath || null }),
        });
        const data = await res.json();
        if (data.error) { if (errorEl) errorEl.textContent = data.error; saveBtn.disabled = false; return; }
        item.ref = data.ref;
        refEditingDeclId = null;
        renderPanelChain(item, 'declaration');
      } catch (err) { if (errorEl) errorEl.textContent = String(err); saveBtn.disabled = false; }
    });
  }
}

// ─── Chain panel renderer ─────────────────────────────────────────────────────

/**
 * Render the sidebar with the full chain from declarations down to the clicked node.
 * Clicking a milestone shows: parent declaration(s) → the milestone.
 * Clicking an action shows: declaration(s) → parent milestone(s) → the action.
 */
function renderPanelChain(item, type) {
  if (!graphData) return;

  // If editing this declaration, render edit mode instead
  if (type === 'declaration' && editingDeclId === item.id) {
    renderDeclEditMode(item);
    return;
  }

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
      if (s.type === 'declaration') {
        if (s.item.statement) {
          html += `<div style="margin-top:14px">
            <div class="detail-label">Statement</div>
            <div class="detail-value" style="margin-top:5px">${escHtml(s.item.statement)}</div>
          </div>`;
        }
        const realizedBy = milestones.filter(m => (m.realizes || []).includes(s.item.id));
        if (realizedBy.length) {
          html += chainTagSection('Milestones', realizedBy, 'milestone');
        }

        // Reference section — display and editor
        html += renderRefSection(s.item);

        // Delete confirmation (shown inline if deleteConfirmId matches)
        if (deleteConfirmId === s.item.id) {
          html += `<div class="delete-confirm">
            <p>Delete ${escHtml(s.item.id)}? This removes it from FUTURE.md.</p>
            <div class="delete-confirm-actions">
              <button class="btn-confirm-delete" id="confirm-delete-btn">Confirm Delete</button>
              <button class="btn-confirm-cancel" id="cancel-delete-btn">Cancel</button>
            </div>
          </div>`;
        }

        // Edit / Delete buttons
        html += `<div class="decl-panel-actions">
          <button class="btn-edit" id="decl-edit-btn">Edit</button>
          <button class="btn-panel-delete" id="decl-delete-btn">Delete</button>
        </div>`;
        // Error placeholder for delete errors
        html += `<div class="form-error" id="decl-action-error" style="color:var(--broken-color);font-size:12px;margin-top:6px"></div>`;

        // Derivation panel — derive milestones for this declaration
        html += `<div class="derivation-panel" id="derivation-panel">`;
        html += `<button class="derive-btn" id="derive-btn">Derive Milestones</button>`;
        html += `<div id="derivation-log" class="output-log" style="display:none"></div>`;
        html += `<div id="derivation-proposals" style="display:none"></div>`;
        html += `</div>`;
      }
      if (s.type === 'milestone') {
        const causedBy = actions.filter(a => (a.causes || []).includes(s.item.id));
        if (causedBy.length) html += chainTagSection('Actions', causedBy, 'action');

        // Classification toggle (agent vs human)
        const mCls = s.item.classification || 'agent';
        const mIsHuman = mCls === 'human';
        html += `<div class="detail-section">
          <div class="detail-label">Classification</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <button class="classify-btn${mIsHuman ? '' : ' active'}" id="classify-agent-btn" data-cls="agent" title="Agent (automated)">\u{1F916} Agent</button>
            <button class="classify-btn${mIsHuman ? ' active' : ''}" id="classify-human-btn" data-cls="human" title="Human (requires person)">\u{1F464} Human</button>
          </div>
        </div>`;

        // Dependency editor
        const mDeps = s.item.dependsOn || [];
        const mOthers = milestones.filter(m => m.id !== s.item.id);
        html += `<div class="detail-section" id="dep-editor-section"><div class="detail-label">Dependencies</div>`;
        if (mDeps.length > 0) {
          html += `<div class="dep-list" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">`;
          mDeps.forEach(dId => {
            const dM = milestones.find(m => m.id === dId);
            html += `<span class="dep-tag" data-dep-id="${dId}" title="${escHtml(dM ? dM.title : dId)}">${escHtml(dId)}<span class="dep-remove" data-remove-dep="${dId}">&times;</span></span>`;
          });
          html += `</div>`;
        } else {
          html += `<div style="margin-top:6px;font-size:11px;color:var(--text-dim);opacity:0.5">No dependencies</div>`;
        }
        const mAvailDeps = mOthers.filter(m => !mDeps.includes(m.id));
        if (mAvailDeps.length > 0) {
          html += `<div style="margin-top:8px;display:flex;gap:6px;align-items:center">
            <select id="dep-add-select" style="flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:4px 8px;font-size:11px">
              <option value="">Add dependency...</option>
              ${mAvailDeps.map(m => `<option value="${m.id}">${m.id}: ${escHtml(truncate(m.title, 30))}</option>`).join('')}
            </select>
            <button id="dep-add-btn" class="classify-btn" style="padding:3px 10px;font-size:10px">Add</button>
          </div>`;
        }
        html += `</div>`;
      }
      if (s.type === 'action') {
        if (s.item.produces) {
          html += `<div style="margin-top:14px">
            <div class="detail-label">Produces</div>
            <div class="detail-value" style="margin-top:5px">${escHtml(s.item.produces)}</div>
          </div>`;
        }
      }

      // Wholeness section with badge and breakdown counts
      const panelWh = s.item.wholeness;
      if (panelWh) {
        let breakdownHtml = '';

        if (s.type === 'milestone') {
          // Count done vs total actions for this milestone
          const mActions = (graphData.actions || []).filter(a =>
            (a.causes || []).some(c => c === s.item.id)
          );
          const doneActions = mActions.filter(a =>
            ['DONE','KEPT','HONORED'].includes(a.status)
          ).length;
          breakdownHtml = `<div class="detail-value" style="margin-top:6px">${doneActions}/${mActions.length} actions done</div>`;
        }

        if (s.type === 'declaration') {
          // Count done vs total milestones realizing this declaration
          const realizedByDecl = (graphData.milestones || []).filter(m =>
            (m.realizes || []).some(r => r === s.item.id)
          );
          const doneMilestones = realizedByDecl.filter(m =>
            ['DONE','KEPT','HONORED'].includes(m.status)
          ).length;
          breakdownHtml = `<div class="detail-value" style="margin-top:6px">${doneMilestones}/${realizedByDecl.length} milestones done</div>`;
        }

        html += `
          <div class="detail-section">
            <div class="detail-label">Wholeness</div>
            <span class="wholeness-badge wb-${panelWh}">${panelWh}</span>
            ${breakdownHtml}
          </div>`;
      }

      if (s.type === 'milestone') {
        // Action derivation panel — derive actions for this milestone
        html += `<div class="derivation-panel" id="action-derivation-panel">`;
        html += `<button class="derive-btn" id="action-derive-btn">Derive Actions</button>`;
        html += `<div id="action-derivation-log" class="output-log" style="display:none"></div>`;
        html += `<div id="action-derivation-proposals" style="display:none"></div>`;
        html += `</div>`;

        // Execution log viewer — filled asynchronously after render
        html += `<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
          <div class="detail-label" style="display:flex;align-items:center;justify-content:space-between">
            Execution Log
            <button id="refresh-log-btn" style="font-size:10px;padding:2px 8px;cursor:pointer;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;color:var(--text-dim)" title="Refresh log">&#8635;</button>
          </div>
          <pre id="milestone-exec-log" class="output-log" style="margin-top:8px;max-height:300px;overflow-y:auto;font-size:11px;white-space:pre-wrap;word-break:break-all"></pre>
        </div>`;
      }

      if (s.type === 'action') {
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

  // Wire reference section handlers
  const focusSectionForRef = sections.find(s => s.role === 'focus');
  if (focusSectionForRef && focusSectionForRef.type === 'declaration') {
    wireRefSection(focusSectionForRef.item);
  }

  // Wire declaration Edit/Delete buttons
  const focusSection = sections.find(s => s.role === 'focus');
  if (focusSection && focusSection.type === 'declaration') {
    const editBtn = document.getElementById('decl-edit-btn');
    const deleteBtn = document.getElementById('decl-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        editingDeclId = focusSection.item.id;
        renderPanelChain(focusSection.item, 'declaration');
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        deleteConfirmId = focusSection.item.id;
        renderPanelChain(focusSection.item, 'declaration');
      });
    }
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => {
        deleteDeclaration(focusSection.item.id);
      });
    }
    if (cancelDeleteBtn) {
      cancelDeleteBtn.addEventListener('click', () => {
        deleteConfirmId = null;
        renderPanelChain(focusSection.item, 'declaration');
      });
    }

    // Wire derive button
    const deriveBtn = document.getElementById('derive-btn');
    if (deriveBtn) {
      deriveBtn.addEventListener('click', () => startDerivation(focusSection.item.id));
    }
  }

  // If a milestone is focused, wire action derive button and fetch log
  if (focusSection && focusSection.type === 'milestone') {
    const actionDeriveBtn = document.getElementById('action-derive-btn');
    if (actionDeriveBtn) {
      actionDeriveBtn.addEventListener('click', () => startActionDerivation(focusSection.item.id));
    }

    // Wire classification toggle buttons
    const classAgentBtn = document.getElementById('classify-agent-btn');
    const classHumanBtn = document.getElementById('classify-human-btn');
    if (classAgentBtn) classAgentBtn.addEventListener('click', () => setClassification(focusSection.item.id, 'agent'));
    if (classHumanBtn) classHumanBtn.addEventListener('click', () => setClassification(focusSection.item.id, 'human'));

    // Wire dependency editor
    const depAddBtn = document.getElementById('dep-add-btn');
    if (depAddBtn) {
      depAddBtn.addEventListener('click', () => {
        const sel = document.getElementById('dep-add-select');
        if (sel && sel.value) addDependency(focusSection.item.id, sel.value);
      });
    }
    // Wire remove buttons on existing deps
    $panelBody.querySelectorAll('.dep-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeDependency(focusSection.item.id, btn.dataset.removeDep);
      });
    });
    // Wire dep tag clicks to navigate to that milestone
    $panelBody.querySelectorAll('.dep-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        selectNode(tag.dataset.depId, 'milestone');
      });
    });

    loadMilestoneLog(focusSection.item.id);
    const refreshLogBtn = document.getElementById('refresh-log-btn');
    if (refreshLogBtn) {
      refreshLogBtn.addEventListener('click', () => loadMilestoneLog(focusSection.item.id));
    }
  }

  // If an action is focused, fetch and render its exec-plan
  if (focusSection && focusSection.type === 'action') {
    loadExecPlan(focusSection.item.id);
  }

  // If the focused node is not whole, fetch and render workability path
  if (focusSection && focusSection.item.wholeness && focusSection.item.wholeness !== 'whole') {
    renderWorkabilityPath(focusSection.item.id, focusSection.type);
  }
}

/**
 * Fetch the execution log for a milestone and display it in the log viewer.
 * @param {string} milestoneId
 */
async function loadMilestoneLog(milestoneId) {
  const logEl = document.getElementById('milestone-exec-log');
  if (!logEl) return;
  try {
    const res = await fetch(`/api/milestone/${encodeURIComponent(milestoneId)}/log`);
    const text = await res.text();
    if (text.trim()) {
      logEl.textContent = text;
      logEl.scrollTop = logEl.scrollHeight;
    } else {
      logEl.innerHTML = '<span style="opacity:0.4;font-style:italic">No execution log yet</span>';
    }
  } catch (e) {
    logEl.innerHTML = '<span style="opacity:0.4;font-style:italic">Could not load log</span>';
  }
}

// ─── Declaration inline edit mode ──────────────────────────────────────────

/**
 * Render the declaration detail panel in edit mode.
 * @param {any} item - the declaration object
 */
function renderDeclEditMode(item) {
  const status = item.status || 'PENDING';
  const statuses = ['PENDING', 'ACTIVE', 'DONE', 'HONORED', 'KEPT'];

  const optionsHtml = statuses.map(s =>
    `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`
  ).join('');

  const errorHtml = editFormError
    ? `<div class="form-error" id="edit-decl-error" style="color:var(--broken-color);font-size:12px;margin-top:8px">${escHtml(editFormError)}</div>`
    : '<div class="form-error" id="edit-decl-error" style="color:var(--broken-color);font-size:12px;margin-top:8px"></div>';

  const saveLabel = editFormLoading ? 'Saving...' : 'Save';
  const disabledAttr = editFormLoading ? 'disabled' : '';

  $panelBody.innerHTML = `
    <div class="detail-id">DECLARATION &middot; ${escHtml(item.id)}</div>
    <div class="decl-edit-mode">
      <label>Title</label>
      <input id="edit-decl-title" value="${escHtml(item.title || '')}" ${disabledAttr} />
      <label>Statement</label>
      <textarea id="edit-decl-statement" rows="4" ${disabledAttr}>${escHtml(item.statement || '')}</textarea>
      <label>Status</label>
      <select id="edit-decl-status" class="decl-status-select" ${disabledAttr}>
        ${optionsHtml}
      </select>
      <div class="decl-edit-actions">
        <button class="btn-save" id="edit-decl-save" ${disabledAttr}>${saveLabel}</button>
        <button class="btn-cancel" id="edit-decl-cancel">Cancel</button>
      </div>
      ${errorHtml}
    </div>
  `;

  // Wire save button
  const $save = document.getElementById('edit-decl-save');
  if ($save) $save.addEventListener('click', () => saveDeclEdit(item.id));

  // Wire cancel button
  const $cancel = document.getElementById('edit-decl-cancel');
  if ($cancel) {
    $cancel.addEventListener('click', () => {
      editingDeclId = null;
      editFormError = null;
      editFormLoading = false;
      // Re-render the panel with the original item
      selectNode(item.id, 'declaration');
    });
  }

  // Wire Cmd/Ctrl+Enter in textarea to save
  const $stmt = document.getElementById('edit-decl-statement');
  if ($stmt) {
    $stmt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveDeclEdit(item.id);
      }
    });
  }

  // Auto-focus the title input
  const $title = document.getElementById('edit-decl-title');
  if ($title && !editFormLoading) {
    requestAnimationFrame(() => $title.focus());
  }
}

/**
 * Save declaration edits via PUT /api/declarations/:id.
 * @param {string} id - declaration ID
 */
async function saveDeclEdit(id) {
  if (editFormLoading) return;

  const $title = document.getElementById('edit-decl-title');
  const $stmt  = document.getElementById('edit-decl-statement');
  const $status = document.getElementById('edit-decl-status');

  const title     = ($title ? $title.value : '').trim();
  const statement = ($stmt  ? $stmt.value  : '').trim();
  const status    = $status ? $status.value : 'PENDING';

  // Validate
  if (!title) {
    editFormError = 'Title is required';
    const item = graphData ? graphData.declarations.find(d => d.id === id) : null;
    if (item) renderDeclEditMode(item);
    return;
  }
  if (!statement) {
    editFormError = 'Statement is required';
    const item = graphData ? graphData.declarations.find(d => d.id === id) : null;
    if (item) renderDeclEditMode(item);
    return;
  }

  // Set loading state
  editFormLoading = true;
  editFormError = null;
  const item = graphData ? graphData.declarations.find(d => d.id === id) : null;
  if (item) renderDeclEditMode(item);

  try {
    const res = await fetch('/api/declarations/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, statement, status }),
    });

    if (res.ok) {
      editingDeclId = null;
      editFormLoading = false;
      editFormError = null;
      await loadData();
      // Re-select the node to refresh panel
      if (selectedNodeId === id && graphData) {
        const updated = graphData.declarations.find(d => d.id === id);
        if (updated) {
          renderPanelChain(updated, 'declaration');
        }
      }
    } else {
      const data = await res.json().catch(() => ({}));
      editFormError = data.error || `Server error (${res.status})`;
      editFormLoading = false;
      const currentItem = graphData ? graphData.declarations.find(d => d.id === id) : null;
      if (currentItem) renderDeclEditMode(currentItem);
    }
  } catch (err) {
    editFormError = err.message || 'Network error';
    editFormLoading = false;
    const currentItem = graphData ? graphData.declarations.find(d => d.id === id) : null;
    if (currentItem) renderDeclEditMode(currentItem);
  }
}

/**
 * Delete a declaration via DELETE /api/declarations/:id.
 * @param {string} id - declaration ID
 */
async function deleteDeclaration(id) {
  try {
    const res = await fetch('/api/declarations/' + encodeURIComponent(id), {
      method: 'DELETE',
    });

    if (res.ok) {
      deleteConfirmId = null;
      selectedNodeId = null;
      editingDeclId = null;
      if ($panelEmpty) $panelEmpty.style.display = '';
      $panelBody.innerHTML = '';
      $panelBody.appendChild($panelEmpty);
      await loadData();
    } else {
      const data = await res.json().catch(() => ({}));
      deleteConfirmId = null;
      // Show error in the panel
      const errorEl = document.getElementById('decl-action-error');
      if (errorEl) {
        errorEl.textContent = data.error || `Could not delete (${res.status})`;
      } else {
        // Re-render and show error
        const currentItem = graphData ? graphData.declarations.find(d => d.id === id) : null;
        if (currentItem) {
          renderPanelChain(currentItem, 'declaration');
          const err2 = document.getElementById('decl-action-error');
          if (err2) err2.textContent = data.error || `Could not delete (${res.status})`;
        }
      }
    }
  } catch (err) {
    deleteConfirmId = null;
    const errorEl = document.getElementById('decl-action-error');
    if (errorEl) {
      errorEl.textContent = err.message || 'Network error';
    }
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
 * Fetch the workability path for a node and render it in the detail panel.
 * Shows "Path to wholeness (N steps)" with actionable fix steps sorted by impact.
 * Silently skips on any error or if the node is already whole.
 * @param {string} nodeId
 * @param {string} nodeType
 */
async function renderWorkabilityPath(nodeId, nodeType) {
  try {
    const res = await fetch(`/api/workability/${encodeURIComponent(nodeId)}`);
    if (!res.ok) return;

    const data = await res.json();
    if (!data || !data.steps || data.steps.length === 0) return;
    if (data.wholeness === 'whole') return;

    const impactWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    const steps = data.steps.slice().sort((a, b) => {
      const wa = impactWeight[(a.impact || '').toLowerCase()] || 0;
      const wb = impactWeight[(b.impact || '').toLowerCase()] || 0;
      return wb - wa;
    });

    let html = `<div class="workability-path">`;
    html += `<div class="wp-header">Path to wholeness (${steps.length} steps)</div>`;

    steps.forEach(step => {
      const impactLevel = (step.impact || 'medium').toLowerCase();
      const validLevels = ['high', 'medium', 'low', 'critical'];
      const badgeClass = validLevels.includes(impactLevel) ? impactLevel : 'medium';
      const cssClass = badgeClass === 'critical' ? 'high' : badgeClass;

      html += `<div class="wp-step">
        <span class="wp-step-action" data-node-id="${escHtml(step.actionId)}" data-node-type="action">${escHtml(step.actionId)}</span>
        <div class="wp-step-body">
          <div class="wp-step-title">${escHtml(step.title || step.actionId)}</div>
          <div class="wp-step-milestone">${escHtml(step.milestone || '')}</div>
        </div>
        <span class="wp-impact impact-${cssClass}">${escHtml(step.impact || 'medium')}</span>
      </div>`;
    });

    html += `</div>`;

    const execPlanEl = $panelBody.querySelector('#exec-plan-detail');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const wpEl = tempDiv.firstElementChild;

    if (execPlanEl) {
      execPlanEl.parentNode.insertBefore(wpEl, execPlanEl);
    } else {
      $panelBody.appendChild(wpEl);
    }

    wpEl.querySelectorAll('.wp-step-action').forEach(el => {
      el.addEventListener('click', () => {
        const actionId = el.dataset.nodeId;
        const actionType = el.dataset.nodeType;
        if (actionId && actionType) selectNode(actionId, actionType);
      });
    });
  } catch (_) {
    // Silently skip
  }
}

/**
 * Convert an ISO date string to a human-readable relative time like "2d ago".
 * @param {string} dateStr
 * @returns {string}
 */
function relativeDate(dateStr) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  } catch (_) {
    return '';
  }
}

/**
 * Extract file paths from SUMMARY.md content.
 * Looks for "## Files" or "## Key Files" style sections and extracts backtick-wrapped paths.
 * @param {string} summaryContent
 * @returns {string[]}
 */
function extractProducedFiles(summaryContent) {
  if (!summaryContent) return [];
  const files = [];
  const lines = summaryContent.split('\n');
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+(Files|Key.?Files|Files\s+(Created|Modified|Produced))/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break;
    if (inSection) {
      const m = line.match(/`([^`]+\.[a-zA-Z]+)`/);
      if (m) files.push(m[1]);
    }
  }
  return files;
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

    // Model badge
    let modelBadgeHtml = '';
    if (data.model) {
      const mu = String(data.model).toUpperCase();
      const mc = { OPUS: '#a78bfa', SONNET: '#60a5fa', HAIKU: '#34d399' }[mu] || 'var(--text-dim)';
      const mb = { OPUS: 'rgba(167,139,250,0.12)', SONNET: 'rgba(96,165,250,0.12)', HAIKU: 'rgba(52,211,153,0.12)' }[mu] || 'var(--surface2)';
      modelBadgeHtml = `<span class="model-badge" style="background:${mb};color:${mc};border:1px solid ${mc}33;border-radius:5px;padding:2px 7px;font-size:9px;font-weight:800;letter-spacing:0.08em;font-family:monospace">${mu}</span>`;
    }

    if (metaParts.length || modelBadgeHtml) {
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;align-items:center">
        ${modelBadgeHtml}
        ${metaParts.map(p => `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:600;color:var(--text-dim)">${p}</span>`).join('')}
      </div>`;
    }

    // Commits section
    if (data.commits && data.commits.length > 0) {
      const commitRows = data.commits.map(c => {
        const rd = c.date ? relativeDate(c.date) : '';
        return `<div style="display:flex;align-items:baseline;gap:8px;font-size:11px">
          <a href="#" class="commit-link" data-sha="${escHtml(c.sha)}" data-short="${escHtml(c.shortSha)}"
             style="font-family:monospace;font-size:11px;font-weight:700;color:#60a5fa;text-decoration:none;letter-spacing:0.03em"
             title="Click to copy full SHA">${escHtml(c.shortSha)}</a>
          <span style="color:var(--text-dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.message)}</span>
          <span style="color:var(--text-dim);opacity:0.5;font-size:10px;white-space:nowrap">${rd}</span>
        </div>`;
      }).join('');
      html += `<div style="margin-bottom:14px">
        <div class="detail-label">Commits (${data.commits.length})</div>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
          ${commitRows}
        </div>
      </div>`;
    }

    // Execute / Stop button
    const actionItem = graphData ? graphData.actions.find(a => a.id === actionId) : null;
    const actionStatus = actionItem ? (actionItem.status || 'PENDING') : 'PENDING';
    const isCompleted = COMPLETED.has(actionStatus);
    const isRunning = runningActions.has(actionId);
    const reviewState = actionItem ? (actionItem.reviewState || 'draft') : 'draft';
    const isApproved = reviewState === 'approved';

    if (!isCompleted) {
      if (isRunning) {
        html += `<div style="margin-bottom:14px"><button class="exec-btn stop" id="stop-action-btn" data-action-id="${actionId}">&#9632; Stop</button></div>`;
      } else if (!isApproved) {
        html += `<div style="margin-bottom:14px"><button class="exec-btn" id="exec-action-btn" data-action-id="${actionId}" disabled title="Plan must be approved before execution (currently: ${reviewState})">&#9654; Execute</button></div>`;
      } else {
        html += `<div style="margin-bottom:14px"><button class="exec-btn" id="exec-action-btn" data-action-id="${actionId}">&#9654; Execute</button></div>`;
      }
    }

    // Files modified
    if (ep.filesModified && ep.filesModified.length) {
      html += `<div style="margin-bottom:14px">
        <div class="detail-label">Files</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
          ${ep.filesModified.map(f => `<span class="file-link" style="background:var(--act-bg);border:1px solid var(--act-border);color:var(--act-color);border-radius:4px;padding:2px 7px;font-size:10px;font-family:monospace" data-file-path="${escHtml(f)}">${escHtml(f)}</span>`).join('')}
        </div>
      </div>`;
    }

    // Produced files (from SUMMARY.md)
    const producedFiles = extractProducedFiles(data.summaryContent);
    if (producedFiles.length) {
      html += `<div style="margin-bottom:14px">
        <div class="detail-label">Files produced</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
          ${producedFiles.map(f => `<span style="background:var(--done-bg);border:1px solid var(--done-border);color:var(--done-color);border-radius:4px;padding:2px 7px;font-size:10px;font-family:monospace">${escHtml(f)}</span>`).join('')}
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

    // Output log panel (hidden by default, shown when executing)
    html += `<div id="output-log" class="output-log" style="display:none"></div>`;

    container.innerHTML = html || `<div class="detail-label" style="opacity:0.4">No exec-plan details</div>`;

    // Wire button click handlers
    const execBtn = document.getElementById('exec-action-btn');
    if (execBtn) {
      execBtn.addEventListener('click', () => executeAction(actionId));
    }
    const stopBtn = document.getElementById('stop-action-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => stopAction(actionId));
    }

    // Wire commit SHA copy-to-clipboard
    container.querySelectorAll('.commit-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const sha = link.dataset.sha;
        const shortSha = link.dataset.short;
        navigator.clipboard.writeText(sha).then(() => {
          link.textContent = 'Copied!';
          setTimeout(() => { link.textContent = shortSha; }, 1500);
        });
      });
    });

    // Wire file link clicks to open file viewer
    container.querySelectorAll('.file-link').forEach(link => {
      link.addEventListener('click', () => {
        const fp = link.dataset.filePath;
        if (fp) openFileViewer(fp);
      });
    });

    // If action is already running, show log and subscribe immediately
    if (isRunning) {
      subscribeToOutput(actionId);
    }

  } catch (e) {
    if (container) container.innerHTML = `<div class="detail-label" style="opacity:0.4">Could not load exec-plan</div>`;
  }
}

// ─── Execution controls ───────────────────────────────────────────────────────

/**
 * Trigger action execution via POST /api/action/:id/execute.
 * @param {string} actionId
 */
async function executeAction(actionId) {
  const btn = document.getElementById('exec-action-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '&#9654; Running...';
  }

  try {
    const res = await fetch(`/api/action/${encodeURIComponent(actionId)}/execute`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      // Show error in output log
      const logEl = document.getElementById('output-log');
      if (logEl) {
        logEl.style.display = '';
        logEl.textContent = `Error: ${data.error || 'Failed to start execution'}`;
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '&#9654; Execute';
      }
      return;
    }

    runningActions.add(actionId);
    updateRunningIndicators();
    subscribeToOutput(actionId);

    // Re-render exec plan panel to show Stop button instead of Execute
    loadExecPlan(actionId);
  } catch (err) {
    const logEl = document.getElementById('output-log');
    if (logEl) {
      logEl.style.display = '';
      logEl.textContent = `Error: ${err.message}`;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '&#9654; Execute';
    }
  }
}

/**
 * Stop a running action via POST /api/action/:id/stop.
 * @param {string} actionId
 */
async function stopAction(actionId) {
  const btn = document.getElementById('stop-action-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '&#9632; Stopping...';
  }

  try {
    await fetch(`/api/action/${encodeURIComponent(actionId)}/stop`, { method: 'POST' });
  } catch (_) {
    // Will be handled by action-complete event
  }
}

/**
 * Subscribe to SSE output for a given action.
 * Shows the output log panel and sets currentOutputActionId so SSE events route here.
 * @param {string} actionId
 */
function subscribeToOutput(actionId) {
  currentOutputActionId = actionId;
  const logEl = document.getElementById('output-log');
  if (logEl) {
    logEl.style.display = '';
    logEl.innerHTML = '';
  }
}

/**
 * Handle incoming action-output SSE event.
 * @param {MessageEvent} e
 */
function handleActionOutput(e) {
  try {
    const { actionId, text } = JSON.parse(e.data);
    if (actionId !== currentOutputActionId) return;
    const logEl = document.getElementById('output-log');
    if (!logEl) return;
    logEl.appendChild(document.createTextNode(text + '\n'));
    logEl.scrollTop = logEl.scrollHeight;
  } catch (_) {}
}

/**
 * Handle incoming action-complete SSE event.
 * @param {MessageEvent} e
 */
function handleActionComplete(e) {
  try {
    const { actionId, exitCode } = JSON.parse(e.data);
    if (actionId !== currentOutputActionId) return;

    // Show exit code in log
    const logEl = document.getElementById('output-log');
    if (logEl) {
      const span = document.createElement('span');
      span.className = `exit-code ${exitCode === 0 ? 'success' : 'failure'}`;
      span.textContent = `Process exited with code ${exitCode}`;
      logEl.appendChild(span);
      logEl.scrollTop = logEl.scrollHeight;
    }

    // Update state
    runningActions.delete(actionId);
    updateRunningIndicators();
    currentOutputActionId = null;

    // Refresh graph and re-render the panel
    loadData();
    loadExecPlan(actionId);
  } catch (_) {}
}

// ─── Play controls ────────────────────────────────────────────────────────────

/**
 * Start play: execute all ready agent milestones in wave order.
 */
async function startPlay() {
  const btn = document.getElementById('play-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Starting...';
  }

  try {
    const res = await fetch('/api/play', { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      if (btn) { btn.disabled = false; btn.textContent = 'Play All'; }
      alert('Play error: ' + data.error);
      return;
    }
    playRunning = true;
    updatePlayUI();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Play All'; }
    alert('Failed to start play: ' + err);
  }
}

/**
 * Stop the running play sequence.
 */
async function stopPlay() {
  try {
    await fetch('/api/play/stop', { method: 'POST' });
  } catch (_) {}
}

/**
 * Update play button and banner based on current play state.
 */
function updatePlayUI() {
  const btn = document.getElementById('play-btn');
  const banner = document.getElementById('play-banner');

  if (btn) {
    if (playRunning) {
      btn.textContent = 'Playing...';
      btn.disabled = true;
      btn.title = '';
      btn.classList.add('playing');
    } else {
      // Check for unapproved non-DONE actions
      const nonDoneActions = (graphData && graphData.actions || []).filter(a => !COMPLETED.has((a.status || '').toUpperCase()));
      const unapproved = nonDoneActions.filter(a => (a.reviewState || 'draft') !== 'approved');
      if (unapproved.length > 0) {
        btn.textContent = 'Play All';
        btn.disabled = true;
        btn.title = `${unapproved.length} plan(s) need approval before execution`;
        btn.classList.remove('playing');
      } else {
        btn.textContent = 'Play All';
        btn.disabled = false;
        btn.title = 'Execute all ready agent milestones in dependency order';
        btn.classList.remove('playing');
      }
    }
  }

  if (banner) {
    if (playRunning && playStatus) {
      banner.classList.add('visible');
      const waveLabel = document.getElementById('play-wave-label');
      if (waveLabel) {
        waveLabel.textContent = `Wave ${playStatus.currentWave}/${playStatus.totalWaves}`;
      }
      const actionsList = document.getElementById('play-actions-list');
      if (actionsList) {
        actionsList.innerHTML = '';
        for (const aId of (playStatus.activeActions || [])) {
          const tag = document.createElement('span');
          tag.className = 'play-action-tag active';
          tag.textContent = aId;
          actionsList.appendChild(tag);
        }
        for (const aId of (playStatus.completedActions || [])) {
          const tag = document.createElement('span');
          tag.className = 'play-action-tag done';
          tag.textContent = aId;
          actionsList.appendChild(tag);
        }
        for (const aId of (playStatus.failedActions || [])) {
          const tag = document.createElement('span');
          tag.className = 'play-action-tag failed';
          tag.textContent = aId;
          actionsList.appendChild(tag);
        }
      }
    } else {
      banner.classList.remove('visible');
    }
  }
}

/**
 * Handle play-start SSE event.
 * @param {MessageEvent} e
 */
function handlePlayStart(e) {
  try {
    const data = JSON.parse(e.data);
    playRunning = true;
    playStatus = {
      currentWave: 0,
      totalWaves: data.totalWaves,
      activeActions: [],
      completedActions: [],
      failedActions: [],
    };
    updatePlayUI();
  } catch (_) {}
}

/**
 * Handle play-wave-start SSE event.
 * @param {MessageEvent} e
 */
function handlePlayWaveStart(e) {
  try {
    const data = JSON.parse(e.data);
    if (playStatus) {
      playStatus.currentWave = data.wave;
      playStatus.activeActions = [];
      for (const m of (data.milestones || [])) {
        for (const aId of (m.actions || [])) {
          playStatus.activeActions.push(aId);
        }
      }
    }
    updatePlayUI();
  } catch (_) {}
}

/**
 * Handle play-wave-complete SSE event.
 * @param {MessageEvent} e
 */
function handlePlayWaveComplete(e) {
  try {
    const data = JSON.parse(e.data);
    if (playStatus) {
      playStatus.activeActions = [];
      for (const aId of (data.completed || [])) {
        playStatus.completedActions.push(aId);
      }
      for (const aId of (data.failed || [])) {
        playStatus.failedActions.push(aId);
      }
    }
    updatePlayUI();
    loadData(); // refresh graph after each wave
  } catch (_) {}
}

/**
 * Handle play-complete SSE event.
 * @param {MessageEvent} e
 */
function handlePlayComplete(e) {
  try {
    const data = JSON.parse(e.data);
    playRunning = false;
    // Keep playStatus briefly for display, then clear
    setTimeout(() => {
      playStatus = null;
      updatePlayUI();
    }, 3000);
    updatePlayUI();
    loadData(); // final refresh
  } catch (_) {}
}

// ─── Derivation controls ──────────────────────────────────────────────────────

/**
 * Trigger milestone derivation for a declaration via POST /api/milestones/derive.
 * @param {string} declarationId
 */
async function startDerivation(declarationId) {
  const btn = document.getElementById('derive-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Deriving...';
  }

  const logEl = document.getElementById('derivation-log');
  if (logEl) {
    logEl.style.display = '';
    logEl.innerHTML = '';
  }

  try {
    const res = await fetch('/api/milestones/derive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ declarationId }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (logEl) logEl.textContent = 'Error: ' + (data.error || 'Failed to start derivation');
      if (btn) { btn.disabled = false; btn.textContent = 'Derive Milestones'; }
      return;
    }

    derivationSessionId = data.sessionId;
    derivationProposals = null;
  } catch (err) {
    if (logEl) logEl.textContent = 'Error: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Derive Milestones'; }
  }
}

/**
 * Handle incoming derivation-output SSE event.
 * @param {MessageEvent} e
 */
function handleDerivationOutput(e) {
  try {
    const { sessionId, text } = JSON.parse(e.data);
    if (sessionId !== derivationSessionId) return;
    const logEl = document.getElementById('derivation-log');
    if (!logEl) return;
    logEl.appendChild(document.createTextNode(text + '\n'));
    logEl.scrollTop = logEl.scrollHeight;
  } catch (_) {}
}

/**
 * Handle incoming derivation-complete SSE event.
 * @param {MessageEvent} e
 */
function handleDerivationComplete(e) {
  try {
    const { sessionId, exitCode, milestones } = JSON.parse(e.data);
    if (sessionId !== derivationSessionId) return;

    derivationSessionId = null;

    const btn = document.getElementById('derive-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Derive Milestones'; }

    if (exitCode !== 0) {
      const logEl = document.getElementById('derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--broken-color)';
        span.style.fontWeight = '700';
        span.textContent = '\nDerivation failed (exit code ' + exitCode + ')';
        logEl.appendChild(span);
      }
      return;
    }

    if (milestones && Array.isArray(milestones)) {
      derivationProposals = milestones;
      renderProposals();
    } else {
      const logEl = document.getElementById('derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--integrity-partial)';
        span.style.fontWeight = '600';
        span.textContent = '\nDerivation finished but output could not be parsed. Check the log above.';
        logEl.appendChild(span);
      }
    }
  } catch (_) {}
}

/**
 * Render proposed milestones as an editable checklist.
 */
function renderProposals() {
  const container = document.getElementById('derivation-proposals');
  if (!container || !derivationProposals) return;
  container.style.display = 'block';

  let html = '<h4 style="margin:8px 0;color:var(--text-bright);font-size:13px">Proposed Milestones</h4>';
  html += '<ul class="derivation-checklist">';
  derivationProposals.forEach((m, idx) => {
    html += '<li>';
    html += '<input type="checkbox" checked data-idx="' + idx + '">';
    html += '<input type="text" value="' + escHtml(m.title || '') + '" data-idx="' + idx + '">';
    html += '</li>';
    if (m.reason) {
      html += '<li style="border-bottom:none;padding:0"><span class="reason">' + escHtml(m.reason) + '</span></li>';
    }
  });
  html += '</ul>';
  html += '<div style="margin-top:12px">';
  html += '<button class="derive-accept-btn" onclick="acceptDerivation()">Accept Selected</button>';
  html += '<button class="derive-cancel-btn" onclick="cancelDerivation()">Cancel</button>';
  html += '</div>';

  container.innerHTML = html;
}

/**
 * Accept selected milestones from the derivation checklist.
 * Gathers checked items, POSTs to /api/milestones/derive/accept.
 */
async function acceptDerivation() {
  const container = document.getElementById('derivation-proposals');
  if (!container || !derivationProposals) return;

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const textInputs = container.querySelectorAll('input[type="text"]');

  /** @type {Array<{title: string, realizes: string}>} */
  const selected = [];
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.idx, 10);
      const titleInput = textInputs[idx];
      const proposal = derivationProposals[idx];
      if (proposal && titleInput) {
        selected.push({
          title: titleInput.value || proposal.title,
          realizes: proposal.realizes || '',
        });
      }
    }
  });

  if (selected.length === 0) {
    cancelDerivation();
    return;
  }

  try {
    const res = await fetch('/api/milestones/derive/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestones: selected }),
    });
    const data = await res.json();

    if (!res.ok) {
      const logEl = document.getElementById('derivation-log');
      if (logEl) logEl.textContent += '\nError accepting: ' + (data.error || 'Unknown error');
      return;
    }

    // Clear derivation panel and show success
    derivationProposals = null;
    const panel = document.getElementById('derivation-panel');
    if (panel) {
      panel.innerHTML = '<div style="color:var(--act-color);font-weight:600;padding:8px 0">' +
        selected.length + ' milestone' + (selected.length !== 1 ? 's' : '') + ' created</div>';
      setTimeout(() => { if (panel) panel.innerHTML = ''; }, 3000);
    }
    // SSE change event will trigger graph reload automatically
  } catch (err) {
    const logEl = document.getElementById('derivation-log');
    if (logEl) logEl.textContent += '\nError: ' + err.message;
  }
}

/**
 * Cancel derivation — stop if running, clear proposals and panel.
 */
async function cancelDerivation() {
  if (derivationSessionId) {
    try {
      await fetch('/api/milestones/derive/stop', { method: 'POST' });
    } catch (_) {}
  }

  derivationSessionId = null;
  derivationProposals = null;

  const logEl = document.getElementById('derivation-log');
  if (logEl) { logEl.style.display = 'none'; logEl.innerHTML = ''; }

  const proposals = document.getElementById('derivation-proposals');
  if (proposals) { proposals.style.display = 'none'; proposals.innerHTML = ''; }

  const btn = document.getElementById('derive-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Derive Milestones'; }
}

/**
 * Stop a running derivation via POST /api/milestones/derive/stop.
 */
async function stopDerivation() {
  const btn = document.getElementById('derive-btn');
  if (btn) { btn.textContent = 'Stopping...'; }

  try {
    await fetch('/api/milestones/derive/stop', { method: 'POST' });
  } catch (_) {}
}

// ─── Classification & Dependency helpers ──────────────────────────────────────

async function setClassification(milestoneId, classification) {
  try {
    const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/classify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification }),
    });
    if (res.ok) {
      await loadData();
      if (selectedNodeId === milestoneId && graphData) {
        const updated = graphData.milestones.find(m => m.id === milestoneId);
        if (updated) renderPanelChain(updated, 'milestone');
      }
    }
  } catch (_) {}
}

async function addDependency(milestoneId, depId) {
  if (!graphData) return;
  const m = graphData.milestones.find(x => x.id === milestoneId);
  if (!m) return;
  await saveDependencies(milestoneId, [...(m.dependsOn || []), depId]);
}

async function removeDependency(milestoneId, depId) {
  if (!graphData) return;
  const m = graphData.milestones.find(x => x.id === milestoneId);
  if (!m) return;
  await saveDependencies(milestoneId, (m.dependsOn || []).filter(d => d !== depId));
}

async function saveDependencies(milestoneId, dependsOn) {
  try {
    const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/depends-on`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependsOn }),
    });
    if (res.ok) {
      await loadData();
      if (selectedNodeId === milestoneId && graphData) {
        const updated = graphData.milestones.find(m => m.id === milestoneId);
        if (updated) renderPanelChain(updated, 'milestone');
      }
    }
  } catch (_) {}
}

// ─── Focus mode — FLIP technique ──────────────────────────────────────────────
// Exiting nodes: removed from flow instantly (→ flex re-centers), then overlaid
// at their original positions via position:fixed for the directional slide-out.
// Subtree nodes: FLIP'd from old positions to new centered positions simultaneously.

// ─── Action Derivation controls ────────────────────────────────────────────────

async function startActionDerivation(milestoneId) {
  const btn = document.getElementById('action-derive-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Deriving...'; }
  const logEl = document.getElementById('action-derivation-log');
  if (logEl) { logEl.style.display = ''; logEl.innerHTML = ''; }
  try {
    const res = await fetch('/api/milestones/' + encodeURIComponent(milestoneId) + '/actions/derive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      if (logEl) logEl.textContent = 'Error: ' + (data.error || 'Failed to start action derivation');
      if (btn) { btn.disabled = false; btn.textContent = 'Derive Actions'; }
      return;
    }
    actionDerivationSessionId = data.sessionId;
    actionDerivationMilestoneId = milestoneId;
    actionDerivationProposals = null;
  } catch (err) {
    if (logEl) logEl.textContent = 'Error: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Derive Actions'; }
  }
}

function handleActionDerivationOutput(e) {
  try {
    const { sessionId, text } = JSON.parse(e.data);
    if (sessionId !== actionDerivationSessionId) return;
    const logEl = document.getElementById('action-derivation-log');
    if (!logEl) return;
    logEl.appendChild(document.createTextNode(text + '\n'));
    logEl.scrollTop = logEl.scrollHeight;
  } catch (_) {}
}

function handleActionDerivationComplete(e) {
  try {
    const { sessionId, exitCode, actions } = JSON.parse(e.data);
    if (sessionId !== actionDerivationSessionId) return;
    actionDerivationSessionId = null;
    const btn = document.getElementById('action-derive-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Derive Actions'; }
    if (exitCode !== 0) {
      const logEl = document.getElementById('action-derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--broken-color)';
        span.style.fontWeight = '700';
        span.textContent = '\nAction derivation failed (exit code ' + exitCode + ')';
        logEl.appendChild(span);
      }
      return;
    }
    if (actions && Array.isArray(actions)) {
      actionDerivationProposals = actions;
      renderActionProposals();
    } else {
      const logEl = document.getElementById('action-derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--integrity-partial)';
        span.style.fontWeight = '600';
        span.textContent = '\nDerivation finished but output could not be parsed. Check the log above.';
        logEl.appendChild(span);
      }
    }
  } catch (_) {}
}

function renderActionProposals() {
  const container = document.getElementById('action-derivation-proposals');
  if (!container || !actionDerivationProposals) return;
  container.style.display = 'block';
  let html = '<h4 style="margin:8px 0;color:var(--text-bright);font-size:13px">Proposed Actions</h4>';
  html += '<ul class="derivation-checklist">';
  actionDerivationProposals.forEach((a, idx) => {
    html += '<li>';
    html += '<input type="checkbox" checked data-idx="' + idx + '">';
    html += '<input type="text" value="' + escHtml(a.title || '') + '" data-idx="' + idx + '">';
    html += '</li>';
    if (a.produces) {
      html += '<li style="border-bottom:none;padding:0"><span class="reason">Produces: ' + escHtml(a.produces) + '</span></li>';
    }
    if (a.reason) {
      html += '<li style="border-bottom:none;padding:0"><span class="reason">' + escHtml(a.reason) + '</span></li>';
    }
  });
  html += '</ul>';
  html += '<div style="margin-top:12px">';
  html += '<button class="derive-accept-btn" onclick="acceptActionDerivation()">Accept Selected</button>';
  html += '<button class="derive-cancel-btn" onclick="cancelActionDerivation()">Cancel</button>';
  html += '</div>';
  container.innerHTML = html;
}

async function acceptActionDerivation() {
  const container = document.getElementById('action-derivation-proposals');
  if (!container || !actionDerivationProposals || !actionDerivationMilestoneId) return;
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const textInputs = container.querySelectorAll('input[type="text"]');
  const selected = [];
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.idx, 10);
      const titleInput = textInputs[idx];
      const proposal = actionDerivationProposals[idx];
      if (proposal && titleInput) {
        selected.push({ title: titleInput.value || proposal.title, produces: proposal.produces || '' });
      }
    }
  });
  if (selected.length === 0) { cancelActionDerivation(); return; }
  try {
    const res = await fetch('/api/milestones/' + encodeURIComponent(actionDerivationMilestoneId) + '/actions/derive/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: selected }),
    });
    const data = await res.json();
    if (!res.ok) {
      const logEl = document.getElementById('action-derivation-log');
      if (logEl) logEl.textContent += '\nError accepting: ' + (data.error || 'Unknown error');
      return;
    }
    actionDerivationProposals = null;
    actionDerivationMilestoneId = null;
    const panel = document.getElementById('action-derivation-panel');
    if (panel) {
      panel.innerHTML = '<div style="color:var(--act-color);font-weight:600;padding:8px 0">' +
        selected.length + ' action' + (selected.length !== 1 ? 's' : '') + ' created</div>';
      setTimeout(() => { if (panel) panel.innerHTML = ''; }, 3000);
    }
  } catch (err) {
    const logEl = document.getElementById('action-derivation-log');
    if (logEl) logEl.textContent += '\nError: ' + err.message;
  }
}

async function cancelActionDerivation() {
  if (actionDerivationSessionId && actionDerivationMilestoneId) {
    try {
      await fetch('/api/milestones/' + encodeURIComponent(actionDerivationMilestoneId) + '/actions/derive/stop', { method: 'POST' });
    } catch (_) {}
  }
  actionDerivationSessionId = null;
  actionDerivationMilestoneId = null;
  actionDerivationProposals = null;
  const logEl = document.getElementById('action-derivation-log');
  if (logEl) { logEl.style.display = 'none'; logEl.innerHTML = ''; }
  const proposals = document.getElementById('action-derivation-proposals');
  if (proposals) { proposals.style.display = 'none'; proposals.innerHTML = ''; }
  const btn = document.getElementById('action-derive-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Derive Actions'; }
}

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

// ─── View switching (DAG / Column browser) ───────────────────────────────────

/**
 * Switch between DAG and column browser views.
 * @param {'dag'|'columns'} mode
 */
function switchView(mode) {
  viewMode = mode;
  localStorage.setItem('declare-view-mode', mode);

  if (mode === 'dag') {
    $canvasWrap.style.display = '';
    $colBrowser.classList.remove('active');
    clearColumnBrowserKbFocus();
    if ($viewToggle) {
      $viewToggle.classList.remove('active');
      $viewToggleLabel.textContent = 'Columns';
    }
    // Redraw edges since layout changed
    requestAnimationFrame(() => drawEdges());
  } else {
    // Exit focus mode before switching to columns
    if (focusNodeId) exitFocusMode();
    $canvasWrap.style.display = 'none';
    $colBrowser.classList.add('active');
    if ($viewToggle) {
      $viewToggle.classList.add('active');
      $viewToggleLabel.textContent = 'Graph';
    }
    // Refresh column browser data
    renderColumnBrowser();
    initColumnBrowserKbFocus();
  }
}

// ─── Activity topbar (DOM refs — must be before event wiring) ─────────────────

const $activityTopbar = document.getElementById('activity-topbar');
const $topbarContent  = document.getElementById('topbar-content');

// ─── Event wiring ─────────────────────────────────────────────────────────────

// Topbar click — navigate to the referenced action/milestone in column browser
if ($activityTopbar) {
  $activityTopbar.addEventListener('click', function() {
    var actionId = $activityTopbar.dataset.actionId;
    var milestoneId = $activityTopbar.dataset.milestoneId;
    if (!actionId && !milestoneId) return;
    if (!graphData) return;

    // Switch to column view if not already there
    if (viewMode !== 'columns') {
      switchView('columns');
    }

    // Navigate: find the declaration for this milestone, then select milestone, then action
    if (milestoneId) {
      var milestone = (graphData.milestones || []).find(function(m) { return m.id === milestoneId; });
      if (milestone && milestone.realizes && milestone.realizes.length) {
        colSelectedDecl = milestone.realizes[0];
        colSelectedMile = milestoneId;
        renderColumnBrowser();
        selectNode(actionId || milestoneId, actionId ? 'action' : 'milestone');
      }
    } else if (actionId) {
      // Try to find the milestone from the action
      var action = (graphData.actions || []).find(function(a) { return a.id === actionId; });
      if (action && action.causes && action.causes.length) {
        var mId = action.causes[0];
        var mile = (graphData.milestones || []).find(function(m) { return m.id === mId; });
        if (mile && mile.realizes && mile.realizes.length) {
          colSelectedDecl = mile.realizes[0];
        }
        colSelectedMile = mId;
      }
      renderColumnBrowser();
      selectNode(actionId, 'action');
    }
  });
}

// File viewer modal close handlers
document.getElementById('file-viewer-close').addEventListener('click', closeFileViewer);
document.getElementById('file-viewer-modal').addEventListener('click', (e) => {
  if (e.target.id === 'file-viewer-modal') closeFileViewer();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('file-viewer-modal').classList.contains('open')) {
    closeFileViewer();
  }
});

// View toggle button
if ($viewToggle) {
  $viewToggle.addEventListener('click', () => {
    switchView(viewMode === 'dag' ? 'columns' : 'dag');
  });
}

// Declaration form triggers
if ($colDeclAddBtn) {
  $colDeclAddBtn.addEventListener('click', () => {
    if (declFormVisible) {
      hideDeclForm();
    } else {
      showDeclForm();
    }
  });
}
if ($newDeclBtn) {
  $newDeclBtn.addEventListener('click', () => {
    showDeclForm();
  });
}

$refreshBtn.addEventListener('click', () => {
  loadData();
});

// Play button
const $playBtn = document.getElementById('play-btn');
if ($playBtn) {
  $playBtn.addEventListener('click', startPlay);
}
const $playStopBtn = document.getElementById('play-stop-btn');
if ($playStopBtn) {
  $playStopBtn.addEventListener('click', stopPlay);
}

// ESC to exit focus mode; arrow keys to navigate between declarations (DAG view only)
document.addEventListener('keydown', (e) => {
  // Skip DAG keyboard handling when column browser is active
  if (isColumnBrowserActive()) return;

  if (e.key === 'Escape' && focusNodeId) {
    document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
    selectedNodeId = null;
    exitFocusMode();
    if ($panelEmpty) $panelEmpty.style.display = '';
  }

  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedNodeId && graphData) {
    const declarations = graphData.declarations;
    const idx = declarations.findIndex(d => d.id === selectedNodeId);
    if (idx === -1) return; // selected node is not a declaration
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % declarations.length
      : (idx - 1 + declarations.length) % declarations.length;
    selectNode(declarations[next].id, 'declaration');
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
  // Use derived statuses (computed from actions) not stored MILESTONES.md status
  const enriched = (graph.milestones || []).map(m => ({
    ...m, ...deriveMilestoneStatus(m, graph.actions || []),
  }));
  const allDone = graph.declarations.every(d =>
    COMPLETED_STATES.has(deriveDeclarationStatus(d, enriched))
  );
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

// ─── Activity topbar ──────────────────────────────────────────────────────────

/** @type {{ actionId: string, milestoneId?: string, startedAt: number } | null} */
let topbarActiveOp = null;
/** @type {{ actionId: string, milestoneId?: string, completedAt: number } | null} */
let topbarLastOp = null;

function updateTopbar() {
  if (!$topbarContent) return;
  if (topbarActiveOp) {
    const aLabel = topbarActiveOp.actionId;
    const mLabel = topbarActiveOp.milestoneId ? ' -- ' + topbarActiveOp.milestoneId : '';
    $topbarContent.innerHTML = '<span class="topbar-spinner"></span> <span class="topbar-label">EXECUTING ' + escHtml(aLabel) + escHtml(mLabel) + '</span>';
    $activityTopbar.dataset.actionId = topbarActiveOp.actionId;
    $activityTopbar.dataset.milestoneId = topbarActiveOp.milestoneId || '';
  } else if (topbarLastOp) {
    var ago = formatTimeAgo(topbarLastOp.completedAt);
    $topbarContent.innerHTML = '<span class="topbar-idle-label">Last: ' + escHtml(topbarLastOp.actionId) + ' completed ' + ago + '</span>';
    $activityTopbar.dataset.actionId = topbarLastOp.actionId;
    $activityTopbar.dataset.milestoneId = topbarLastOp.milestoneId || '';
  } else {
    $topbarContent.innerHTML = '<span class="topbar-idle-label">No active operations</span>';
    $activityTopbar.dataset.actionId = '';
    $activityTopbar.dataset.milestoneId = '';
  }
}

function formatTimeAgo(ts) {
  var diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}

async function syncTopbarFromRunning() {
  try {
    var data = await fetchJson('/api/running');
    var running = data.running || [];
    if (running.length > 0) {
      var actionId = running[0];
      var milestoneId = '';
      if (graphData) {
        var action = (graphData.actions || []).find(function(a) { return a.id === actionId; });
        if (action && action.causes && action.causes.length) milestoneId = action.causes[0];
      }
      topbarActiveOp = { actionId: actionId, milestoneId: milestoneId, startedAt: Date.now() };
    }
    updateTopbar();
  } catch (_) {}
}

function topbarOnActionComplete(actionId) {
  var milestoneId = topbarActiveOp && topbarActiveOp.actionId === actionId
    ? topbarActiveOp.milestoneId : '';
  topbarActiveOp = null;
  topbarLastOp = { actionId: actionId, milestoneId: milestoneId || '', completedAt: Date.now() };
  updateTopbar();
}

async function topbarOnActivity() {
  try {
    var res = await fetch('/api/activity');
    var data = await res.json();
    var events = data.events || [];
    var taskStart = events.find(function(ev) { return ev.tool === 'Task' && ev.phase === 'start'; });
    if (taskStart) {
      var actionMatch = (taskStart.desc || '').match(/A-\d+/i);
      var mileMatch = (taskStart.desc || '').match(/M-\d+/i);
      if (actionMatch) {
        topbarActiveOp = {
          actionId: actionMatch[0].toUpperCase(),
          milestoneId: mileMatch ? mileMatch[0].toUpperCase() : '',
          startedAt: new Date(taskStart.ts).getTime() || Date.now(),
        };
        updateTopbar();
      }
    }
  } catch (_) {}
}

setInterval(function() { if (!topbarActiveOp && topbarLastOp) updateTopbar(); }, 30000);

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

// ─── Workflow state banner ────────────────────────────────────────────────────

const STATE_DISPLAY = {
  empty:              'Get Started',
  declarations_only:  'Declarations',
  milestones_pending: 'Milestones',
  actions_pending:    'Actions',
  executing:          'Executing',
  complete:           'Complete',
};

const STATE_BTN_LABEL = {
  'create-declaration': '+ Declaration',
  'derive-milestones':  'Derive Milestones',
  'derive-actions':     'Derive Actions',
  'execute-action':     'Execute',
  'plan-actions':       'Plan Actions',
  'view-execution':     'View Execution',
  'view-summary':       'All Complete',
};

/**
 * Fetch workflow state from API and render the banner.
 */
async function loadWorkflowState() {
  try {
    const data = await fetchJson('/api/workflow/state');
    workflowState = data;
    renderWorkflowBanner();
  } catch (_) {
    // Non-critical — hide banner on error
    if ($workflowBanner) $workflowBanner.classList.remove('visible');
  }
}

/**
 * Render the workflow next-step banner from current workflowState.
 */
function renderWorkflowBanner() {
  if (!workflowState || !$workflowBanner) return;

  const { state, nextStep, progress } = workflowState;

  $workflowBanner.classList.add('visible');

  // State label
  $wfStateLabel.textContent = STATE_DISPLAY[state] || state;

  // Progress bar
  $wfProgressFill.style.width = `${progress.percentage}%`;
  $wfProgressFill.className = `wf-progress-fill state-${state}`;

  // Percentage text
  $wfPct.textContent = progress.actions > 0 ? `${progress.percentage}%` : '';

  // Next step label
  $wfNextLabel.textContent = nextStep.label;

  // Action button
  const btnLabel = STATE_BTN_LABEL[nextStep.action] || nextStep.label;
  $wfActionBtn.textContent = btnLabel;
  $wfActionBtn.className = `wf-action-btn state-${state}`;
  $wfActionBtn.dataset.action = nextStep.action;
  $wfActionBtn.dataset.targetId = nextStep.targetId || '';

  // Hide button for view-only states
  $wfActionBtn.style.display = (state === 'complete' || state === 'executing') ? 'none' : '';
}

// Wire up banner action button
if ($wfActionBtn) {
  $wfActionBtn.addEventListener('click', () => {
    const action = $wfActionBtn.dataset.action;
    const targetId = $wfActionBtn.dataset.targetId;

    switch (action) {
      case 'create-declaration':
        // Trigger declaration form in column browser or status bar
        if ($newDeclBtn) $newDeclBtn.click();
        break;
      case 'derive-milestones':
        // Select first declaration and trigger derive if possible
        if (graphData && graphData.declarations && graphData.declarations.length > 0) {
          const declId = graphData.declarations[0].id;
          selectNode(declId, 'declaration');
          // Derivation is triggered from the panel — just select the node
        }
        break;
      case 'derive-actions':
        if (targetId) selectNode(targetId, 'milestone');
        break;
      case 'execute-action':
        if (targetId) selectNode(targetId, 'action');
        break;
      case 'plan-actions':
        // Switch to columns view for easier navigation
        if (viewMode !== 'columns') {
          switchView('columns');
        }
        break;
      default:
        break;
    }
  });
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
    topbarOnActivity();
  });
  es.addEventListener('action-output', handleActionOutput);
  es.addEventListener('action-complete', function(e) {
    handleActionComplete(e);
    try { var d = JSON.parse(e.data); topbarOnActionComplete(d.actionId); } catch(_) {}
  });
  es.addEventListener('derivation-output', handleDerivationOutput);
  es.addEventListener('derivation-complete', handleDerivationComplete);
  es.addEventListener('action-derivation-output', handleActionDerivationOutput);
  es.addEventListener('action-derivation-complete', handleActionDerivationComplete);
  es.addEventListener('revision-output', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.sessionId !== revisionSessionId) return;
      const outputEl = document.getElementById('revision-output');
      if (outputEl) {
        outputEl.textContent += data.text + '\n';
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    } catch (_) { /* ignore */ }
  });
  es.addEventListener('revision-complete', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.sessionId !== revisionSessionId) return;
      revisionSessionId = null;
      const panel = document.getElementById('revision-panel');
      if (panel) {
        const header = panel.querySelector('.revision-panel-header');
        const stopBtn = panel.querySelector('#revision-stop-btn');
        if (stopBtn) stopBtn.style.display = 'none';
        if (data.error) {
          if (header) header.textContent = 'Revision failed';
        } else {
          if (header) header.textContent = 'Revision complete (Round ' + data.revisionRound + ')';
          // Re-render annotation panel to show updated round and refreshed content
          setTimeout(function() {
            if (revisionNodeId) {
              const nodeType = revisionNodeId.startsWith('A-') ? 'action' : revisionNodeId.startsWith('M-') ? 'milestone' : 'declaration';
              renderAnnotationPanel(revisionNodeId, nodeType);
            }
          }, 500);
        }
      }
    } catch (_) { /* ignore */ }
  });
  es.addEventListener('play-start', handlePlayStart);
  es.addEventListener('play-wave-start', handlePlayWaveStart);
  es.addEventListener('play-wave-complete', handlePlayWaveComplete);
  es.addEventListener('play-complete', handlePlayComplete);
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
