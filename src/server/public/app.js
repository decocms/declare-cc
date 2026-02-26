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

/** @type {string|null} Action ID selected in execution view for output display */
let execSelectedActionId = null;
/** @type {Object<string, string>} Buffered output per action ID for review */
let execOutputBuffers = {};
/** @type {boolean} Auto-follow running action in execution view (false when user manually selects non-running) */
let execAutoFollow = true;

/** @type {string | null} Currently selected declaration in column browser */
let colSelectedDecl = null;
/** @type {string | null} Currently selected milestone in column browser */
let colSelectedMile = null;

/** @type {number} Column browser keyboard focus column (0=decl, 1=mile, 2=act) */
let kbColumn = 0;
/** @type {number} Column browser keyboard focus item index within the focused column */
let kbIndex = 0;

// ─── Drill browser state ─────────────────────────────────────────────────────
/** @type {'declarations'|'milestones'|'actions'} Current drill-down level */
let drillLevel = 'declarations';
/** @type {string|null} Selected declaration for Level 2+ */
let drillDeclId = null;
/** @type {string|null} Selected milestone for Level 3 */
let drillMileId = null;

/** Per-level navigation state to restore on back-navigation */
const drillNavState = {
  declarations: { focusIndex: 0, scrollTop: 0 },
  milestones:   { focusIndex: 0, scrollTop: 0 },
  actions:      { focusIndex: 0, scrollTop: 0 },
};

/** @type {'dag'|'columns'|'execution'} Current view mode, persisted in localStorage */
let viewMode = localStorage.getItem('declare-view-mode') || 'columns';
// Execution mode is only valid during active play; fall back to columns on reload
if (viewMode === 'execution') viewMode = 'columns';

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

/** @type {string | null} Active derivation session ID (legacy single-session) */
let derivationSessionId = null;
/** @type {Array<{title: string, realizes: string, reason: string}> | null} */
let derivationProposals = null;

/** @type {Map<string, { sessionId: string, status: string }>} Tracks active derivations per declaration */
const activeDeriveMap = new Map();

/** @type {string | null} Active action derivation session ID (for the drilled-into milestone) */
let actionDerivationSessionId = null;
/** @type {string | null} Milestone ID for the current action derivation (drilled-into) */
let actionDerivationMilestoneId = null;
/** @type {Array<{title: string, produces: string, reason: string}> | null} */
let actionDerivationProposals = null;

/** @type {Set<string>} Node IDs with in-flight planning (immediate visual feedback before agent registry updates) */
const pendingDerivations = new Set();

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

/** @type {boolean} Whether the execution order has been confirmed */
let orderConfirmed = false;

/** @type {Array<Array<{id:string, status:string, title:string, actions?: Array<{id:string, title:string, status:string}>}>>|null} Mutable wave order for drag-reorder */
let preExecWaves = null;
/** @type {number|null} Wave index of current drag source */
let dragSourceWave = null;
/** @type {number|null} Milestone index of current drag source (for action drags) */
let dragSourceMile = null;

/** @type {boolean} Whether the play sequence is currently running */
let playRunning = false;
/** @type {{ currentWave: number, totalWaves: number, activeActions: string[], completedActions: string[], failedActions: string[] } | null} */
let playStatus = null;

/** @type {number} Total actions across all waves for progress tracking */
let execTotalActions = 0;
/** @type {number} Actions completed so far */
let execCompletedActions = 0;
/** @type {number} Actions failed so far */
let execFailedActions = 0;


// ─── Onboarding flow state ─────────────────────────────────────────────────────
/** @type {'idle'|'questions'|'proposals'|'approving'} Current onboard phase */
let onboardPhase = 'idle';
/** @type {string|null} The original vision prompt */
let onboardPrompt = null;
/** @type {Array<{question: string, context: string, options?: string[]}>|null} */
let onboardQuestions = null;
/** @type {Array<{title: string, statement: string, reasoning: string, approvedId?: string}>|null} */
let onboardProposals = null;
/** @type {number} Current index being approved */
let onboardApproveIndex = 0;
/** @type {string} Streaming text buffer */
let onboardStreamText = '';

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
const $executeMainBtn = document.getElementById('execute-main-btn');
// $activityPinned removed — replaced by agent cards panel (A-124)
const $statusBreadcrumb = document.getElementById('status-breadcrumb');

// Project name click → go back to declarations (home)
if ($projectName) {
  $projectName.addEventListener('click', () => {
    if (viewMode !== 'columns') switchView('columns');
    drillLevel = 'declarations';
    drillDeclId = null;
    drillMileId = null;
    pushDrillHash();
    renderDrillView();
  });
}

const $nodesDecls    = document.getElementById('nodes-declarations');
const $nodesMiles    = document.getElementById('nodes-milestones');
const $nodesActs     = document.getElementById('nodes-actions');
const $edgesSvg      = document.getElementById('edges-svg');

const $sidePanel     = document.getElementById('side-panel');
const $panelBody     = document.getElementById('panel-body');
const $panelEmpty    = document.getElementById('panel-empty');

const $colBrowser    = document.getElementById('column-browser');
const $readinessBanner = document.getElementById('readiness-banner');
const $colDeclList   = document.getElementById('col-decl-list');
const $colMileList   = document.getElementById('col-mile-list');
const $colActList    = document.getElementById('col-act-list');

const $drillBrowser    = document.getElementById('drill-browser');
const $drillBreadcrumb = document.getElementById('drill-breadcrumb');
const $drillDetail     = document.getElementById('drill-detail');
const $drillContext    = document.getElementById('drill-context');
const $drillList       = document.getElementById('drill-list');
const $drillPrompt     = document.getElementById('drill-prompt');

// Move activity feed into drill-body so it's part of the 3-panel layout
(function() {
  const drillBody = document.getElementById('drill-body');
  const actFeed = document.getElementById('activity-feed');
  if (drillBody && actFeed) drillBody.appendChild(actFeed);
})();

const $viewToggle    = document.getElementById('view-toggle');
const $viewToggleLabel = document.getElementById('view-toggle-label');
const $canvasWrap    = document.getElementById('canvas-wrap');
const $execView      = document.getElementById('execution-view');
const $execOutputHeader = document.getElementById('exec-output-header');
const $execOutputLog    = document.getElementById('exec-output-log');
const $execTopbarTitle  = document.getElementById('exec-topbar-title');
const $execWaveStatus   = document.getElementById('exec-wave-status');
const $execStopBtn      = document.getElementById('exec-stop-btn');
const $execExitBtn      = document.getElementById('exec-exit-btn');
const $execProgressFill = document.getElementById('exec-progress-fill');
const $execProgressPct  = document.getElementById('exec-progress-pct');
const $execFailureOverlay = document.getElementById('exec-failure-overlay');
const $execFailureDetails = document.getElementById('exec-failure-details');
const $execFailureView    = document.getElementById('exec-failure-view');
const $execFailureSkip    = document.getElementById('exec-failure-skip');
const $execFailureStop    = document.getElementById('exec-failure-stop');

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

/** @type {{ stages: Record<string, Array<{id:string,title:string,type:string,status:string,reviewState?:string,stage:string}>>, nextAction: {action:string,label:string,targetId?:string,targetType?:string}|null, progress: {total:number,done:number,percentage:number} } | null} */
let lifecycleData = null;

/** @type {string|null} Active lifecycle stage filter — null means show all stages */
let lifecycleFilter = null;

/** @type {boolean} Whether Done section is collapsed */
let lifecycleDoneCollapsed = true;

/** @type {string|null} Lifecycle filter for level 2 (milestones) */
let lifecycleFilterL2 = null;
/** @type {string|null} Lifecycle filter for level 3 (actions) */
let lifecycleFilterL3 = null;

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
      fetchProjectInfo(),
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

    // Restore running derivation sessions after page refresh
    await restoreRunningDerivations();

    hideOverlay();
    renderStatusBar();
    renderGraph();
    parseDrillHash(); // Restore drill state from URL hash on load
    renderDrillView();
    updateLastUpdated();
    checkProjectComplete(graph);
    loadWorkflowState();
    loadLifecycleData();

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
  if ($lastUpdated) $lastUpdated.textContent = `Last updated: ${fmtTime(new Date())}`;
  // Update execute button state
  if ($executeMainBtn) {
    const canExec = canEnterExecution();
    $executeMainBtn.disabled = !canExec;
    $executeMainBtn.title = canExec ? 'Enter execution mode' : 'Approve all actions first';
  }
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function renderStatusBar() {
  // Project name — use folder name from projectInfo or status
  const project = (projectInfo && projectInfo.folder) || (statusData ? statusData.project : null);
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
  const allNodes = [
    ...(graphData ? graphData.declarations || [] : []),
    ...(graphData ? graphData.milestones || [] : []),
    ...(graphData ? graphData.actions || [] : []),
  ];
  const total = allNodes.length;
  const wholeCount = allNodes.filter(n => n.wholeness === 'whole').length;
  const integrityPct = total > 0 ? Math.round((wholeCount / total) * 100) : 0;

  // Update integrity pill in status bar
  const $integrityPill = document.getElementById('integrity-pill');
  if ($integrityPill) {
    const valSpan = $integrityPill.querySelector('.pill-value');
    if (valSpan) valSpan.textContent = `${integrityPct}%`;
    $integrityPill.className = 'status-pill' +
      (integrityPct >= 90 ? ' integrity-ok' : integrityPct >= 60 ? ' integrity-warn' : ' integrity-bad');
  }
}

// ─── Node element builder ─────────────────────────────────────────────────────

const COMPLETED = new Set(['DONE','KEPT','HONORED']);
const EXECUTING_STATUSES_SET = new Set(['EXECUTING', 'IN_PROGRESS', 'RUNNING']);
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

  // Update readiness banner
  renderReadinessBanner();
}

// ─── Readiness banner ─────────────────────────────────────────────────────────

/**
 * Render the global readiness indicator banner showing how many plans are
 * approved vs total, with clickable links to unapproved nodes.
 * Called at the end of renderColumnBrowser() so it updates on every SSE refresh.
 */
function renderReadinessBanner() {
  if (!$readinessBanner || !graphData) return;

  // Show banner only in column browser mode
  if (!isColumnBrowserActive()) {
    $readinessBanner.classList.remove('active');
    return;
  }
  $readinessBanner.classList.add('active');

  const allNodes = [
    ...(graphData.declarations || []).map(n => ({ ...n, _type: 'declaration' })),
    ...(graphData.milestones || []).map(n => ({ ...n, _type: 'milestone' })),
    ...(graphData.actions || []).map(n => ({ ...n, _type: 'action' })),
  ];

  const total = allNodes.length;
  const approved = allNodes.filter(n => n.reviewState === 'approved');
  const unapproved = allNodes.filter(n => n.reviewState !== 'approved');
  const approvedCount = approved.length;

  if (total === 0) {
    $readinessBanner.innerHTML = '<span class="rb-remaining">No nodes to review</span>';
    return;
  }

  if (unapproved.length === 0) {
    $readinessBanner.innerHTML =
      `<span class="rb-complete">All ${total} nodes approved</span>` +
      `<button class="enter-exec-btn" id="enter-exec-btn">Enter Execution Mode</button>`;
  } else {
    const MAX_LINKS = 8;
    const shown = unapproved.slice(0, MAX_LINKS);
    const remaining = unapproved.length - shown.length;

    let linksHtml = shown.map(n =>
      `<a class="rb-link" data-node-id="${escHtml(n.id)}" data-node-type="${n._type}">${escHtml(n.id)}</a>`
    ).join('');

    if (remaining > 0) {
      linksHtml += `<span class="rb-more">+ ${remaining} more</span>`;
    }

    $readinessBanner.innerHTML =
      `<span class="rb-progress">${approvedCount}/${total} approved</span>` +
      `<span class="rb-remaining">${unapproved.length} need review:</span>` +
      linksHtml +
      `<button class="enter-exec-btn" id="enter-exec-btn" disabled title="All nodes must be approved before entering execution mode">Enter Execution Mode</button>`;
  }

  // Wire enter-execution-mode button
  const execBtn = document.getElementById('enter-exec-btn');
  if (execBtn && !execBtn.disabled) {
    execBtn.addEventListener('click', () => {
      if (confirm('Enter execution mode? You will not be able to edit plans until you exit.')) {
        switchView('execution');
      }
    });
  }

  // Wire click handlers on unapproved-node links
  $readinessBanner.querySelectorAll('.rb-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const nodeId = this.dataset.nodeId;
      const nodeType = this.dataset.nodeType;

      // Navigate the column browser to the clicked node
      if (nodeType === 'declaration') {
        colSelectedDecl = nodeId;
        colSelectedMile = null;
        renderColumnBrowser();
        selectNode(nodeId, 'declaration');
      } else if (nodeType === 'milestone') {
        // Find the declaration this milestone realizes
        const milestone = (graphData.milestones || []).find(m => m.id === nodeId);
        if (milestone && milestone.realizes && milestone.realizes.length) {
          colSelectedDecl = milestone.realizes[0];
        }
        colSelectedMile = nodeId;
        renderColumnBrowser();
        selectNode(nodeId, 'milestone');
      } else if (nodeType === 'action') {
        // Find the milestone this action belongs to, then its declaration
        const action = (graphData.actions || []).find(a => a.id === nodeId);
        if (action && action.causes && action.causes.length) {
          const mileId = action.causes[0];
          colSelectedMile = mileId;
          const milestone = (graphData.milestones || []).find(m => m.id === mileId);
          if (milestone && milestone.realizes && milestone.realizes.length) {
            colSelectedDecl = milestone.realizes[0];
          }
        }
        renderColumnBrowser();
        selectNode(nodeId, 'action');
      }
    });
  });
}

// ─── Drill-down browser ────────────────────────────────────────────────────────

/** @type {string} Previous drill level — used to detect level changes and save nav state */
let drillPrevLevel = 'declarations';

/** Save current scroll + focus for the current drill level */
function saveDrillNavState() {
  const $list = document.getElementById('drill-list');
  drillNavState[drillLevel] = {
    focusIndex: drillFocusIndex,
    scrollTop: $list ? $list.scrollTop : 0,
  };
}

/** Navigate deeper: save current state then switch level */
function drillGoDeeper(newLevel) {
  saveDrillNavState();
  drillLevel = newLevel;
  // Reset level-specific lifecycle filters when navigating
  if (newLevel === 'milestones') lifecycleFilterL2 = null;
  if (newLevel === 'actions') lifecycleFilterL3 = null;
  pushDrillHash();
}

/** Navigate back: save current state then switch level */
function drillGoBack(newLevel) {
  saveDrillNavState();
  drillLevel = newLevel;
  pushDrillHash();
}

/**
 * Navigate the drill browser to the result of a completed agent.
 * Maps agent type + result metadata to the correct drill state.
 * @param {object} agent - AgentRecord from the registry
 */
function navigateToResult(agent) {
  if (!graphData) return;
  const result = agent.result || {};
  const milestones = graphData.milestones || [];

  switch (agent.type) {
    case 'execution': {
      // Navigate to the milestone's action list
      const mileId = result.milestoneId || agent.milestoneId;
      if (mileId) {
        const mile = milestones.find(m => m.id === mileId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = mileId;
        drillLevel = 'actions';
      }
      break;
    }
    case 'derivation': {
      // Navigate to the declaration's milestone list
      // The target is the declaration ID (e.g., "D-16") or "all"
      const declId = agent.target !== 'all' ? agent.target : null;
      if (declId) {
        drillDeclId = declId;
        drillLevel = 'milestones';
      } else {
        // "all" derivation — go to declarations list
        drillDeclId = null;
        drillMileId = null;
        drillLevel = 'declarations';
      }
      drillMileId = null;
      break;
    }
    case 'action-derivation': {
      // Navigate to the milestone's action list
      const mileId = result.milestoneId || agent.milestoneId || agent.target;
      if (mileId) {
        const mile = milestones.find(m => m.id === mileId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = mileId;
        drillLevel = 'actions';
      }
      break;
    }
    case 'revision': {
      // Navigate to the revised node — could be declaration or milestone
      const nodeId = result.nodeId || agent.target;
      if (nodeId && nodeId.startsWith('M-')) {
        // Milestone revision — navigate to its action list
        const mile = milestones.find(m => m.id === nodeId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = nodeId;
        drillLevel = 'actions';
      } else if (nodeId && nodeId.startsWith('D-')) {
        // Declaration revision — navigate to its milestone list
        drillDeclId = nodeId;
        drillMileId = null;
        drillLevel = 'milestones';
      }
      break;
    }
    case 'pipeline': {
      // Navigate to the milestone targeted by the pipeline
      const mileId = agent.milestoneId || agent.target;
      if (mileId && mileId.startsWith('M-')) {
        const mile = milestones.find(m => m.id === mileId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = mileId;
        drillLevel = 'actions';
      } else {
        drillDeclId = null;
        drillMileId = null;
        drillLevel = 'declarations';
      }
      break;
    }
    case 'refine':
    case 'discuss': {
      // Navigate to the refined/discussed node — same as revision
      const nodeId = result.nodeId || agent.target;
      if (nodeId && nodeId.startsWith('M-')) {
        const mile = milestones.find(m => m.id === nodeId);
        if (mile && mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillMileId = nodeId;
        drillLevel = 'actions';
      } else if (nodeId && nodeId.startsWith('D-')) {
        drillDeclId = nodeId;
        drillMileId = null;
        drillLevel = 'milestones';
      }
      break;
    }
    default: {
      // Unknown agent type — fall back to declarations
      drillDeclId = null;
      drillMileId = null;
      drillLevel = 'declarations';
      break;
    }
  }

  // Switch to columns view if not already there and render
  if (viewMode !== 'columns') switchView('columns');
  pushDrillHash();
  renderDrillView();
}

/** Build the hash string for current drill state */
function drillHashString() {
  let hash = '#/';
  if (drillDeclId) {
    hash += encodeURIComponent(drillDeclId);
    if (drillMileId) hash += '/' + encodeURIComponent(drillMileId);
  }
  return hash;
}

/** Push current drill state to URL hash (new history entry) */
function pushDrillHash() {
  const hash = drillHashString();
  if (location.hash !== hash) history.pushState(null, '', hash);
}

/** Replace current URL hash without creating history entry */
function syncDrillHash() {
  const hash = drillHashString();
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

/** Parse URL hash and restore drill state. Returns true if state changed. */
function parseDrillHash() {
  const hash = location.hash || '#/';
  const parts = hash.replace('#/', '').split('/').filter(Boolean).map(decodeURIComponent);
  const prevLevel = drillLevel;
  const prevDecl = drillDeclId;
  const prevMile = drillMileId;

  if (parts.length >= 2) {
    drillDeclId = parts[0];
    drillMileId = parts[1];
    drillLevel = 'actions';
  } else if (parts.length === 1) {
    drillDeclId = parts[0];
    drillMileId = null;
    drillLevel = 'milestones';
  } else {
    drillDeclId = null;
    drillMileId = null;
    drillLevel = 'declarations';
  }
  return drillLevel !== prevLevel || drillDeclId !== prevDecl || drillMileId !== prevMile;
}

/** Handle browser back/forward */
window.addEventListener('popstate', () => {
  if (parseDrillHash()) {
    renderDrillView();
  }
});

/**
 * Core dispatcher — render the current drill level.
 */
function renderDrillView() {
  if (!$drillBrowser || !graphData) return;

  // If onboarding is active, render it instead
  if (onboardPhase !== 'idle') {
    renderOnboardUI();
    return;
  }

  syncDrillHash(); // Keep URL in sync without creating history entries

  const { declarations, milestones, actions } = graphData;

  // Compute enriched milestones and declarations
  const enrichedMilestones = (milestones || []).map(m => ({
    ...m,
    ...deriveMilestoneStatus(m, actions || []),
  }));
  const enrichedDeclarations = (declarations || []).map(d => ({
    ...d,
    displayStatus: deriveDeclarationStatus(d, enrichedMilestones),
  }));

  if (drillLevel === 'declarations') {
    renderDrillDeclarations(enrichedDeclarations, enrichedMilestones, actions || []);
  } else if (drillLevel === 'milestones') {
    renderDrillMilestones(enrichedDeclarations, enrichedMilestones, actions || []);
  } else if (drillLevel === 'actions') {
    renderDrillActions(enrichedDeclarations, enrichedMilestones, actions || []);
  }

  // Restore or auto-select focus
  const cards = getDrillCards();
  const levelChanged = drillPrevLevel !== drillLevel;
  if (cards.length > 0) {
    if (levelChanged) {
      // Restore saved state for this level
      const saved = drillNavState[drillLevel];
      drillFocusIndex = (saved && saved.focusIndex >= 0) ? saved.focusIndex : 0;
    }
    if (drillFocusIndex < 0) drillFocusIndex = 0;
    if (drillFocusIndex >= cards.length) drillFocusIndex = cards.length - 1;
    updateDrillFocus();
    // Restore scroll position
    if (levelChanged) {
      const $list = document.getElementById('drill-list');
      const saved = drillNavState[drillLevel];
      if ($list && saved && saved.scrollTop > 0) {
        requestAnimationFrame(() => { $list.scrollTop = saved.scrollTop; });
      }
    }
  } else {
    drillFocusIndex = -1;
  }

  drillPrevLevel = drillLevel;

  // Update status bar breadcrumb
  updateStatusBreadcrumb(enrichedDeclarations, enrichedMilestones);
  // Update next/execute button
  updateNextButton(enrichedDeclarations, enrichedMilestones, actions || []);

  // Re-attach discuss container if a discuss session is active (survives re-renders)
  if (discussActiveNodeId && discussActiveContainer) {
    reattachDiscussContainer();
  }
}

/**
 * Update the inline breadcrumb in the status bar based on current drill level.
 */
function updateStatusBreadcrumb(enrichedDeclarations, enrichedMilestones) {
  if (!$statusBreadcrumb) return;
  $statusBreadcrumb.innerHTML = '';

  if (drillLevel === 'declarations') {
    // No extra breadcrumb — project name is the root
    return;
  }

  const decl = enrichedDeclarations.find(d => d.id === drillDeclId);
  if (!decl) return;
  const declTitle = decl.title || decl.statement || decl.id;

  if (drillLevel === 'milestones') {
    $statusBreadcrumb.innerHTML = `
      <span class="bc-sep">&rsaquo;</span>
      <span class="bc-current">${escHtml(decl.id)}</span>
      <span class="bc-title">${escHtml(truncate(declTitle, 40))}</span>`;
  } else if (drillLevel === 'actions') {
    const mile = enrichedMilestones.find(m => m.id === drillMileId);
    if (!mile) return;
    const mileTitle = mile.title || mile.id;
    $statusBreadcrumb.innerHTML = `
      <span class="bc-sep">&rsaquo;</span>
      <span class="bc-link" data-bc-level="milestones">${escHtml(decl.id)}</span>
      <span class="bc-sep">&rsaquo;</span>
      <span class="bc-current">${escHtml(mile.id)}</span>
      <span class="bc-title">${escHtml(truncate(mileTitle, 35))}</span>`;

    const bcLink = $statusBreadcrumb.querySelector('[data-bc-level]');
    if (bcLink) {
      bcLink.addEventListener('click', () => {
        drillLevel = 'milestones';
        drillMileId = null;
        renderDrillView();
      });
    }
  }
}

/**
 * Find the next unapproved node and update the main button.
 * Uses lifecycle nextAction when available for smarter guidance.
 */
function updateNextButton(enrichedDeclarations, enrichedMilestones, actions) {
  if (!$executeMainBtn) return;

  // Use lifecycle nextAction if available
  const next = lifecycleData ? lifecycleData.nextAction : null;

  if (next) {
    if (next.action === 'derive-milestones' || next.action === 'derive-actions') {
      $executeMainBtn.innerHTML = '<kbd>⌃⇧P</kbd> Plan';
      $executeMainBtn.className = 'btn-plan';
      $executeMainBtn.id = 'execute-main-btn';
      $executeMainBtn.disabled = false;
      $executeMainBtn.title = next.label;
      $executeMainBtn._nextTarget = null;
      $executeMainBtn._planMode = true;
      $executeMainBtn._lifecycleAction = next;
    } else if (next.action === 'approve') {
      $executeMainBtn.innerHTML = '<kbd>N</kbd> Next';
      $executeMainBtn.className = 'btn-next';
      $executeMainBtn.id = 'execute-main-btn';
      $executeMainBtn.disabled = false;
      $executeMainBtn.title = next.label;
      $executeMainBtn._nextTarget = null;
      $executeMainBtn._planMode = false;
      $executeMainBtn._lifecycleAction = next;
    } else if (next.action === 'execute') {
      $executeMainBtn.innerHTML = '<kbd>E</kbd> Execute';
      $executeMainBtn.className = '';
      $executeMainBtn.id = 'execute-main-btn';
      $executeMainBtn.disabled = !canEnterExecution();
      $executeMainBtn.title = next.label;
      $executeMainBtn._nextTarget = null;
      $executeMainBtn._planMode = false;
      $executeMainBtn._lifecycleAction = next;
    } else if (next.action === 'complete') {
      $executeMainBtn.innerHTML = '\u2713 Done';
      $executeMainBtn.className = 'btn-done';
      $executeMainBtn.id = 'execute-main-btn';
      $executeMainBtn.disabled = true;
      $executeMainBtn.title = 'All items complete';
      $executeMainBtn._nextTarget = null;
      $executeMainBtn._planMode = false;
      $executeMainBtn._lifecycleAction = null;
    } else {
      // view-execution or other — show status
      $executeMainBtn.innerHTML = next.label;
      $executeMainBtn.className = '';
      $executeMainBtn.id = 'execute-main-btn';
      $executeMainBtn.disabled = true;
      $executeMainBtn.title = next.label;
      $executeMainBtn._nextTarget = null;
      $executeMainBtn._planMode = false;
      $executeMainBtn._lifecycleAction = null;
    }
  } else {
    // Fallback to original logic when lifecycle data not available
    const unapprovedDecl = enrichedDeclarations.find(d => d.reviewState !== 'approved');
    const unapprovedMile = enrichedMilestones.find(m => m.reviewState !== 'approved');
    const unapprovedAction = (actions || []).find(a => a.reviewState !== 'approved' && !COMPLETED.has((a.status || '').toUpperCase()));

    const hasUnapproved = unapprovedDecl || unapprovedMile || unapprovedAction;

    if (hasUnapproved) {
      $executeMainBtn.innerHTML = '<kbd>N</kbd> Next';
      $executeMainBtn.className = 'btn-next';
      $executeMainBtn.id = 'execute-main-btn';
      $executeMainBtn.disabled = false;
      $executeMainBtn.title = 'Go to next item needing approval';
      $executeMainBtn._nextTarget = { decl: unapprovedDecl, mile: unapprovedMile, action: unapprovedAction };
      $executeMainBtn._planMode = false;
      $executeMainBtn._lifecycleAction = null;
    } else {
      const needsPlanning = enrichedDeclarations.some(d => d.displayStatus === 'PENDING');
      if (needsPlanning) {
        $executeMainBtn.innerHTML = '<kbd>⌃⇧P</kbd> Plan';
        $executeMainBtn.className = 'btn-plan';
        $executeMainBtn.id = 'execute-main-btn';
        $executeMainBtn.disabled = false;
        $executeMainBtn.title = 'Plan milestones for unplanned declarations';
        $executeMainBtn._nextTarget = null;
        $executeMainBtn._planMode = true;
        $executeMainBtn._lifecycleAction = null;
      } else {
        $executeMainBtn.innerHTML = '<kbd>E</kbd> Execute';
        $executeMainBtn.className = '';
        $executeMainBtn.id = 'execute-main-btn';
        $executeMainBtn.disabled = !canEnterExecution();
        $executeMainBtn.title = canEnterExecution() ? 'Enter execution mode' : 'No actions to execute';
        $executeMainBtn._nextTarget = null;
        $executeMainBtn._planMode = false;
        $executeMainBtn._lifecycleAction = null;
      }
    }
  }

  // Update integrity pill to show approval progress
  const $integrityPill = document.getElementById('integrity-pill');
  if ($integrityPill) {
    const allNodes = [...(enrichedDeclarations || []), ...(enrichedMilestones || []), ...(actions || [])];
    const total = allNodes.length;
    const approvedCount = allNodes.filter(n => n.reviewState === 'approved' || COMPLETED.has((n.status || '').toUpperCase())).length;
    const pct = total > 0 ? Math.round((approvedCount / total) * 100) : 0;
    const valSpan = $integrityPill.querySelector('.pill-value');
    if (valSpan) valSpan.textContent = `${pct}%`;
    $integrityPill.className = 'status-pill' +
      (pct >= 100 ? ' integrity-ok' : pct >= 60 ? ' integrity-warn' : ' integrity-bad');
  }
}

/** @type {{ title: string, description: string, coreValue: string, folder: string } | null} */
let projectInfo = null;

async function fetchProjectInfo() {
  try {
    projectInfo = await fetchJson('/api/project');
  } catch (_) {}
}

function renderProjectDetail() {
  if (!$drillDetail) return;
  delete $drillDetail.dataset.nodeType;
  const info = projectInfo || {};
  const title = info.title || info.folder || 'Project';
  const desc = info.description || '';
  const core = info.coreValue || '';
  const currentState = info.currentState || '';

  // Compute stats
  const stats = (graphData && graphData.stats) || {};
  const dCount = stats.declarations || 0;
  const mCount = stats.milestones || 0;
  const aCount = stats.actions || 0;

  // Lifecycle progress if available
  let progressHtml = '';
  if (lifecycleData) {
    const s = lifecycleData.stages;
    const total = Object.values(s).reduce((sum, arr) => sum + arr.length, 0);
    if (total > 0) {
      const segments = [
        { count: (s['needs-planning'] || []).length, color: '#fbbf24' },
        { count: (s['needs-approval'] || []).length, color: '#f97316' },
        { count: (s['ready-to-execute'] || []).length, color: '#86efac' },
        { count: (s['in-execution'] || []).length, color: '#60a5fa' },
        { count: (s['done'] || []).length, color: '#6b7280' },
      ];
      progressHtml = `<div class="detail-section-label">Progress</div>
        <div class="lifecycle-progress">${segments.map(seg =>
          seg.count > 0 ? `<div class="lifecycle-progress-segment" style="width:${(seg.count / total * 100).toFixed(1)}%;background:${seg.color}"></div>` : ''
        ).join('')}</div>
        <div class="detail-meta">${lifecycleData.progress.done}/${lifecycleData.progress.total} done (${lifecycleData.progress.percentage}%)</div>`;
    }
  }

  $drillDetail.innerHTML = `
    <div class="detail-id" style="color:var(--accent)">PROJECT</div>
    <div class="detail-title">${escHtml(title)}</div>
    ${desc ? `<div class="detail-desc">${escHtml(desc)}</div>` : '<div class="detail-desc" style="color:var(--text-dim);font-style:italic">No project description yet. Run /declare:new-project to set one up.</div>'}
    ${core ? `<div class="detail-section-label">Core Value</div><div class="detail-desc">${escHtml(core)}</div>` : ''}
    ${currentState ? `<div class="detail-section-label">Current State</div><div class="detail-meta">${escHtml(currentState)}</div>` : ''}
    ${progressHtml}
    <div class="detail-section-label">Graph</div>
    <div class="detail-meta">${dCount} declarations &middot; ${mCount} milestones &middot; ${aCount} actions</div>
  `;
}

// ─── Lifecycle stage display config ──────────────────────────────────────────

const LIFECYCLE_STAGES = [
  { key: 'needs-planning', label: 'Needs Planning', color: '#fbbf24', icon: '\u270E' },
  { key: 'needs-approval', label: 'Needs Approval', color: '#f97316', icon: '\u2691' },
  { key: 'ready-to-execute', label: 'Ready to Execute', color: '#86efac', icon: '\u25B6' },
  { key: 'in-execution', label: 'In Execution', color: '#60a5fa', icon: '\u2699' },
  { key: 'done', label: 'Done', color: '#6b7280', icon: '\u2713' },
];


/**
 * Level 1 — Lifecycle-grouped view: all items grouped by stage.
 */
function renderDrillDeclarations(enrichedDeclarations, enrichedMilestones, actions) {
  $drillContext.innerHTML = '';
  $drillList.innerHTML = '';

  // Show project details in left panel
  $drillDetail.classList.add('visible');
  renderProjectDetail();

  // Handle empty project — delegate to onboarding (M-56)
  if (enrichedDeclarations.length === 0) {
    renderEmptyOnboarding();
    return;
  }

  // Classify ONLY declarations into lifecycle stages
  const stages = classifyDeclarationsToStages(enrichedDeclarations, enrichedMilestones, actions);
  const nextAction = lifecycleData ? lifecycleData.nextAction : null;

  // Render filter chips
  renderLifecycleFilterChipsGeneric($drillContext, stages, lifecycleFilter, (f) => {
    lifecycleFilter = f;
    renderDrillView();
  });

  // Build declaration cards grouped by lifecycle stage
  let firstUnapproved = null;
  const wrapper = document.createElement('div');
  wrapper.className = 'lifecycle-stages';

  LIFECYCLE_STAGES.forEach(stageDef => {
    const items = stages[stageDef.key] || [];
    if (lifecycleFilter && lifecycleFilter !== stageDef.key) return;
    if (items.length === 0 && !lifecycleFilter) return;

    const isDone = stageDef.key === 'done';
    const isCollapsed = isDone && lifecycleDoneCollapsed && !lifecycleFilter;

    const section = document.createElement('div');
    section.className = `lifecycle-section${isCollapsed ? ' collapsed' : ''}`;
    section.dataset.stage = stageDef.key;

    // Stage header with action buttons
    const header = document.createElement('div');
    header.className = 'lifecycle-header';

    let stageBtnHtml = '';
    if (stageDef.key === 'needs-planning' && items.length > 0) {
      stageBtnHtml = '<button class="lifecycle-stage-btn" data-stage-action="plan-next">Plan Next</button>';
      stageBtnHtml += `<button class="lifecycle-stage-btn" data-stage-action="plan-all">Plan All (${items.length})</button>`;
    } else if (stageDef.key === 'ready-to-execute' && items.length > 0) {
      stageBtnHtml = '<button class="lifecycle-stage-btn" data-stage-action="execute">Execute</button>';
    }

    header.innerHTML = `
      <span class="lifecycle-icon" style="color:${stageDef.color}">${stageDef.icon}</span>
      <span class="lifecycle-label">${escHtml(stageDef.label)}</span>
      <span class="lifecycle-count" style="background:${stageDef.color}20;color:${stageDef.color}">${items.length}</span>
      ${isDone ? `<span class="lifecycle-toggle">${isCollapsed ? '\u25B6' : '\u25BC'}</span>` : ''}
      <span class="lifecycle-header-spacer"></span>
      ${stageBtnHtml}
    `;
    if (isDone) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', (e) => {
        if (e.target.closest('.lifecycle-stage-btn')) return;
        lifecycleDoneCollapsed = !lifecycleDoneCollapsed;
        renderDrillView();
      });
    }

    // Wire stage action buttons
    const stageBtn = header.querySelector('.lifecycle-stage-btn');
    if (stageBtn) {
      stageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = stageBtn.dataset.stageAction;
        if (action === 'plan-next') {
          // Navigate into the first declaration needing planning
          const first = items[0];
          if (first) {
            drillDeclId = first.id;
            drillGoDeeper('milestones');
            renderDrillView();
          }
        } else if (action === 'plan-all') {
          // Kick off concurrent derivation for all declarations needing planning
          triggerDeriveAll();
        } else if (action === 'execute') {
          switchView('execution');
        }
      });
    }

    section.appendChild(header);

    // Cards — declaration cards with statement text
    if (!isCollapsed) {
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'drill-cards lifecycle-cards';
      cardsContainer.dataset.nodeType = 'declaration';

      items.forEach(d => {
        const needsReview = d.reviewState !== 'approved';
        const isCurrent = needsReview && !firstUnapproved;
        if (needsReview && !firstUnapproved) firstUnapproved = d;

        const stmt = d.statement || d.title || '';
        const myMiles = enrichedMilestones.filter(m => (m.realizes || []).includes(d.id));
        const mileCount = myMiles.length;
        const unapprovedMiles = myMiles.filter(m => m.reviewState !== 'approved').length;

        const isDeriving = activeDeriveMap.has(d.id);
        const runningAgent = getRunningAgentForNode(d.id);
        const isPending = pendingDerivations.has(d.id);
        const hasActiveWork = isDeriving || runningAgent || isPending;

        let statusLabel = d.displayStatus || d.status || 'PENDING';
        const statusClass = statusLabel === 'DONE' ? 's-done' : statusLabel === 'EXECUTING' ? 's-executing' : 's-planned';

        let badgesHtml = `<span class="drill-status-pill ${statusClass}">${escHtml(statusLabel)}</span>`;
        badgesHtml += reviewBadgeHtml(d.id, d.reviewState);
        if (mileCount > 0) {
          badgesHtml += `<span class="drill-card-stat">${mileCount} milestones`;
          if (unapprovedMiles > 0) badgesHtml += ` <strong>(${unapprovedMiles} need review)</strong>`;
          badgesHtml += '</span>';
        }

        const activeLabel = isPending ? 'Starting\u2026' : isDeriving ? 'Planning\u2026' : runningAgent ? (AGENT_TYPE_LABELS[runningAgent.type] || runningAgent.type) + '\u2026' : '';

        const el = document.createElement('div');
        el.className = `drill-card${needsReview ? ' needs-review' : ''}${isCurrent ? ' current-review' : ''}${hasActiveWork ? ' drill-card-deriving' : ''}`;
        el.innerHTML = `
          <div class="drill-card-top">
            <span class="drill-card-id">${escHtml(d.id)}</span>
            <div class="drill-card-body">
              <div class="drill-card-title">${escHtml(d.title || d.statement || d.id)}</div>
              <div class="drill-card-desc">${stmt !== (d.title || '') ? escHtml(stmt) : ''}</div>
              <div class="drill-card-badges">${badgesHtml}</div>
            </div>
          </div>
          ${renderEntityActions(d.id, d.reviewState, undefined, hasActiveWork ? activeLabel : null)}
        `;

        el.addEventListener('click', (e) => {
          if (e.target.closest('.drill-review-btn') || e.target.closest('.drill-action-btn') || e.target.closest('textarea') || e.target.closest('input') || e.target.closest('.refine-container') || e.target.closest('.discuss-container')) return;
          drillDeclId = d.id;
          drillGoDeeper('milestones');
          renderDrillView();
        });

        cardsContainer.appendChild(el);
      });

      section.appendChild(cardsContainer);
      wireInlineReviewButtons(cardsContainer);
      wireEntityMenus(cardsContainer);
    }

    wrapper.appendChild(section);
  });

  $drillList.appendChild(wrapper);

  $drillPrompt.innerHTML = '';
}


/**
 * Navigate into a lifecycle item by type.
 */
function navigateToItem(item, enrichedDeclarations, enrichedMilestones, actions) {
  if (item.type === 'declaration') {
    drillDeclId = item.id;
    drillGoDeeper('milestones');
    renderDrillView();
  } else if (item.type === 'milestone') {
    // Find parent declaration
    const decl = enrichedDeclarations.find(d => (d.milestones || []).includes(item.id));
    if (decl) drillDeclId = decl.id;
    drillMileId = item.id;
    drillGoDeeper('actions');
    renderDrillView();
  } else if (item.type === 'action') {
    // Find parent milestone and declaration
    const action = (actions || []).find(a => a.id === item.id);
    if (action) {
      const mId = (action.causes || [])[0];
      if (mId) {
        const mile = enrichedMilestones.find(m => m.id === mId);
        if (mile && mile.realizes && mile.realizes.length) drillDeclId = mile.realizes[0];
        drillMileId = mId;
      }
    }
    drillGoDeeper('actions');
    renderDrillView();
  }
}

/**
 * Render the prompt bar for lifecycle view using nextAction intelligence.
 */
function renderLifecyclePrompt(nextAction, enrichedDeclarations, enrichedMilestones, actions) {
  if (!$drillPrompt) return;

  if (!nextAction) {
    $drillPrompt.innerHTML = '';
    return;
  }

  if (nextAction.action === 'complete') {
    $drillPrompt.innerHTML = `<span class="drill-prompt-complete">${escHtml(nextAction.label)}</span>`;
    return;
  }

  // Count unapproved items across all types
  const allNodes = [...enrichedDeclarations, ...enrichedMilestones, ...(actions || [])];
  const unapprovedCount = allNodes.filter(n => n.reviewState !== 'approved' && !COMPLETED.has((n.status || '').toUpperCase())).length;

  const labelHtml = `<span class="drill-prompt-text">\u2192 ${escHtml(nextAction.label)}</span>`;

  let actionsHtml = '';
  if (nextAction.targetId) {
    actionsHtml += `<button class="drill-next-btn" id="drill-lifecycle-go"><kbd>N</kbd> Go</button>`;
  }
  if (unapprovedCount > 0) {
    actionsHtml += `<button class="drill-approve-all-btn" id="drill-approve-all"><kbd>⌃⇧A</kbd> Approve All (${unapprovedCount})</button>`;
  }

  $drillPrompt.innerHTML = labelHtml + actionsHtml;

  // Wire go button
  const goBtn = document.getElementById('drill-lifecycle-go');
  if (goBtn && nextAction.targetId) {
    goBtn.addEventListener('click', () => {
      if (nextAction.action === 'derive-milestones') {
        drillDeclId = nextAction.targetId;
        drillGoDeeper('milestones');
        renderDrillView();
      } else if (nextAction.action === 'derive-actions') {
        // Find parent declaration
        const mile = enrichedMilestones.find(m => m.id === nextAction.targetId);
        if (mile && mile.realizes && mile.realizes.length) drillDeclId = mile.realizes[0];
        drillMileId = nextAction.targetId;
        drillGoDeeper('actions');
        renderDrillView();
      } else if (nextAction.action === 'approve') {
        // Navigate to the node needing approval
        navigateToItem({
          id: nextAction.targetId,
          type: nextAction.targetType || 'declaration',
        }, enrichedDeclarations, enrichedMilestones, actions);
      } else if (nextAction.action === 'execute') {
        switchView('execution');
      }
    });
  }

  // Wire approve-all
  const approveAllBtn = document.getElementById('drill-approve-all');
  if (approveAllBtn) {
    approveAllBtn.addEventListener('click', () => approveAllVisible());
  }
}

/**
 * Classify declarations into lifecycle stages (declarations only, no mixing).
 */
function classifyDeclarationsToStages(declarations, milestones, actions) {
  const stages = { 'needs-planning': [], 'needs-approval': [], 'ready-to-execute': [], 'in-execution': [], 'done': [] };
  for (const d of declarations) {
    const status = (d.status || '').toUpperCase();
    if (COMPLETED.has(status) || d.displayStatus === 'DONE') {
      stages['done'].push(d);
      continue;
    }

    // A declaration's stage is determined by the worst stage of its children.
    // No milestones at all → needs planning.
    const myMiles = milestones.filter(m => (m.realizes || []).includes(d.id));
    if (myMiles.length === 0) {
      stages['needs-planning'].push(d);
      continue;
    }

    // Check each milestone's stage and bubble up the worst one.
    // Priority (worst to best): needs-planning > needs-approval > ready-to-execute > in-execution > done
    let worstStage = 'done';
    const stageRank = { 'needs-planning': 0, 'needs-approval': 1, 'ready-to-execute': 2, 'in-execution': 3, 'done': 4 };

    for (const m of myMiles) {
      const mStatus = (m.status || m.displayStatus || '').toUpperCase();
      let mStage;
      if (COMPLETED.has(mStatus) || m.displayStatus === 'DONE') {
        mStage = 'done';
      } else if (!(actions || []).some(a => (a.causes || []).includes(m.id))) {
        mStage = 'needs-planning';
      } else if (m.reviewState !== 'approved') {
        mStage = 'needs-approval';
      } else if (m.displayStatus === 'EXECUTING' || EXECUTING_STATUSES_SET.has(mStatus)) {
        mStage = 'in-execution';
      } else {
        mStage = 'ready-to-execute';
      }
      if (stageRank[mStage] < stageRank[worstStage]) {
        worstStage = mStage;
      }
    }

    // Declaration's own review state can also pull it back
    if (d.reviewState !== 'approved' && stageRank['needs-approval'] < stageRank[worstStage]) {
      worstStage = 'needs-approval';
    }

    stages[worstStage].push(d);
  }
  return stages;
}

/**
 * Classify a list of milestones into lifecycle stages.
 */
function classifyMilestonesToStages(milestones, actions) {
  const stages = { 'needs-planning': [], 'needs-approval': [], 'ready-to-execute': [], 'in-execution': [], 'done': [] };
  for (const m of milestones) {
    const status = (m.status || m.displayStatus || '').toUpperCase();
    if (COMPLETED.has(status) || m.displayStatus === 'DONE') {
      stages['done'].push(m);
    } else {
      const myActions = (actions || []).filter(a => (a.causes || []).includes(m.id));
      const hasActions = myActions.length > 0;
      const hasNoActionPlan = !m.hasPlan && !hasActions;
      const allActionsApproved = hasActions && myActions.every(a => a.reviewState === 'approved' || COMPLETED.has((a.status || '').toUpperCase()));
      const hasUnapprovedActions = hasActions && !allActionsApproved;
      if (hasNoActionPlan) {
        stages['needs-planning'].push(m);
      } else if (m.reviewState !== 'approved' || hasUnapprovedActions) {
        stages['needs-approval'].push(m);
      } else if (m.displayStatus === 'EXECUTING' || EXECUTING_STATUSES_SET.has(status)) {
        stages['in-execution'].push(m);
      } else {
        stages['ready-to-execute'].push(m);
      }
    }
  }
  return stages;
}

/**
 * Classify a list of actions into lifecycle stages.
 */
function classifyActionsToStages(actionsArr) {
  const stages = { 'needs-planning': [], 'needs-approval': [], 'ready-to-execute': [], 'in-execution': [], 'done': [] };
  for (const a of actionsArr) {
    const status = (a.status || '').toUpperCase();
    if (COMPLETED.has(status)) {
      stages['done'].push(a);
    } else if (runningActions.has(a.id) || EXECUTING_STATUSES_SET.has(status)) {
      stages['in-execution'].push(a);
    } else if (a.reviewState !== 'approved') {
      stages['needs-approval'].push(a);
    } else {
      stages['ready-to-execute'].push(a);
    }
  }
  return stages;
}

/**
 * Render lifecycle filter chips into a container for any level.
 * @param {HTMLElement} container - Element to render chips into
 * @param {Object} stages - Stage classification
 * @param {string|null} activeFilter - Current filter
 * @param {function} onFilter - Callback when filter changes
 */
function renderLifecycleFilterChipsGeneric(container, stages, activeFilter, onFilter) {
  const chips = document.createElement('div');
  chips.className = 'lifecycle-filter-chips';

  const allChip = document.createElement('button');
  allChip.className = `lifecycle-chip${!activeFilter ? ' active' : ''}`;
  allChip.textContent = 'All';
  allChip.addEventListener('click', () => onFilter(null));
  chips.appendChild(allChip);

  LIFECYCLE_STAGES.forEach(stageDef => {
    const items = stages[stageDef.key] || [];
    if (items.length === 0) return;
    const chip = document.createElement('button');
    chip.className = `lifecycle-chip${activeFilter === stageDef.key ? ' active' : ''}`;
    chip.innerHTML = `${escHtml(stageDef.label)} <span class="chip-count">${items.length}</span>`;
    chip.style.setProperty('--chip-color', stageDef.color);
    chip.addEventListener('click', () => onFilter(activeFilter === stageDef.key ? null : stageDef.key));
    chips.appendChild(chip);
  });

  container.innerHTML = '';
  container.appendChild(chips);
}

/**
 * Render items grouped by lifecycle stage sections.
 * @param {HTMLElement} listEl - Element to render sections into
 * @param {Object} stages - Stage classification
 * @param {string|null} filter - Active filter
 * @param {function} buildCard - Function to build a card element for an item
 * @param {Object} [opts] - Options like doneCollapsed
 */
function renderLifecycleSections(listEl, stages, filter, buildCard, opts) {
  const wrapper = document.createElement('div');
  wrapper.className = 'lifecycle-stages';
  const doneCollapsed = opts && opts.doneCollapsed;

  LIFECYCLE_STAGES.forEach(stageDef => {
    const items = stages[stageDef.key] || [];
    if (filter && filter !== stageDef.key) return;
    if (items.length === 0 && !filter) return;

    const isDone = stageDef.key === 'done';
    const isCollapsed = isDone && doneCollapsed && !filter;

    const section = document.createElement('div');
    section.className = `lifecycle-section${isCollapsed ? ' collapsed' : ''}`;
    section.dataset.stage = stageDef.key;

    const header = document.createElement('div');
    header.className = 'lifecycle-header';
    header.innerHTML = `
      <span class="lifecycle-icon" style="color:${stageDef.color}">${stageDef.icon}</span>
      <span class="lifecycle-label">${escHtml(stageDef.label)}</span>
      <span class="lifecycle-count" style="background:${stageDef.color}20;color:${stageDef.color}">${items.length}</span>
      ${isDone ? `<span class="lifecycle-toggle">${isCollapsed ? '\u25B6' : '\u25BC'}</span>` : ''}
    `;
    if (isDone) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        if (opts && opts.onToggleDone) opts.onToggleDone();
      });
    }
    section.appendChild(header);

    if (!isCollapsed) {
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'drill-cards lifecycle-cards';
      if (opts && opts.nodeType) cardsContainer.dataset.nodeType = opts.nodeType;

      items.forEach(item => {
        const el = buildCard(item);
        cardsContainer.appendChild(el);
      });

      section.appendChild(cardsContainer);
      wireInlineReviewButtons(cardsContainer);
      wireEntityMenus(cardsContainer);
    }

    wrapper.appendChild(section);
  });

  listEl.appendChild(wrapper);
}

/**
 * Empty state onboarding — shown when project has no declarations.
 * Renders centered project name, inline declaration input, and explanation.
 */
function renderEmptyOnboarding() {
  const projectName = (projectInfo && (projectInfo.title || projectInfo.folder)) || 'Your Project';

  $drillList.innerHTML = `
    <div class="onboarding-empty">
      <div class="onboarding-project">${escHtml(projectName)}</div>
      <div class="onboarding-heading">Describe your vision</div>
      <div class="onboarding-desc">Tell us what you're building. We'll ask clarifying questions, then break it down into concrete declarations with milestones.</div>
      <div class="onboarding-form">
        <textarea id="onboarding-vision" class="onboarding-textarea" placeholder="Describe what you're building, what problems it solves, key features, target users..." rows="10"></textarea>
        <button id="onboarding-submit" class="onboarding-btn">Let's go</button>
        <div id="onboarding-error" class="onboarding-error"></div>
      </div>
    </div>
  `;

  $drillPrompt.innerHTML = '';

  const $vision = document.getElementById('onboarding-vision');
  const $btn = document.getElementById('onboarding-submit');
  const $err = document.getElementById('onboarding-error');

  function submitVision() {
    const text = ($vision.value || '').trim();
    if (!text) {
      $err.textContent = 'Describe your vision first.';
      return;
    }
    startOnboard(text);
  }

  $btn.addEventListener('click', submitVision);
  $vision.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitVision();
  });
  requestAnimationFrame(() => $vision.focus());
}

/**
 * Level 2 — Milestones for a selected declaration, as cards.
 */
function renderDrillMilestones(enrichedDeclarations, enrichedMilestones, actions) {
  const decl = enrichedDeclarations.find(d => d.id === drillDeclId);
  if (!decl) { drillLevel = 'declarations'; renderDrillView(); return; }

  const title = decl.title || decl.statement || decl.id;

  // Breadcrumb is now in status bar (updated by renderDrillView caller)

  // Left detail panel — declaration info + review controls
  const stmt = decl.statement || decl.title || '';
  const declStatusClass = decl.displayStatus === 'DONE' ? 's-done' : decl.displayStatus === 'EXECUTING' ? 's-executing' : 's-planned';
  const declNeedsReview = decl.reviewState !== 'approved';

  $drillDetail.classList.add('visible');
  $drillDetail.dataset.nodeType = 'declaration';
  $drillDetail.innerHTML = `
    <div class="detail-id">${escHtml(decl.id)}</div>
    <div class="detail-title">${escHtml(title)}</div>
    <div class="detail-desc">${escHtml(stmt)}</div>
    <div class="detail-badges">
      <span class="drill-status-pill ${declStatusClass}">${escHtml(decl.displayStatus)}</span>
      ${reviewBadgeHtml(decl.id, decl.reviewState)}
    </div>
    ${decl.milestones && decl.milestones.length ? `<div class="detail-section-label">Milestones</div>
    <div class="detail-meta">${decl.milestones.length} total, viewing below</div>` : ''}
    ${renderEntityActions(decl.id, decl.reviewState, { shift: true })}
    <div class="refine-container" id="refine-area-${escHtml(decl.id)}"></div>
  `;
  wireInlineReviewButtons($drillDetail);
  wireEntityMenus($drillDetail);

  const filtered = enrichedMilestones.filter(m => (m.realizes || []).includes(drillDeclId));

  $drillList.innerHTML = '';
  if (filtered.length === 0) {
    $drillContext.innerHTML = '';
    $drillList.innerHTML = `
      <div class="col-empty-invite">
        <div class="empty-invite-title">No milestones yet</div>
        <div class="empty-invite-desc">Plan milestones to break this declaration into achievable steps.</div>
        <textarea class="empty-invite-input" id="plan-guidance-input" placeholder="Optional: guide the direction..." rows="2"></textarea>
        <button class="empty-invite-btn" id="plan-milestones-btn"><kbd>P</kbd> Plan Milestones</button>
        <div id="derivation-progress" class="derivation-progress" style="display:none"></div>
        <div id="derivation-log" class="output-log" style="display:none; min-height:0"></div>
      </div>`;
    $drillPrompt.innerHTML = '';

    // Wire the Plan button to trigger derivation
    const planBtn = document.getElementById('plan-milestones-btn');
    if (planBtn) {
      // If derivation is already running (triggered from declaration card or restored), show active state
      if (derivationSessionId) {
        planBtn.disabled = true;
        const startTime = derivationStartTime || Date.now();
        const elapsed0 = Math.floor((Date.now() - startTime) / 1000);
        planBtn.innerHTML = '<span class="derive-spinner"></span> Planning milestones\u2026 <span class="derive-elapsed">' + fmtElapsed(elapsed0) + '</span>';
        const elSpan = planBtn.querySelector('.derive-elapsed');
        const timer = setInterval(() => {
          if (!elSpan || !document.contains(elSpan)) { clearInterval(timer); return; }
          elSpan.textContent = fmtElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        planBtn._deriveTimer = timer;
        showDerivationProgress(startTime);
      }

      planBtn.addEventListener('click', () => {
        planBtn.disabled = true;
        derivationStartTime = Date.now();
        const startTime = derivationStartTime;
        planBtn.innerHTML = '<span class="derive-spinner"></span> Planning milestones\u2026 <span class="derive-elapsed">0s</span>';
        const elSpan = planBtn.querySelector('.derive-elapsed');
        const timer = setInterval(() => {
          if (!elSpan || !document.contains(elSpan)) { clearInterval(timer); return; }
          elSpan.textContent = fmtElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        planBtn._deriveTimer = timer;
        showDerivationProgress(startTime);
        startDerivation(drillDeclId);
      });
    }
    return;
  }

  // Classify milestones into lifecycle stages
  const stages = classifyMilestonesToStages(filtered, actions);

  // Render filter chips
  renderLifecycleFilterChipsGeneric($drillContext, stages, lifecycleFilterL2, (f) => {
    lifecycleFilterL2 = f;
    renderDrillView();
  });

  // Build cards grouped by lifecycle stage
  let firstUnapproved = null;
  renderLifecycleSections($drillList, stages, lifecycleFilterL2, (m) => {
    const mTitle = m.title || m.id;
    const needsReview = m.reviewState !== 'approved';
    const isCurrent = needsReview && !firstUnapproved;
    if (needsReview && !firstUnapproved) firstUnapproved = m;

    const myActions = (actions || []).filter(a => (a.causes || []).includes(m.id));
    let mDesc = m.description || m.produces || '';
    if (!mDesc && myActions.length > 0) {
      const actionDescs = myActions.map(a => a.produces).filter(Boolean);
      if (actionDescs.length > 0) mDesc = actionDescs.join(' \u00B7 ');
    }
    const actionReviewCount = myActions.filter(a => a.reviewState !== 'approved').length;

    let statusLabel, statusClass;
    if (m.totalCount > 0) {
      statusLabel = m.displayStatus === 'EXECUTING' ? `${m.doneCount}/${m.totalCount} DONE` : `${m.doneCount}/${m.totalCount}`;
      statusClass = m.displayStatus === 'EXECUTING' ? 's-executing' : m.displayStatus === 'DONE' ? 's-done' : 's-planned';
    } else {
      statusLabel = m.displayStatus;
      statusClass = m.displayStatus === 'DONE' ? 's-done' : m.displayStatus === 'EXECUTING' ? 's-executing' : 's-planned';
    }

    let badgesHtml = `<span class="drill-status-pill ${statusClass}">${escHtml(statusLabel)}</span>`;
    badgesHtml += reviewBadgeHtml(m.id, m.reviewState);
    if (myActions.length > 0) {
      badgesHtml += `<span class="drill-card-stat">${myActions.length} actions`;
      if (actionReviewCount > 0) badgesHtml += ` <strong>(${actionReviewCount} need review)</strong>`;
      badgesHtml += '</span>';
    }

    // Inline action list for milestone cards
    let actionListHtml = '';
    if (myActions.length > 0) {
      actionListHtml = '<ul class="drill-card-action-list">' +
        myActions.map(a => {
          const aStatus = (a.status || 'PENDING').toUpperCase();
          const isDone = COMPLETED.has(aStatus);
          const isApproved = a.reviewState === 'approved';
          const icon = isDone ? '\u2713' : isApproved ? '\u25CB' : '\u00B7';
          const cls = isDone ? 'done' : isApproved ? 'planned' : 'unplanned';
          return `<li class="${cls}"><span class="al-icon">${icon}</span>${escHtml(a.title || a.id)}</li>`;
        }).join('') + '</ul>';
    } else {
      actionListHtml = '<div class="drill-card-no-actions">No actions yet</div>';
    }

    const runningAgent = getRunningAgentForNode(m.id);
    const isPending = pendingDerivations.has(m.id);
    const hasActiveWork = runningAgent || isPending;
    const activeLabel = isPending ? 'Planning…' : runningAgent ? (AGENT_TYPE_LABELS[runningAgent.type] || runningAgent.type) + '…' : '';
    const el = document.createElement('div');
    el.className = `drill-card${needsReview ? ' needs-review' : ''}${isCurrent ? ' current-review' : ''}`;
    el.innerHTML = `
      <div class="drill-card-top">
        <span class="drill-card-id">${escHtml(m.id)}</span>
        <div class="drill-card-body">
          <div class="drill-card-title">${escHtml(mTitle)}</div>
          <div class="drill-card-desc">${mDesc !== mTitle ? escHtml(mDesc) : ''}</div>
          <div class="drill-card-badges">${badgesHtml}</div>
          ${actionListHtml}
        </div>
      </div>
      ${renderEntityActions(m.id, m.reviewState, undefined, hasActiveWork ? activeLabel : null)}
    `;

    el.addEventListener('click', (e) => {
      if (e.target.closest('.drill-review-btn') || e.target.closest('.drill-action-btn') || e.target.closest('textarea') || e.target.closest('input') || e.target.closest('.refine-container') || e.target.closest('.discuss-container')) return;
      drillMileId = m.id;
      drillGoDeeper('actions');
      renderDrillView();
    });

    return el;
  }, { nodeType: 'milestone', doneCollapsed: lifecycleDoneCollapsed, onToggleDone: () => { lifecycleDoneCollapsed = !lifecycleDoneCollapsed; renderDrillView(); } });

  $drillPrompt.innerHTML = '';
}

/**
 * Level 3 — Actions for a selected milestone, as cards.
 */
function renderDrillActions(enrichedDeclarations, enrichedMilestones, actions) {
  const decl = enrichedDeclarations.find(d => d.id === drillDeclId);
  const mile = enrichedMilestones.find(m => m.id === drillMileId);
  if (!decl || !mile) { drillLevel = 'milestones'; renderDrillView(); return; }

  const mileTitle = mile.title || mile.id;

  // Breadcrumb is now in status bar (updated by renderDrillView caller)

  // Filter actions for this milestone (used by detail panel and card list)
  const filtered = (actions || []).filter(a => (a.causes || []).includes(drillMileId));

  // Left detail panel — milestone info + review controls
  let produces = mile.description || mile.produces || '';
  if (!produces && filtered.length > 0) {
    const actionDescs = filtered.map(a => a.produces).filter(Boolean);
    if (actionDescs.length > 0) produces = actionDescs.join(' · ');
  }
  const mileNeedsReview = mile.reviewState !== 'approved';
  let mileStatusLabel, mileStatusClass;
  if (mile.totalCount > 0) {
    mileStatusLabel = `${mile.doneCount}/${mile.totalCount}`;
    mileStatusClass = mile.displayStatus === 'EXECUTING' ? 's-executing' : mile.displayStatus === 'DONE' ? 's-done' : 's-planned';
  } else {
    mileStatusLabel = mile.displayStatus;
    mileStatusClass = mile.displayStatus === 'DONE' ? 's-done' : mile.displayStatus === 'EXECUTING' ? 's-executing' : 's-planned';
  }

  $drillDetail.classList.add('visible');
  $drillDetail.dataset.nodeType = 'milestone';
  const declDesc = decl.statement || decl.title || '';
  $drillDetail.innerHTML = `
    <div class="detail-parent-context">
      <div class="detail-id" style="opacity:0.6">${escHtml(decl.id)}</div>
      <div class="detail-title" style="font-size:14px;opacity:0.8">${escHtml(decl.title || '')}</div>
      ${decl.statement ? `<div class="detail-desc" style="font-size:12px;opacity:0.6">${escHtml(truncate(decl.statement, 200))}</div>` : ''}
    </div>
    <hr style="border:none;border-top:1px solid var(--bg-3);margin:10px 0">
    <div class="detail-id">${escHtml(mile.id)}</div>
    <div class="detail-title">${escHtml(mileTitle)}</div>
    <div class="detail-desc">${produces ? escHtml(produces) : ''}</div>
    <div class="detail-badges">
      <span class="drill-status-pill ${mileStatusClass}">${escHtml(mileStatusLabel)}</span>
      ${reviewBadgeHtml(mile.id, mile.reviewState)}
    </div>
    ${renderEntityActions(mile.id, mile.reviewState, { shift: true })}
    <div class="refine-container" id="refine-area-${escHtml(mile.id)}"></div>
  `;
  wireInlineReviewButtons($drillDetail);
  wireEntityMenus($drillDetail);

  $drillList.innerHTML = '';
  if (filtered.length === 0) {
    $drillContext.innerHTML = '';

    // Check if derivation is already running for this milestone
    const isDerivingHere = actionDerivationSessionId && actionDerivationMilestoneId === drillMileId;

    $drillList.innerHTML = `
      <div class="col-empty-invite">
        <div class="empty-invite-title">No actions yet</div>
        <div class="empty-invite-desc">Plan actions to break this milestone into executable steps.</div>
        <textarea class="empty-invite-input" id="action-guidance-input" placeholder="Optional: guide the direction..." rows="2"></textarea>
        <button class="empty-invite-btn" id="action-derive-btn"${isDerivingHere ? ' disabled' : ''}>${isDerivingHere ? '<span class="derive-spinner"></span> Planning actions\u2026' : '<kbd>P</kbd> Plan Actions'}</button>
        <div id="action-derivation-log" class="output-log" style="${isDerivingHere ? '' : 'display:none;'} min-height:0"></div>
        <div id="action-derivation-proposals" style="display:none"></div>
      </div>`;
    $drillPrompt.innerHTML = '';

    // If derivation already has proposals, render them
    if (actionDerivationProposals && actionDerivationMilestoneId === drillMileId) {
      renderActionProposals();
    }

    // Wire the Plan button to trigger action derivation
    const deriveBtn = document.getElementById('action-derive-btn');
    if (deriveBtn && !isDerivingHere) {
      deriveBtn.addEventListener('click', () => {
        deriveBtn.disabled = true;
        deriveBtn.innerHTML = '<span class="derive-spinner"></span> Planning actions\u2026';
        const logEl = document.getElementById('action-derivation-log');
        if (logEl) logEl.style.display = '';
        startActionDerivation(drillMileId);
      });
    }
    return;
  }

  // Classify actions into lifecycle stages
  const stages = classifyActionsToStages(filtered);

  // Render filter chips
  renderLifecycleFilterChipsGeneric($drillContext, stages, lifecycleFilterL3, (f) => {
    lifecycleFilterL3 = f;
    renderDrillView();
  });

  // Build cards grouped by lifecycle stage
  let firstUnapproved = null;
  renderLifecycleSections($drillList, stages, lifecycleFilterL3, (a) => {
    const aTitle = a.title || a.id;
    const aDesc = a.produces || a.title || '';
    const status = a.status || 'PENDING';
    const needsReview = a.reviewState !== 'approved';
    const isCurrent = needsReview && !firstUnapproved;
    if (needsReview && !firstUnapproved) firstUnapproved = a;

    const statusClass = status === 'DONE' ? 's-done' : status === 'EXECUTING' ? 's-executing' : status === 'PENDING' ? 's-pending' : 's-planned';

    let badgesHtml = `<span class="drill-status-pill ${statusClass}">${escHtml(status)}</span>`;
    badgesHtml += reviewBadgeHtml(a.id, a.reviewState);

    const el = document.createElement('div');
    el.className = `drill-card${needsReview ? ' needs-review' : ''}${isCurrent ? ' current-review' : ''}`;
    el.innerHTML = `
      <div class="drill-card-top">
        <span class="drill-card-id">${escHtml(a.id)}</span>
        <div class="drill-card-body">
          <div class="drill-card-title">${escHtml(aTitle)}</div>
          <div class="drill-card-desc">${aDesc !== aTitle ? escHtml(aDesc) : ''}</div>
          <div class="drill-card-badges">${badgesHtml}</div>
        </div>
      </div>
      ${renderEntityActions(a.id, a.reviewState)}
    `;

    return el;
  }, { nodeType: 'action', doneCollapsed: lifecycleDoneCollapsed, onToggleDone: () => { lifecycleDoneCollapsed = !lifecycleDoneCollapsed; renderDrillView(); } });

  $drillPrompt.innerHTML = '';
}

// ─── Drill helper functions ──────────────────────────────────────────────────

/**
 * Return HTML for inline Approve/Revision buttons.
 */
function renderInlineReviewButtons(nodeId) {
  return `<span class="drill-review-actions">
    <button class="drill-review-btn approve-btn" data-review-action="approved" data-node-id="${escHtml(nodeId)}"><kbd>A</kbd> Approve</button>
    <button class="drill-review-btn revision-btn" data-review-action="revision_needed" data-node-id="${escHtml(nodeId)}"><kbd>R</kbd> Revise</button>
  </span>`;
}

/**
 * Return HTML for the unified entity action menu.
 * Available on ALL entities regardless of review state.
 */
function renderEntityActions(nodeId, reviewState, opts, activeLabel) {
  const shift = opts && opts.shift;
  const spinnerHtml = activeLabel ? `<span class="derive-card-status"><span class="derive-spinner"></span> ${escHtml(activeLabel)}</span>` : '';
  const k = (key) => shift ? `⇧${key}` : key;
  const needsApprove = reviewState !== 'approved';
  const prefix = nodeId.split('-')[0];
  const isDone = graphData && (() => {
    const allNodes = [...(graphData.declarations || []), ...(graphData.milestones || []), ...(graphData.actions || [])];
    const node = allNodes.find(n => n.id === nodeId);
    return node && COMPLETED.has((node.status || '').toUpperCase());
  })();

  if (isDone) {
    // Done milestones show no actions; other done nodes show Review/Delete
    if (prefix === 'M') return `<div class="drill-card-actions"></div>`;
    return `<div class="drill-card-actions">
      <button class="drill-action-btn" data-action="refine" data-mode="outdated" data-node-id="${escHtml(nodeId)}"><kbd>${k('R')}</kbd> Review</button>
      <button class="drill-action-btn drill-action-danger" data-action="delete" data-node-id="${escHtml(nodeId)}"><kbd>${k('D')}</kbd> Delete</button>
    </div>`;
  }

  // Primary action: what this node needs most right now
  let primaryBtn = '';
  if (prefix === 'A' && graphData) {
    const action = (graphData.actions || []).find(a => a.id === nodeId);
    if (action) {
      const isExecuting = runningActions.has(nodeId) || EXECUTING_STATUSES_SET.has((action.status || '').toUpperCase());
      if (isExecuting) {
        primaryBtn = `<button class="drill-action-btn drill-action-primary" disabled><kbd>${k('V')}</kbd> Running...</button>`;
      } else if (needsApprove) {
        // Approve is primary — shown below
      } else {
        // Approved, not executing — Execute is primary
        primaryBtn = `<button class="drill-action-btn drill-action-primary" data-action="execute" data-node-id="${escHtml(nodeId)}"><kbd>${k('E')}</kbd> Execute</button>`;
      }
    }
  } else if (prefix === 'M' && graphData) {
    const milestone = (graphData.milestones || []).find(m => m.id === nodeId);
    const myActions = (graphData.actions || []).filter(a => (a.causes || []).includes(nodeId));
    if (needsApprove) {
      // Unapproved milestone — no primary action, just Approve/Edit/Delete (shown below)
    } else if (myActions.length === 0) {
      // Approved, no actions — Plan Actions is primary
      primaryBtn = `<button class="drill-action-btn drill-action-primary" data-action="derive-actions" data-node-id="${escHtml(nodeId)}"><kbd>${k('P')}</kbd> Plan Actions</button>`;
    } else {
      const allApproved = myActions.every(a => a.reviewState === 'approved');
      const hasUnapproved = myActions.some(a => a.reviewState !== 'approved' && !COMPLETED.has((a.status || '').toUpperCase()));
      if (hasUnapproved) {
        // Has unapproved actions — primary is to navigate to review them
      } else if (allApproved) {
        // All actions approved — Execute is primary
        primaryBtn = `<button class="drill-action-btn drill-action-primary" data-action="execute-milestone" data-node-id="${escHtml(nodeId)}"><kbd>${k('E')}</kbd> Execute</button>`;
      }
    }
  } else if (prefix === 'D' && graphData) {
    const myMilestones = (graphData.milestones || []).filter(m => {
      const realizes = Array.isArray(m.realizes) ? m.realizes : [m.realizes];
      return realizes.includes(nodeId);
    });
    if (myMilestones.length === 0) {
      // No milestones — Derive Milestones is primary
      primaryBtn = `<button class="drill-action-btn drill-action-primary" data-action="derive-milestones" data-node-id="${escHtml(nodeId)}"><kbd>${k('P')}</kbd> Plan Milestones</button>`;
    } else {
      const hasUnapproved = myMilestones.some(m => m.reviewState !== 'approved' && !COMPLETED.has((m.status || '').toUpperCase()));
      if (hasUnapproved) {
        // Has unapproved milestones — no extra primary button, user can drill in
      }
    }
  }

  // Milestones and Declarations: primary + approve (if needed) + edit + delete
  if (prefix === 'M' || prefix === 'D') {
    const editBtn = `<button class="drill-action-btn" data-action="refine" data-mode="write" data-node-id="${escHtml(nodeId)}"><kbd>${k('E')}</kbd> Edit</button>`;
    const deleteBtn = `<button class="drill-action-btn drill-action-danger" data-action="delete" data-node-id="${escHtml(nodeId)}"><kbd>${k('D')}</kbd> Delete</button>`;
    return `<div class="drill-card-actions">
      ${primaryBtn}
      ${needsApprove ? `<button class="drill-review-btn approve-btn" data-review-action="approved" data-node-id="${escHtml(nodeId)}"><kbd>${k('A')}</kbd> Approve</button>` : ''}
      ${editBtn}
      ${deleteBtn}
      ${spinnerHtml}
    </div>`;
  }

  return `<div class="drill-card-actions">
    ${primaryBtn}
    ${needsApprove ? `<button class="drill-review-btn approve-btn" data-review-action="approved" data-node-id="${escHtml(nodeId)}"><kbd>${k('A')}</kbd> Approve</button>` : ''}
    <button class="drill-action-btn" data-action="refine" data-mode="outdated" data-node-id="${escHtml(nodeId)}"><kbd>${k('R')}</kbd> Review</button>
    <button class="drill-action-btn" data-action="refine" data-mode="write" data-node-id="${escHtml(nodeId)}"><kbd>${k('W')}</kbd> Write</button>
    <button class="drill-action-btn drill-action-danger" data-action="delete" data-node-id="${escHtml(nodeId)}"><kbd>${k('D')}</kbd> Delete</button>
    ${spinnerHtml}
  </div>`;
}

/**
 * Advance to the next thing needing attention.
 * If current level is all approved, go back up. If at top and all done, trigger execute.
 */
function drillAdvanceNext() {
  if (!graphData) return;
  const { declarations, milestones, actions } = graphData;
  const enrichedMilestones = (milestones || []).map(m => ({ ...m, ...deriveMilestoneStatus(m, actions || []) }));
  const enrichedDeclarations = (declarations || []).map(d => ({ ...d, displayStatus: deriveDeclarationStatus(d, enrichedMilestones) }));

  // Find first unapproved at each level
  const uDecl = enrichedDeclarations.find(d => d.reviewState !== 'approved');
  const uMile = enrichedMilestones.find(m => m.reviewState !== 'approved');
  const uAct = (actions || []).find(a => a.reviewState !== 'approved' && !COMPLETED.has((a.status || '').toUpperCase()));

  if (uAct) {
    const mileId = (uAct.causes || [])[0];
    if (mileId) {
      const mile = (milestones || []).find(m => m.id === mileId);
      if (mile && mile.realizes && mile.realizes.length) drillDeclId = mile.realizes[0];
      drillMileId = mileId;
    }
    drillLevel = 'actions';
  } else if (uMile) {
    if (uMile.realizes && uMile.realizes.length) drillDeclId = uMile.realizes[0];
    drillLevel = 'milestones';
  } else if (uDecl) {
    drillDeclId = uDecl.id;
    drillLevel = 'milestones';
  } else {
    // Everything approved — go to declarations and offer execute
    drillLevel = 'declarations';
    drillDeclId = null;
    drillMileId = null;
  }
  renderDrillView();
}

/**
 * Attach click handlers to inline review buttons within a container.
 */
function wireInlineReviewButtons($container) {
  $container.querySelectorAll('.drill-review-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId;
      const newState = btn.dataset.reviewAction;

      try {
        const resp = await fetch(`/api/node/${encodeURIComponent(nodeId)}/review-state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewState: newState }),
        });
        if (!resp.ok) {
          console.error('Failed to update review state');
          return;
        }

        // Update local graphData for instant feedback
        updateLocalReviewState(nodeId, newState);

        // Re-render drill view + refresh activity from server
        renderDrillView();
        loadActivity();
      } catch (err) {
        console.error('Failed to update review state:', err);
      }
    });
  });
}

/**
 * Wire entity action menu triggers and menu item clicks within a container.
 */
function wireEntityMenus($container) {
  // Action button clicks (flat action bar)
  $container.querySelectorAll('.drill-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = btn.dataset.nodeId;
      const action = btn.dataset.action;

      if (action === 'refine') {
        startRefine(nodeId, btn.dataset.mode);
      } else if (action === 'delete') {
        if (confirm(`Delete ${nodeId}? This cannot be undone.`)) {
          deleteNode(nodeId);
        }
      } else if (action === 'execute') {
        // Execute a single action
        fetch('/api/action/' + encodeURIComponent(nodeId) + '/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).then(r => r.json()).then(data => {
          if (data.error) {
            alert('Execute error: ' + data.error);
          } else {
            runningActions.add(nodeId);
            renderDrillView();
          }
        });
      } else if (action === 'execute-milestone') {
        // Execute all approved actions for this milestone
        const myActions = (graphData.actions || []).filter(a =>
          (a.causes || []).includes(nodeId) && a.reviewState === 'approved' && !COMPLETED.has((a.status || '').toUpperCase())
        );
        for (const a of myActions) {
          fetch('/api/action/' + encodeURIComponent(a.id) + '/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).then(r => r.json()).then(data => {
            if (!data.error) {
              runningActions.add(a.id);
              renderDrillView();
            }
          });
        }
      } else if (action === 'derive-actions') {
        // Navigate into milestone's actions view, then derive
        drillMileId = nodeId;
        drillGoDeeper('actions');
        renderDrillView();
        triggerDerivation(nodeId);
      } else if (action === 'derive-milestones') {
        // Navigate into milestones view, then start derivation
        drillDeclId = nodeId;
        drillLevel = 'milestones';
        renderDrillView();
        triggerDerivation(nodeId);
      } else if (action === 'discuss') {
        // Optional discuss phase before derivation
        startDiscuss(nodeId);
      }
    });
  });
}

/** Currently active refine node */
let refineActiveNodeId = null;
/** @type {Set<string>} Active refine node IDs for concurrent support */
const refineActiveNodes = new Set();

/**
 * Start a refine session for a node.
 */
async function startRefine(nodeId, mode) {
  if (mode === 'write') {
    // Show a text input for the user to type direction
    showWriteInput(nodeId);
    return;
  }
  doRefine(nodeId, mode, '');
}

function showWriteInput(nodeId) {
  // Find or create refine area in the detail panel or card
  const area = document.getElementById(`refine-area-${nodeId}`) || createRefineArea(nodeId);
  area.innerHTML = `
    <div class="refine-area">
      <textarea class="refine-write-input" placeholder="Type your direction for the AI..." rows="3"></textarea>
      <div class="refine-actions">
        <button class="refine-accept" id="refine-send-${nodeId}">Send</button>
        <button class="refine-discard" id="refine-cancel-${nodeId}">Cancel</button>
      </div>
    </div>
  `;
  const textarea = area.querySelector('.refine-write-input');
  textarea.focus();
  area.querySelector(`#refine-send-${nodeId}`).addEventListener('click', () => {
    const msg = textarea.value.trim();
    if (msg) doRefine(nodeId, 'write', msg);
  });
  area.querySelector(`#refine-cancel-${nodeId}`).addEventListener('click', () => {
    area.innerHTML = '';
  });
  // Allow Enter to submit (Shift+Enter for newline)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const msg = textarea.value.trim();
      if (msg) doRefine(nodeId, 'write', msg);
    }
  });
}

function createRefineArea(nodeId) {
  // Find the card for this node and append a refine area
  const card = document.querySelector(`.drill-card .drill-review-btn[data-node-id="${nodeId}"]`)?.closest('.drill-card')
    || document.querySelector(`.drill-action-btn[data-node-id="${nodeId}"]`)?.closest('.drill-card');
  if (card) {
    let area = card.querySelector('.refine-container');
    if (!area) {
      area = document.createElement('div');
      area.className = 'refine-container';
      area.id = `refine-area-${nodeId}`;
      card.appendChild(area);
    }
    return area;
  }
  // Fallback: append to detail panel
  const det = document.getElementById(`refine-area-${nodeId}`);
  if (det) return det;
  // Last resort: attach to drill-detail or drill-list so output is always visible
  const fallbackParent = document.getElementById('drill-detail') || document.getElementById('drill-list');
  if (fallbackParent) {
    const area = document.createElement('div');
    area.className = 'refine-container';
    area.id = `refine-area-${nodeId}`;
    fallbackParent.appendChild(area);
    return area;
  }
  return document.createElement('div'); // noop
}

/**
 * Trigger the appropriate derivation after discuss phase completes.
 * @param {string} nodeId
 */
function triggerDerivation(nodeId) {
  const prefix = nodeId.split('-')[0];
  if (prefix === 'D') {
    // Immediate visual feedback via pendingDerivations
    pendingDerivations.add(nodeId);
    derivationSessionId = 'pending';
    derivationStartTime = Date.now();
    derivationProposals = null;
    renderDrillView();
    // Derive milestones — capture real sessionId for SSE handler
    fetch('/api/milestones/derive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ declarationId: nodeId }),
    }).then(r => r.json()).then(data => {
      pendingDerivations.delete(nodeId);
      if (data.error) {
        console.error('Plan milestones error:', data.error);
        derivationSessionId = null;
        derivationStartTime = null;
      } else if (data.sessionId) {
        derivationSessionId = data.sessionId;
      }
      renderDrillView();
    }).catch(() => {
      pendingDerivations.delete(nodeId);
      derivationSessionId = null;
      derivationStartTime = null;
      renderDrillView();
    });
  } else if (prefix === 'M') {
    // Immediate visual feedback via pendingDerivations
    pendingDerivations.add(nodeId);
    actionDerivationSessionId = 'pending';
    actionDerivationMilestoneId = nodeId;
    actionDerivationProposals = null;
    renderDrillView();
    // Derive actions — capture real sessionId for SSE handler
    fetch('/api/milestones/' + encodeURIComponent(nodeId) + '/actions/derive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()).then(data => {
      pendingDerivations.delete(nodeId);
      if (data.error) {
        console.error('Plan actions error:', data.error);
        actionDerivationSessionId = null;
        actionDerivationMilestoneId = null;
      } else if (data.sessionId) {
        actionDerivationSessionId = data.sessionId;
      }
      renderDrillView();
    }).catch(() => {
      pendingDerivations.delete(nodeId);
      actionDerivationSessionId = null;
      actionDerivationMilestoneId = null;
      renderDrillView();
    });
  }
}

/** @type {string|null} Node ID with an active discuss session */
let discussActiveNodeId = null;
/** @type {HTMLElement|null} Detached discuss container preserved across re-renders */
let discussActiveContainer = null;

/**
 * Start a discuss (interview) phase for a node.
 * Shows a discuss area and kicks off the discuss agent.
 * @param {string} nodeId
 */
function startDiscuss(nodeId) {
  discussActiveNodeId = nodeId;

  // Create the discuss container
  const container = document.createElement('div');
  container.className = 'discuss-container';
  container.id = `discuss-area-${nodeId}`;
  discussActiveContainer = container;

  // Attach to current card
  reattachDiscussContainer();

  container.innerHTML = `<div class="discuss-loading">
    <pre class="discuss-streaming" id="discuss-output-${nodeId}">Thinking...</pre>
    <button class="drill-action-btn" id="discuss-skip-early-${nodeId}">Skip</button>
  </div>`;
  container.querySelector(`#discuss-skip-early-${nodeId}`).addEventListener('click', () => {
    clearDiscussState();
    triggerDerivation(nodeId);
  });

  fetch(`/api/node/${encodeURIComponent(nodeId)}/discuss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then(r => r.json()).then(data => {
    if (data.error) {
      clearDiscussState();
      triggerDerivation(nodeId);
    }
  }).catch(() => {
    clearDiscussState();
    triggerDerivation(nodeId);
  });
}

/** Clear discuss tracking state */
function clearDiscussState() {
  if (discussActiveContainer && discussActiveContainer.parentNode) {
    discussActiveContainer.parentNode.removeChild(discussActiveContainer);
  }
  discussActiveNodeId = null;
  discussActiveContainer = null;
}

/** Re-attach the discuss container to the card after a re-render */
function reattachDiscussContainer() {
  if (!discussActiveNodeId || !discussActiveContainer) return;
  // Remove from old parent if still attached
  if (discussActiveContainer.parentNode) {
    discussActiveContainer.parentNode.removeChild(discussActiveContainer);
  }
  // Find the card for this node
  const card = document.querySelector(`.drill-card[data-node-id="${discussActiveNodeId}"]`)
    || document.querySelector(`.drill-action-btn[data-node-id="${discussActiveNodeId}"]`)?.closest('.drill-card');
  if (card) {
    card.appendChild(discussActiveContainer);
  } else {
    // Fallback: append to drill-list
    const parent = document.getElementById('drill-list');
    if (parent) parent.appendChild(discussActiveContainer);
  }
}

async function doRefine(nodeId, mode, message) {
  refineActiveNodeId = nodeId;
  refineActiveNodes.add(nodeId);
  const area = document.getElementById(`refine-area-${nodeId}`) || createRefineArea(nodeId);
  area.innerHTML = `<div class="refine-area"><div class="refine-streaming">Thinking...</div>
    <div class="refine-actions"><button class="refine-discard" id="refine-cancel-${nodeId}">Cancel</button></div></div>`;
  area.querySelector(`#refine-cancel-${nodeId}`).addEventListener('click', async () => {
    try { await fetch('/api/refine/stop', { method: 'POST' }); } catch (_) {}
    area.innerHTML = '';
    refineActiveNodes.delete(nodeId);
    if (refineActiveNodeId === nodeId) refineActiveNodeId = null;
  });

  try {
    const resp = await fetch(`/api/node/${encodeURIComponent(nodeId)}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, message }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      area.innerHTML = `<div class="refine-area" style="border-color:var(--broken-color)">${escHtml(err.error || 'Failed')}</div>`;
      refineActiveNodes.delete(nodeId);
      if (refineActiveNodeId === nodeId) refineActiveNodeId = null;
    }
    // Output will stream via SSE
  } catch (err) {
    area.innerHTML = `<div class="refine-area" style="border-color:var(--broken-color)">${escHtml(err.message)}</div>`;
    refineActiveNodes.delete(nodeId);
    if (refineActiveNodeId === nodeId) refineActiveNodeId = null;
  }
}

async function archiveNode(nodeId) {
  try {
    const resp = await fetch(`/api/node/${encodeURIComponent(nodeId)}/review-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewState: 'approved' }),
    });
    if (resp.ok) {
      updateLocalReviewState(nodeId, 'approved');
      // Also mark status as DONE/KEPT via archive endpoint
      await fetch(`/api/node/${encodeURIComponent(nodeId)}/archive`, { method: 'POST' });
      loadData().then(() => renderDrillView());
      loadActivity();
    }
  } catch (err) {
    console.error('Archive failed:', err);
  }
}

async function deleteNode(nodeId) {
  try {
    const resp = await fetch(`/api/node/${encodeURIComponent(nodeId)}`, { method: 'DELETE' });
    if (resp.ok) {
      loadData().then(() => renderDrillView());
      loadActivity();
    }
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

/**
 * Update graphData in-memory with new review state for instant feedback.
 */
function updateLocalReviewState(nodeId, newState) {
  if (!graphData) return;
  const allNodes = [
    ...(graphData.declarations || []),
    ...(graphData.milestones || []),
    ...(graphData.actions || []),
  ];
  const node = allNodes.find(n => n.id === nodeId);
  if (node) node.reviewState = newState;
}

/**
 * Approve all visible entities of a given type (or all types at current drill level).
 * Sends parallel PUT requests and updates local state for instant feedback.
 */
async function approveAllVisible() {
  if (!graphData) return;
  let nodes;
  if (drillLevel === 'declarations') {
    nodes = (graphData.declarations || []).filter(n => n.reviewState !== 'approved');
  } else if (drillLevel === 'milestones') {
    const filtered = (graphData.milestones || []).filter(m =>
      (m.realizes || []).includes(drillDeclId)
    );
    nodes = filtered.filter(n => n.reviewState !== 'approved');
  } else if (drillLevel === 'actions') {
    const filtered = (graphData.actions || []).filter(a =>
      (a.causes || []).includes(drillMileId)
    );
    nodes = filtered.filter(n => n.reviewState !== 'approved');
  } else {
    return;
  }
  if (nodes.length === 0) return;

  // Fire all approve requests in parallel
  const promises = nodes.map(n =>
    fetch(`/api/node/${encodeURIComponent(n.id)}/review-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewState: 'approved' }),
    }).then(resp => {
      if (resp.ok) updateLocalReviewState(n.id, 'approved');
    }).catch(err => console.error(`Failed to approve ${n.id}:`, err))
  );
  await Promise.all(promises);
  renderDrillView();
  loadActivity();
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
  return ($drillBrowser && $drillBrowser.classList.contains('active')) ||
    ($colBrowser && $colBrowser.classList.contains('active'));
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
  // Don't intercept keys when user is typing in an input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  const key = e.key;

  // Drill browser: Escape goes back one level
  if (key === 'Escape') {
    if (drillLevel === 'actions') {
      e.preventDefault();
      drillGoBack('milestones');
      drillMileId = null;
      renderDrillView();
      return;
    } else if (drillLevel === 'milestones') {
      e.preventDefault();
      drillGoBack('declarations');
      drillDeclId = null;
      drillMileId = null;
      renderDrillView();
      return;
    }
    // At declarations level, let event propagate
    return;
  }
}

// Register the column browser keyboard handler
document.addEventListener('keydown', handleColumnKeydown);

// ─── Drill browser focus index ─────────────────────────────────────────────
/** @type {number} Currently focused card index in the list (-1 = none) */
let drillFocusIndex = -1;

/** Get all drill cards in the current list view */
function getDrillCards() {
  return Array.from(document.querySelectorAll('#drill-list .drill-card'));
}

/** Update the visual focus ring on drill cards */
function updateDrillFocus() {
  const cards = getDrillCards();
  cards.forEach((c, i) => c.classList.toggle('focused', i === drillFocusIndex));
  if (drillFocusIndex >= 0 && drillFocusIndex < cards.length) {
    cards[drillFocusIndex].scrollIntoView({ block: 'nearest' });
  }
}

/** Get the focused card element, or the current-review card as fallback */
function getFocusedCard() {
  const cards = getDrillCards();
  if (drillFocusIndex >= 0 && drillFocusIndex < cards.length) return cards[drillFocusIndex];
  return document.querySelector('.drill-card.current-review');
}

// ─── Keyboard shortcuts for drill browser ────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (viewMode !== 'columns') return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Ctrl+Shift+A = Approve All visible entities (Ctrl on all platforms, not Cmd)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    approveAllVisible();
    return;
  }

  // Ctrl+Shift+P = Global Plan (top-right button)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    if ($executeMainBtn && !$executeMainBtn.disabled) $executeMainBtn.click();
    return;
  }

  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const key = e.key;
  const kl = key.toLowerCase();

  // Arrow Up/Down — move focus in the card list
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    e.preventDefault();
    const cards = getDrillCards();
    if (cards.length === 0) return;
    if (key === 'ArrowDown') {
      drillFocusIndex = drillFocusIndex < cards.length - 1 ? drillFocusIndex + 1 : 0;
    } else {
      drillFocusIndex = drillFocusIndex > 0 ? drillFocusIndex - 1 : cards.length - 1;
    }
    updateDrillFocus();
    return;
  }

  // Arrow Right / Enter — drill into focused card
  if (key === 'ArrowRight' || key === 'Enter') {
    const card = getFocusedCard();
    if (!card) return;
    e.preventDefault();
    card.click();
    return;
  }

  // Arrow Left — go back one level
  if (key === 'ArrowLeft') {
    if (drillLevel === 'actions') {
      e.preventDefault();
      drillGoBack('milestones');
      drillMileId = null;
      renderDrillView();
    } else if (drillLevel === 'milestones') {
      e.preventDefault();
      drillGoBack('declarations');
      drillDeclId = null;
      drillMileId = null;
      renderDrillView();
    }
    return;
  }

  // P = Plan / Derive — trigger planning on focused/current card
  if (kl === 'p') {
    // 1. Empty-state Plan buttons (inside a view with no children)
    const planBtn = document.getElementById('plan-milestones-btn');
    if (planBtn && !planBtn.disabled) { e.preventDefault(); planBtn.click(); return; }
    const actionDeriveBtn = document.getElementById('action-derive-btn');
    if (actionDeriveBtn && !actionDeriveBtn.disabled) { e.preventDefault(); actionDeriveBtn.click(); return; }
    // 2. Focused or current-review card with derive button
    const card = getFocusedCard();
    if (card) {
      const deriveBtn = card.querySelector('[data-action="derive-actions"], [data-action="derive-milestones"]');
      if (deriveBtn) {
        e.preventDefault();
        const nodeId = deriveBtn.dataset.nodeId;
        if (nodeId) triggerDerivation(nodeId);
        return;
      }
    }
    // 3. Fallback: any visible derive button
    const anyDeriveBtn = document.querySelector('[data-action="derive-actions"], [data-action="derive-milestones"]');
    if (anyDeriveBtn) {
      e.preventDefault();
      const nodeId = anyDeriveBtn.dataset.nodeId;
      if (nodeId) triggerDerivation(nodeId);
      return;
    }
    return;
  }

  // E = Edit (click first Edit button on a card) or Execute (main button)
  if (kl === 'e') {
    // First try Edit on a card
    const editBtn = document.querySelector('.drill-card.current-review .drill-action-btn[data-mode="write"]')
      || document.querySelector('.drill-card .drill-action-btn[data-mode="write"]');
    if (editBtn) { e.preventDefault(); editBtn.click(); return; }
    // Fallback: Execute main button
    if ($executeMainBtn && !$executeMainBtn._nextTarget && !$executeMainBtn._planMode && !$executeMainBtn.disabled) {
      e.preventDefault(); $executeMainBtn.click(); return;
    }
    return;
  }

  // N = Next
  if (kl === 'n') {
    const nextBtn = document.getElementById('drill-next-btn');
    if (nextBtn) { e.preventDefault(); nextBtn.click(); return; }
    if ($executeMainBtn && $executeMainBtn._nextTarget) { e.preventDefault(); $executeMainBtn.click(); return; }
    return;
  }

  // Shift+R/E/W/D/A = act on detail panel entity
  if (e.shiftKey && (kl === 'r' || kl === 'e' || kl === 'w' || kl === 'd' || kl === 'a')) {
    const detail = document.getElementById('drill-detail');
    if (!detail) return;
    let btn;
    if (kl === 'r') btn = detail.querySelector('.drill-action-btn[data-mode="outdated"]');
    else if (kl === 'e' || kl === 'w') btn = detail.querySelector('.drill-action-btn[data-mode="write"]');
    else if (kl === 'd') btn = detail.querySelector('.drill-action-btn[data-action="delete"]');
    else if (kl === 'a') btn = detail.querySelector('.drill-review-btn[data-review-action="approved"]');
    if (btn) { e.preventDefault(); btn.click(); }
    return;
  }

  // R = Review focused card
  if (kl === 'r') {
    const card = getFocusedCard();
    if (!card) return;
    const btn = card.querySelector('.drill-action-btn[data-mode="outdated"]');
    if (btn) { e.preventDefault(); btn.click(); }
    return;
  }

  // W = Write on focused card
  if (kl === 'w') {
    const card = getFocusedCard();
    if (!card) return;
    const btn = card.querySelector('.drill-action-btn[data-mode="write"]');
    if (btn) { e.preventDefault(); btn.click(); }
    return;
  }

  // D = Delete focused card
  if (kl === 'd') {
    const card = getFocusedCard();
    if (!card) return;
    const btn = card.querySelector('.drill-action-btn[data-action="delete"]');
    if (btn) { e.preventDefault(); btn.click(); }
    return;
  }

  // A = Approve focused card (fall back to detail panel approve button)
  if (kl === 'a') {
    const card = getFocusedCard();
    if (card) {
      const btn = card.querySelector('.drill-review-btn[data-review-action="approved"]');
      if (btn) { e.preventDefault(); btn.click(); return; }
    }
    const detail = document.getElementById('drill-detail');
    if (detail) {
      const btn = detail.querySelector('.drill-review-btn[data-review-action="approved"]');
      if (btn) { e.preventDefault(); btn.click(); }
    }
    return;
  }
});

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
    // Update local data + re-render for instant feedback (don't rely solely on SSE)
    updateLocalReviewState(nodeId, nextState);
    renderDrillView();
    loadActivity();
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
    <span style="display:flex;align-items:center">Review &amp; Annotations${roundBadge}${diffToggle}</span>
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
      <button class="ann-approve-btn" id="ann-approve-btn"><kbd>A</kbd> Approve</button>
    </div>`;
    el.insertAdjacentHTML('beforeend', approveHtml);
  } else if (annotations.length === 0 && nodeReviewState === 'in_review') {
    const approveHtml = `<div class="ann-approve-section">
      <div class="ann-approve-msg">No annotations — ready to approve</div>
      <button class="ann-approve-btn" id="ann-approve-btn"><kbd>A</kbd> Approve</button>
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

  // In columns mode, auto-scroll to review controls for review-mode flow
  if (viewMode === 'columns') {
    setTimeout(() => {
      const reviewEl = document.getElementById('review-actions');
      if (reviewEl) reviewEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
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

    // If this is the focus node, add review action buttons
    if (isFocus) {
      const reviewState = s.item.reviewState || 'draft';
      const reviewLabel = REVIEW_DISPLAY[reviewState] || reviewState;
      const approveActive = reviewState === 'approved' ? ' ra-active' : '';
      const revisionActive = reviewState === 'revision_needed' ? ' ra-active' : '';
      html += `<div class="review-actions" id="review-actions">
        <button class="ra-btn ra-approve${approveActive}" data-action="approved" data-node-id="${s.item.id}"><kbd>A</kbd> Approve</button>
        <button class="ra-btn ra-revision${revisionActive}" data-action="revision_needed" data-node-id="${s.item.id}">Request Revision</button>
        <span class="ra-state">Review: ${escHtml(reviewLabel)}</span>
      </div>`;
    }

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
        html += `<button class="derive-btn" id="derive-btn">Plan Milestones</button>`;
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
        html += `<button class="derive-btn" id="action-derive-btn">Plan Actions</button>`;
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
        html += `<div id="plan-detail" style="margin-top:16px">
          <div class="detail-label" style="opacity:0.4">Loading plan…</div>
        </div>`;
      }
    }
  });

  $panelBody.innerHTML = html;

  // Wire review action buttons
  $panelBody.querySelectorAll('.ra-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetState = btn.dataset.action;
      const nodeId = btn.dataset.nodeId;
      if (!targetState || !nodeId) return;
      btn.disabled = true;
      try {
        const resp = await fetch('/api/node/' + encodeURIComponent(nodeId) + '/review-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewState: targetState }),
        });
        if (resp.ok) {
          // Update local graphData
          if (graphData) {
            let node = null;
            const focusS = sections.find(s => s.role === 'focus');
            if (focusS) {
              if (focusS.type === 'declaration') node = graphData.declarations.find(d => d.id === nodeId);
              if (focusS.type === 'milestone')   node = graphData.milestones.find(m => m.id === nodeId);
              if (focusS.type === 'action')      node = graphData.actions.find(a => a.id === nodeId);
              if (node) node.reviewState = targetState;
            }
          }
          // Update button active states visually
          $panelBody.querySelectorAll('.ra-btn').forEach(b => b.classList.remove('ra-active'));
          btn.classList.add('ra-active');
          // Update state label
          const stateLabel = $panelBody.querySelector('.ra-state');
          if (stateLabel) stateLabel.textContent = 'Review: ' + (REVIEW_DISPLAY[targetState] || targetState);
          // Update review badge in column browser / DAG
          const badge = document.querySelector('.review-badge[data-node-id="' + nodeId + '"]');
          if (badge) {
            badge.className = 'review-badge review-' + targetState;
            badge.dataset.reviewState = targetState;
            badge.textContent = REVIEW_DISPLAY[targetState] || targetState;
          }
        }
      } catch (_) { /* ignore */ }
      btn.disabled = false;
    });
  });

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

  // If an action is focused, fetch and render its plan
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

    const execPlanEl = $panelBody.querySelector('#plan-detail');
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
 * Fetch /api/action/:id and render the plan into #plan-detail.
 * @param {string} actionId
 */
async function loadExecPlan(actionId) {
  const container = document.getElementById('plan-detail');
  if (!container) return;

  try {
    const res = await fetch(`/api/action/${encodeURIComponent(actionId)}`);
    const data = await res.json();

    if (data.error || !data.execPlan) {
      container.innerHTML = `<div class="detail-label" style="opacity:0.4">No plan found</div>`;
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

    container.innerHTML = html || `<div class="detail-label" style="opacity:0.4">No plan details</div>`;

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
    if (container) container.innerHTML = `<div class="detail-label" style="opacity:0.4">Could not load plan</div>`;
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

    // Always buffer output for the execution view
    if (!execOutputBuffers[actionId]) execOutputBuffers[actionId] = '';
    execOutputBuffers[actionId] += text + '\n';

    // Route to execution view output panel if it's showing this action
    if (viewMode === 'execution' && actionId === execSelectedActionId && $execOutputLog) {
      $execOutputLog.appendChild(document.createTextNode(text + '\n'));
      $execOutputLog.scrollTop = $execOutputLog.scrollHeight;
    }

    // Existing detail panel output log
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

    // Append exit info to exec output buffer
    const exitMsg = `\n--- Process exited with code ${exitCode} ---\n`;
    if (!execOutputBuffers[actionId]) execOutputBuffers[actionId] = '';
    execOutputBuffers[actionId] += exitMsg;

    // Update execution view output panel if showing this action
    if (viewMode === 'execution' && actionId === execSelectedActionId && $execOutputLog) {
      $execOutputLog.appendChild(document.createTextNode(exitMsg));
      $execOutputLog.scrollTop = $execOutputLog.scrollHeight;
    }

    // Detail panel output log (existing behavior)
    if (actionId === currentOutputActionId) {
      const logEl = document.getElementById('output-log');
      if (logEl) {
        const span = document.createElement('span');
        span.className = `exit-code ${exitCode === 0 ? 'success' : 'failure'}`;
        span.textContent = `Process exited with code ${exitCode}`;
        logEl.appendChild(span);
        logEl.scrollTop = logEl.scrollHeight;
      }
      currentOutputActionId = null;
    }

    // Update progress counters
    if (exitCode === 0) {
      execCompletedActions++;
    } else {
      execFailedActions++;
    }
    updateExecProgress();

    // Update state
    runningActions.delete(actionId);
    updateRunningIndicators();

    // In execution view, auto-follow to next running action if enabled
    if (viewMode === 'execution' && execAutoFollow && actionId === execSelectedActionId) {
      // Find any still-running action to auto-select
      const nextRunning = Array.from(runningActions)[0];
      if (nextRunning) {
        selectExecAction(nextRunning, false);
      }
    }

    // Refresh execution view if active
    if (viewMode === 'execution') {
      if (orderConfirmed) renderExecutionView();
      else renderPreExecutionView();
    }

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
  if (!orderConfirmed) return;
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
 * Restore execution state on page load by fetching persisted pipeline state.
 * If a pipeline is actively running (or paused on failure), restores the
 * execution view with correct wave/action statuses and output buffers.
 */
async function restoreExecState() {
  try {
    const res = await fetch('/api/pipeline/state');
    const data = await res.json();
    if (!data.active) return;

    // Restore play state
    playRunning = data.running;
    playStatus = {
      currentWave: data.currentWave,
      totalWaves: data.totalWaves,
      activeActions: data.activeActions || [],
      completedActions: data.completedActions || [],
      failedActions: data.failedActions || [],
    };

    // Restore output buffers
    if (data.outputBuffers) {
      execOutputBuffers = data.outputBuffers;
    }

    // Restore progress tracking
    execTotalActions = data.totalActions || (data.completedActions || []).length + (data.failedActions || []).length + (data.activeActions || []).length;
    execCompletedActions = (data.completedActions || []).length;
    execFailedActions = (data.failedActions || []).length;

    // Mark running actions
    runningActions = new Set(data.activeActions || []);

    // Mark order as confirmed so renderExecutionView shows the live view
    orderConfirmed = true;

    // Switch to execution view
    switchView('execution');
    updatePlayUI();
    updateExecProgress();
    updateExecTopbar();

    // If paused on failure and showFailureModal exists, show it
    if (data.pausedOnFailure && typeof showFailureModal === 'function') {
      showFailureModal(
        data.pausedOnFailure.actionId,
        data.pausedOnFailure.exitCode,
        data.currentWave,
        data.totalWaves
      );
    }

    // Auto-select first running action for output display
    if (data.activeActions && data.activeActions.length > 0) {
      selectExecAction(data.activeActions[0], false);
    } else if (data.completedActions && data.completedActions.length > 0) {
      // If no running actions, select the last completed for review
      selectExecAction(data.completedActions[data.completedActions.length - 1], false);
    }
  } catch (_) {}
}

/**
 * Update play button and banner based on current play state.
 */
/**
 * Update the execution topbar title, wave status, and button visibility.
 */
function updateExecTopbar() {
  if (!$execTopbarTitle) return;
  if (!orderConfirmed) {
    $execTopbarTitle.textContent = 'Review Execution Order';
    if ($execWaveStatus) $execWaveStatus.textContent = '';
    if ($execStopBtn) $execStopBtn.style.display = 'none';
  } else if (playRunning && playStatus) {
    $execTopbarTitle.textContent = 'Execution Mode';
    if ($execWaveStatus) {
      $execWaveStatus.textContent = playStatus.totalWaves
        ? 'Wave ' + playStatus.currentWave + '/' + playStatus.totalWaves
        : '';
    }
    if ($execStopBtn) $execStopBtn.style.display = '';
  } else {
    $execTopbarTitle.textContent = 'Execution Complete';
    if ($execWaveStatus) $execWaveStatus.textContent = '';
    if ($execStopBtn) $execStopBtn.style.display = 'none';
  }
  updateExecProgress();
}

/**
 * Update the execution progress bar and percentage display.
 */
function updateExecProgress() {
  const pct = execTotalActions > 0
    ? Math.round(((execCompletedActions + execFailedActions) / execTotalActions) * 100)
    : 0;
  if ($execProgressFill) $execProgressFill.style.width = pct + '%';
  if ($execProgressPct) $execProgressPct.textContent = execTotalActions > 0 ? pct + '%' : '';
}

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
    // Reset progress counters
    execCompletedActions = 0;
    execFailedActions = 0;
    // Compute totalActions from data — use top-level field if present, else count from waves
    if (data.totalActions != null) {
      execTotalActions = data.totalActions;
    } else if (data.waves) {
      execTotalActions = 0;
      for (const w of data.waves) {
        for (const m of (w.milestones || [])) {
          execTotalActions += (m.actions || []).length;
        }
      }
    } else {
      execTotalActions = 0;
    }
    // Reset execution view output state for new run
    execOutputBuffers = {};
    execSelectedActionId = null;
    execAutoFollow = true;
    if ($execOutputHeader) $execOutputHeader.textContent = 'No action selected';
    if ($execOutputLog) $execOutputLog.textContent = '';
    updatePlayUI();
    updateExecProgress();
    // Auto-switch to execution mode when play starts
    switchView('execution');
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
    if (viewMode === 'execution') {
      if (orderConfirmed) {
        renderExecutionView();
        updateExecTopbar();
        // Auto-select first running action if auto-follow is on and no action selected (or selected is done)
        if (execAutoFollow && playStatus && playStatus.activeActions.length > 0) {
          const selectedDone = execSelectedActionId && !runningActions.has(execSelectedActionId);
          if (!execSelectedActionId || selectedDone) {
            selectExecAction(playStatus.activeActions[0], false);
          }
        }
      } else {
        renderPreExecutionView();
        updateExecTopbar();
      }
    }
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
    if (viewMode === 'execution') {
      if (orderConfirmed) {
        renderExecutionView();
        updateExecTopbar();
      } else {
        renderPreExecutionView();
        updateExecTopbar();
      }
    }
    loadData(); // refresh graph after each wave
  } catch (_) {}
}

// ─── Failure modal ────────────────────────────────────────────────────────────

/** @type {string | null} */
let failedActionId = null;

/**
 * Show the failure modal when pipeline pauses on a failed action.
 * @param {string} actionId
 * @param {number} exitCode
 * @param {number} wave
 * @param {number} totalWaves
 */
function showFailureModal(actionId, exitCode, wave, totalWaves) {
  failedActionId = actionId;
  if ($execFailureDetails) {
    $execFailureDetails.textContent = 'Action ' + actionId + ' exited with code ' + exitCode + '\nWave ' + wave + '/' + totalWaves;
  }
  if ($execFailureOverlay) $execFailureOverlay.style.display = '';
}

/**
 * Hide the failure modal.
 */
function hideFailureModal() {
  if ($execFailureOverlay) $execFailureOverlay.style.display = 'none';
  failedActionId = null;
}

/**
 * Handle play-complete SSE event.
 * @param {MessageEvent} e
 */
function handlePlayComplete(e) {
  try {
    const data = JSON.parse(e.data);
    playRunning = false;
    hideFailureModal();
    // Show 100% if pipeline completed (not stopped)
    if (!(data.stopped && data.stopped.length > 0)) {
      if ($execProgressFill) $execProgressFill.style.width = '100%';
      if ($execProgressPct) $execProgressPct.textContent = '100%';
    }
    // Keep playStatus briefly for display, then clear
    setTimeout(() => {
      playStatus = null;
      updatePlayUI();
    }, 3000);
    updatePlayUI();
    updateExecTopbar();
    loadData(); // final refresh
  } catch (_) {}
}

// ─── Derivation controls ──────────────────────────────────────────────────────

/** @type {number|null} Server-reported start time for active derivation (epoch ms) */
let derivationStartTime = null;
/** @type {number|null} Interval ID for derivation progress animation */
let derivationProgressTimer = null;

/** Format seconds as m:ss (e.g. 119 → "1:59") */
function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? m + ':' + String(s).padStart(2, '0') : s + 's';
}

const DERIVATION_PHASES = [
  { at: 0,  icon: '\u2699', text: 'Spawning AI agent\u2026' },
  { at: 3,  icon: '\uD83D\uDD0D', text: 'Analyzing declaration statement\u2026' },
  { at: 7,  icon: '\uD83E\uDDE0', text: 'Reasoning about what must be true\u2026' },
  { at: 12, icon: '\uD83C\uDFAF', text: 'Identifying key milestones\u2026' },
  { at: 18, icon: '\u2696\uFE0F', text: 'Evaluating milestone boundaries\u2026' },
  { at: 25, icon: '\uD83D\uDCDD', text: 'Drafting milestone proposals\u2026' },
  { at: 35, icon: '\u2728', text: 'Refining and validating output\u2026' },
  { at: 50, icon: '\u23F3', text: 'Almost there\u2026' },
  { at: 75, icon: '\uD83D\uDD04', text: 'Still working\u2026 complex declaration' },
];

/**
 * Show animated progress phases in the derivation progress area.
 * @param {number} startTime - Epoch ms when derivation started
 */
function showDerivationProgress(startTime) {
  if (derivationProgressTimer) clearInterval(derivationProgressTimer);

  const el = document.getElementById('derivation-progress');
  if (!el) return;
  el.style.display = '';

  let lastPhaseAt = -1;
  function update() {
    if (!document.contains(el)) { clearInterval(derivationProgressTimer); return; }
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    let phase = DERIVATION_PHASES[0];
    for (const p of DERIVATION_PHASES) {
      if (elapsed >= p.at) phase = p;
    }
    // Only update DOM when phase changes to avoid re-triggering animation
    if (phase.at !== lastPhaseAt) {
      lastPhaseAt = phase.at;
      el.innerHTML = `<div class="derive-phase">
        <span class="derive-phase-icon">${phase.icon}</span>
        <span class="derive-phase-text">${phase.text}</span>
      </div>`;
    }
  }

  update();
  derivationProgressTimer = setInterval(update, 1000);
}

/** Stop the derivation progress animation. */
function stopDerivationProgress() {
  if (derivationProgressTimer) { clearInterval(derivationProgressTimer); derivationProgressTimer = null; }
  const el = document.getElementById('derivation-progress');
  if (el) el.style.display = 'none';
}

/**
 * Restore running derivation state after page refresh.
 * Checks /api/derivation/running and restores derivationSessionId so SSE events reconnect.
 */
async function restoreRunningDerivations() {
  try {
    const data = await fetchJson('/api/derivation/running');
    if (data && data.sessions && data.sessions.length > 0) {
      const first = data.sessions[0];
      derivationSessionId = first.sessionId;
      derivationStartTime = first.startTime || null;
    }
  } catch (_) {}
}

/**
 * Trigger milestone derivation for a declaration via POST /api/milestones/derive.
 * @param {string} declarationId
 */
async function startDerivation(declarationId) {
  const btn = document.getElementById('derive-btn') || document.getElementById('plan-milestones-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Planning...';
  }

  const logEl = document.getElementById('derivation-log');
  if (logEl) {
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
      if (logEl) { logEl.style.display = ''; logEl.textContent = 'Error: ' + (data.error || 'Failed to start derivation'); }
      if (btn) { btn.disabled = false; btn.textContent = btn.id === 'plan-milestones-btn' ? 'Plan Milestones' : 'Plan Milestones'; }
      return;
    }

    derivationSessionId = data.sessionId;
    derivationProposals = null;
  } catch (err) {
    if (logEl) { logEl.style.display = ''; logEl.textContent = 'Error: ' + err.message; }
    if (btn) { btn.disabled = false; btn.textContent = btn.id === 'plan-milestones-btn' ? 'Plan Milestones' : 'Plan Milestones'; }
  }
}

/**
 * Handle incoming derivation-output SSE event.
 * Supports both single-session (detail panel) and concurrent (card-level) derivations.
 * @param {MessageEvent} e
 */
function handleDerivationOutput(e) {
  try {
    const { sessionId, declarationId, text, stream } = JSON.parse(e.data);

    // Concurrent derive-all mode: update activeDeriveMap
    if (declarationId && activeDeriveMap.has(declarationId)) {
      // Card-level derivation — no log panel needed
      return;
    }

    // Single-session mode: stream to progress area
    // Accept if pending (optimistic) or matching session
    if (derivationSessionId === 'pending') derivationSessionId = sessionId;
    if (derivationSessionId && sessionId !== derivationSessionId) return;
    if (!derivationSessionId) derivationSessionId = sessionId;

    // Update progress display with real streaming content
    const progressEl = document.getElementById('derivation-progress');
    if (progressEl && stream !== 'stderr') {
      progressEl.style.display = '';
      // Stop synthetic phases — we have real output now
      if (derivationProgressTimer) { clearInterval(derivationProgressTimer); derivationProgressTimer = null; }

      if (stream === 'status') {
        // Status messages (e.g. "Thinking...")
        progressEl.innerHTML = `<div class="derive-phase">
          <span class="derive-phase-icon">\u2699</span>
          <span class="derive-phase-text">${text}</span>
        </div>`;
      } else {
        // Streaming text — show accumulating output
        if (!progressEl._streamEl) {
          progressEl.innerHTML = `<div class="derive-phase">
            <span class="derive-phase-icon">\uD83D\uDCDD</span>
            <span class="derive-phase-text">Writing milestones\u2026</span>
          </div>
          <pre class="derive-stream-output"></pre>`;
          progressEl._streamEl = progressEl.querySelector('.derive-stream-output');
        }
        if (progressEl._streamEl) {
          progressEl._streamEl.textContent += text;
          progressEl._streamEl.scrollTop = progressEl._streamEl.scrollHeight;
        }
      }
    }
  } catch (_) {}
}

/**
 * Handle incoming derivation-complete SSE event.
 * Supports both single-session (detail panel) and concurrent (card-level) derivations.
 * @param {MessageEvent} e
 */
function handleDerivationComplete(e) {
  try {
    const { sessionId, declarationId, exitCode, milestones } = JSON.parse(e.data);

    // Concurrent derive-all mode: auto-accept milestones
    if (declarationId && activeDeriveMap.has(declarationId)) {
      activeDeriveMap.delete(declarationId);

      if (exitCode === 0 && milestones && Array.isArray(milestones)) {
        // Auto-accept only if declaration doesn't already have milestones
        const existingMilestones = graphData ? (graphData.milestones || []).filter(m => {
          const realizes = Array.isArray(m.realizes) ? m.realizes : [m.realizes];
          return realizes.includes(declarationId);
        }) : [];
        if (existingMilestones.length === 0) {
          const toAccept = milestones.map(m => ({
            title: m.title || '',
            description: m.description || m.reason || '',
            realizes: m.realizes || declarationId || '',
          }));
          fetch('/api/milestones/derive/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ milestones: toAccept }),
          }).catch(() => {});
        }
      }

      // Re-render to update card state
      renderDrillView();
      return;
    }

    // Single-session mode
    if (derivationSessionId === 'pending') derivationSessionId = sessionId;
    if (derivationSessionId && sessionId !== derivationSessionId) return;

    derivationSessionId = null;
    derivationStartTime = null;
    stopDerivationProgress();

    const btn = document.getElementById('derive-btn') || document.getElementById('plan-milestones-btn');
    if (btn) {
      if (btn._deriveTimer) { clearInterval(btn._deriveTimer); btn._deriveTimer = null; }
      btn.disabled = false;
      btn.innerHTML = btn.id === 'plan-milestones-btn' ? '<kbd>P</kbd> Plan Milestones' : 'Plan Milestones';
    }

    if (exitCode !== 0) {
      const logEl = document.getElementById('derivation-log');
      if (logEl) {
        logEl.style.display = '';
        const span = document.createElement('span');
        span.style.color = 'var(--broken-color)';
        span.style.fontWeight = '700';
        span.textContent = '\nPlanning failed (exit code ' + exitCode + ')';
        logEl.appendChild(span);
      }
      return;
    }

    if (milestones && Array.isArray(milestones)) {
      // Auto-accept milestones into the DAG — but only if this declaration doesn't already have milestones
      const declId = declarationId || drillDeclId || '';
      const existingMilestones = graphData ? (graphData.milestones || []).filter(m => {
        const realizes = Array.isArray(m.realizes) ? m.realizes : [m.realizes];
        return realizes.includes(declId);
      }) : [];
      if (existingMilestones.length === 0) {
        const toAccept = milestones.map(m => ({
          title: m.title || '',
          description: m.description || m.reason || '',
          realizes: m.realizes || declId || '',
        }));
        fetch('/api/milestones/derive/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestones: toAccept }),
        }).catch(() => {});
      }
      // SSE change event will trigger graph reload with the new milestones as DRAFT cards
    } else {
      const logEl = document.getElementById('derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--integrity-partial)';
        span.style.fontWeight = '600';
        span.textContent = '\nPlanning finished but output could not be parsed. Check the log above.';
        logEl.appendChild(span);
      }
    }
  } catch (_) {}
}

/**
 * Legacy renderProposals — no longer needed since milestones are auto-accepted.
 * Kept as no-op for any remaining references.
 */
function renderProposals() {}

/**
 * Accept derivation — legacy no-op, milestones are now auto-accepted on completion.
 */
async function acceptDerivation() {}

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
  renderDrillView();
}

/**
 * Trigger concurrent derivation for all declarations without milestones.
 * Calls POST /api/declarations/derive-all and populates activeDeriveMap.
 */
async function triggerDeriveAll() {
  try {
    const res = await fetch('/api/declarations/derive-all', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.ok) return;

    // Populate activeDeriveMap from response
    for (const s of (data.sessions || [])) {
      activeDeriveMap.set(s.declarationId, { sessionId: s.sessionId, status: 'running' });
    }

    // Re-render to show spinners on cards
    renderDrillView();
  } catch (err) {
    console.error('derive-all failed:', err);
  }
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
  if (btn) { btn.disabled = true; btn.textContent = 'Planning...'; }
  const logEl = document.getElementById('action-derivation-log');
  if (logEl) { logEl.style.display = ''; logEl.innerHTML = ''; }
  try {
    const res = await fetch('/api/milestones/' + encodeURIComponent(milestoneId) + '/actions/derive', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) {
      if (logEl) logEl.textContent = 'Error: ' + (data.error || 'Failed to start action derivation');
      if (btn) { btn.disabled = false; btn.textContent = 'Plan Actions'; }
      return;
    }
    actionDerivationSessionId = data.sessionId;
    actionDerivationMilestoneId = milestoneId;
    actionDerivationProposals = null;
  } catch (err) {
    if (logEl) logEl.textContent = 'Error: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Plan Actions'; }
  }
}

function handleActionDerivationOutput(e) {
  try {
    const { sessionId, text } = JSON.parse(e.data);
    // Accept output if session matches OR if we haven't captured the session ID yet
    if (actionDerivationSessionId && sessionId !== actionDerivationSessionId) return;
    // Capture session ID from first output event if we missed it
    if (!actionDerivationSessionId) actionDerivationSessionId = sessionId;
    const logEl = document.getElementById('action-derivation-log');
    if (!logEl) return;
    logEl.appendChild(document.createTextNode(text + '\n'));
    logEl.scrollTop = logEl.scrollHeight;
  } catch (_) {}
}

function handleActionDerivationComplete(e) {
  try {
    const { sessionId, milestoneId, exitCode, actions } = JSON.parse(e.data);
    // Accept completion if session matches OR if we haven't captured the session ID yet
    if (actionDerivationSessionId && sessionId !== actionDerivationSessionId) return;
    actionDerivationSessionId = null;
    const btn = document.getElementById('action-derive-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Plan Actions'; }
    if (exitCode !== 0) {
      const logEl = document.getElementById('action-derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--broken-color)';
        span.style.fontWeight = '700';
        span.textContent = '\nAction planning failed (exit code ' + exitCode + ')';
        logEl.appendChild(span);
      }
      return;
    }
    if (actions && Array.isArray(actions)) {
      // Auto-accept: persist actions immediately (same as milestones), then re-render as cards
      const targetMilestoneId = milestoneId || actionDerivationMilestoneId;
      if (targetMilestoneId) {
        const acceptPayload = actions.map(a => ({ title: a.title, produces: a.produces || '' }));
        fetch('/api/milestones/' + encodeURIComponent(targetMilestoneId) + '/actions/derive/accept', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actions: acceptPayload }),
        }).then(r => r.json()).then(data => {
          actionDerivationProposals = null;
          actionDerivationMilestoneId = null;
          if (!data.error) {
            // Reload graph so new actions appear as cards
            loadData();
          }
        }).catch(() => {
          actionDerivationProposals = null;
          actionDerivationMilestoneId = null;
        });
      }
    } else {
      const logEl = document.getElementById('action-derivation-log');
      if (logEl) {
        const span = document.createElement('span');
        span.style.color = 'var(--integrity-partial)';
        span.style.fontWeight = '600';
        span.textContent = '\nPlanning finished but output could not be parsed. Check the log above.';
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
  if (btn) { btn.disabled = false; btn.textContent = 'Plan Actions'; }
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

// ─── Execution pipeline view ──────────────────────────────────────────────────

/**
 * Select an action in the execution view's output panel.
 * Shows that action's buffered output (or live output if running).
 * @param {string} actionId
 * @param {boolean} [manual=false] Whether this was a manual user click
 */
function selectExecAction(actionId, manual) {
  execSelectedActionId = actionId;

  // If user manually clicks a non-running action, disable auto-follow
  if (manual && !runningActions.has(actionId)) {
    execAutoFollow = false;
  } else if (manual && runningActions.has(actionId)) {
    execAutoFollow = true;
  }

  // Update header
  if ($execOutputHeader) {
    const action = graphData && (graphData.actions || []).find(a => a.id === actionId);
    const title = action ? `${actionId}: ${action.title || ''}` : actionId;
    $execOutputHeader.textContent = title;
  }

  // Populate output log from buffer
  if ($execOutputLog) {
    $execOutputLog.textContent = execOutputBuffers[actionId] || '';
    $execOutputLog.scrollTop = $execOutputLog.scrollHeight;
  }

  // Re-render pipeline to highlight the selected action
  renderExecutionView();
}

/**
 * Compute wave ordering of milestones using Kahn's algorithm.
 * Returns array of waves, each wave being an array of milestone objects.
 * @returns {Array<Array<{id:string, status:string, title:string, dependsOn?:string[], classification?:string, hasPlan?:boolean}>>}
 */
function computeWaveOrder() {
  if (!graphData) return [];
  const milestones = graphData.milestones || [];

  const candidateIds = new Set(milestones.map(m => m.id.toUpperCase()));

  /** @type {Map<string, string[]>} */
  const deps = new Map();
  for (const m of milestones) {
    const mId = m.id.toUpperCase();
    const mDeps = (m.dependsOn || [])
      .map(d => d.toUpperCase())
      .filter(d => candidateIds.has(d));
    deps.set(mId, mDeps);
  }

  /** @type {Array<Array<{id:string, status:string, title:string, dependsOn?:string[], classification?:string, hasPlan?:boolean}>>} */
  const waves = [];
  const placed = new Set();

  while (placed.size < milestones.length) {
    const wave = [];
    for (const m of milestones) {
      const mId = m.id.toUpperCase();
      if (placed.has(mId)) continue;
      const mDeps = deps.get(mId) || [];
      const allDepsMet = mDeps.every(d => placed.has(d) || !candidateIds.has(d));
      if (allDepsMet) {
        wave.push(m);
      }
    }
    if (wave.length === 0) {
      // Circular dependency fallback — add remaining
      for (const m of milestones) {
        if (!placed.has(m.id.toUpperCase())) wave.push(m);
      }
    }
    for (const m of wave) placed.add(m.id.toUpperCase());
    waves.push(wave);
  }

  return waves;
}

/**
 * Render the pre-execution wave order view — shows computed execution order
 * as an ordered list with a Confirm Order button before execution controls are available.
 * Supports drag-to-reorder within wave (milestones) and within milestone (actions).
 */
function renderPreExecutionView() {
  const $pipeline = document.getElementById('exec-pipeline');
  if (!$pipeline || !graphData) return;

  const allActions = graphData.actions || [];

  // Initialise mutable wave state on first render (or after reset)
  if (!preExecWaves) {
    const rawWaves = computeWaveOrder();
    // Enrich each milestone with its resolved actions list
    preExecWaves = rawWaves.map(wave =>
      wave.map(m => ({
        ...m,
        actions: allActions.filter(a => (a.causes || []).includes(m.id))
      }))
    );
  }

  let html = '<div class="exec-preorder-list">';
  preExecWaves.forEach((wave, waveIdx) => {
    html += `<div class="exec-preorder-wave">`;
    html += `<div class="exec-preorder-wave-header">Wave ${waveIdx + 1}</div>`;

    wave.forEach((m, mileIdx) => {
      const mStatus = deriveMilestoneStatus(m, allActions);
      html += `<div class="exec-preorder-milestone" draggable="true" data-wave-idx="${waveIdx}" data-milestone-idx="${mileIdx}">${escHtml(m.id)}: ${escHtml(m.title || '')} — ${escHtml(mStatus.displayStatus)}</div>`;

      const mActions = m.actions || [];
      mActions.forEach((a, actIdx) => {
        const aStatus = (a.status || '').toUpperCase();
        let dotClass = 'queued';
        if (COMPLETED.has(aStatus)) dotClass = 'done';
        else if (aStatus === 'BROKEN' || aStatus === 'FAILED') dotClass = 'failed';

        html += `<div class="exec-preorder-action" draggable="true" data-wave-idx="${waveIdx}" data-milestone-idx="${mileIdx}" data-action-idx="${actIdx}">`;
        html += `<span class="exec-status-dot ${dotClass}"></span>`;
        html += `<span>${escHtml(a.id)}: ${escHtml(a.title || '')}</span>`;
        html += `</div>`;
      });
    });

    html += `</div>`;
  });

  if (preExecWaves.length === 0) {
    html += '<div style="color:var(--text-dim);padding:20px;font-size:13px;">No milestones to display.</div>';
  }

  html += '</div>';
  html += '<button class="exec-confirm-btn" id="exec-confirm-btn">Confirm Order</button>';

  $pipeline.innerHTML = html;

  // ── Drag-and-drop wiring ──

  /** Remove all drag feedback classes from the DOM */
  function clearDragClasses() {
    $pipeline.querySelectorAll('.exec-drop-valid, .exec-drop-invalid, .exec-dragging').forEach(el => {
      el.classList.remove('exec-drop-valid', 'exec-drop-invalid', 'exec-dragging');
    });
  }

  // Wire milestone drag handlers
  $pipeline.querySelectorAll('.exec-preorder-milestone[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      const wIdx = Number(el.dataset.waveIdx);
      const mIdx = Number(el.dataset.milestoneIdx);
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'milestone', waveIdx: wIdx, mileIdx: mIdx }));
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('exec-dragging');
      dragSourceWave = wIdx;
      dragSourceMile = null;
    });
    el.addEventListener('dragend', () => {
      clearDragClasses();
      dragSourceWave = null;
      dragSourceMile = null;
    });
    el.addEventListener('dragover', (e) => {
      if (dragSourceWave === null) return;
      // Only milestone-type drags target milestone elements
      const targetWave = Number(el.dataset.waveIdx);
      if (dragSourceMile !== null) {
        // This is an action drag — milestone is not a valid target
        el.classList.add('exec-drop-invalid');
        el.classList.remove('exec-drop-valid');
        return;
      }
      if (targetWave === dragSourceWave) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('exec-drop-valid');
        el.classList.remove('exec-drop-invalid');
      } else {
        el.classList.add('exec-drop-invalid');
        el.classList.remove('exec-drop-valid');
      }
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('exec-drop-valid', 'exec-drop-invalid');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('exec-drop-valid', 'exec-drop-invalid');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type !== 'milestone') return;
        const srcWave = data.waveIdx;
        const srcIdx = data.mileIdx;
        const tgtWave = Number(el.dataset.waveIdx);
        const tgtIdx = Number(el.dataset.milestoneIdx);
        if (srcWave !== tgtWave || srcIdx === tgtIdx) return;
        // Splice and insert
        const [moved] = preExecWaves[srcWave].splice(srcIdx, 1);
        preExecWaves[tgtWave].splice(tgtIdx, 0, moved);
        renderPreExecutionView();
      } catch (_) { /* ignore malformed data */ }
    });
  });

  // Wire action drag handlers
  $pipeline.querySelectorAll('.exec-preorder-action[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      const wIdx = Number(el.dataset.waveIdx);
      const mIdx = Number(el.dataset.milestoneIdx);
      const aIdx = Number(el.dataset.actionIdx);
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'action', waveIdx: wIdx, mileIdx: mIdx, actIdx: aIdx }));
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('exec-dragging');
      dragSourceWave = wIdx;
      dragSourceMile = mIdx;
    });
    el.addEventListener('dragend', () => {
      clearDragClasses();
      dragSourceWave = null;
      dragSourceMile = null;
    });
    el.addEventListener('dragover', (e) => {
      if (dragSourceWave === null || dragSourceMile === null) return;
      const targetWave = Number(el.dataset.waveIdx);
      const targetMile = Number(el.dataset.milestoneIdx);
      if (targetWave === dragSourceWave && targetMile === dragSourceMile) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('exec-drop-valid');
        el.classList.remove('exec-drop-invalid');
      } else {
        el.classList.add('exec-drop-invalid');
        el.classList.remove('exec-drop-valid');
      }
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('exec-drop-valid', 'exec-drop-invalid');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('exec-drop-valid', 'exec-drop-invalid');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type !== 'action') return;
        const srcWave = data.waveIdx;
        const srcMile = data.mileIdx;
        const srcIdx = data.actIdx;
        const tgtWave = Number(el.dataset.waveIdx);
        const tgtMile = Number(el.dataset.milestoneIdx);
        const tgtIdx = Number(el.dataset.actionIdx);
        if (srcWave !== tgtWave || srcMile !== tgtMile || srcIdx === tgtIdx) return;
        const actionsArr = preExecWaves[srcWave][srcMile].actions;
        const [moved] = actionsArr.splice(srcIdx, 1);
        actionsArr.splice(tgtIdx, 0, moved);
        renderPreExecutionView();
      } catch (_) { /* ignore malformed data */ }
    });
  });

  // ── Confirm button — POST manifest and transition ──
  const confirmBtn = document.getElementById('exec-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const manifest = {
        waves: preExecWaves.map((wave, i) => ({
          waveNumber: i + 1,
          milestones: wave.map(m => ({
            id: m.id,
            actions: (m.actions || []).map(a => a.id)
          }))
        }))
      };
      try {
        const resp = await fetch('/api/execution-manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manifest)
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          alert('Failed to save execution manifest: ' + errBody);
          return;
        }
        orderConfirmed = true;
        renderExecutionView();
        updateExecTopbar();
      } catch (err) {
        alert('Failed to save execution manifest: ' + err.message);
      }
    });
  }
}

/**
 * Render the execution pipeline view — milestones grouped by dependency waves
 * with nested actions showing status indicators in a CI-pipeline layout.
 */
function renderExecutionView() {
  const $pipeline = document.getElementById('exec-pipeline');
  if (!$pipeline || !graphData) return;

  const actions = graphData.actions || [];
  const waves = computeWaveOrder();

  // Build HTML
  let html = '';
  waves.forEach((wave, waveIdx) => {
    html += `<div class="exec-wave-label">Wave ${waveIdx + 1}</div>`;

    for (const m of wave) {
      const mStatus = deriveMilestoneStatus(m, actions);
      const myActions = actions.filter(a => (a.causes || []).includes(m.id));

      html += `<div class="exec-milestone-group" data-milestone-id="${escHtml(m.id)}">`;
      html += `<div class="exec-milestone-header">`;
      html += `<span>${escHtml(m.id)}: ${escHtml(m.title || '')}</span>`;
      html += `<span class="exec-milestone-status">${escHtml(mStatus.displayStatus)} (${mStatus.doneCount}/${mStatus.totalCount})</span>`;
      html += `</div>`;

      if (myActions.length > 0) {
        html += `<div class="exec-action-list">`;
        for (const a of myActions) {
          const aStatus = (a.status || '').toUpperCase();
          const isRunning = runningActions.has(a.id);
          let dotClass = 'queued';
          let labelText = aStatus || 'QUEUED';

          if (isRunning) {
            dotClass = 'running';
            labelText = 'RUNNING';
          } else if (COMPLETED.has(aStatus)) {
            dotClass = 'done';
          } else if (aStatus === 'BROKEN' || aStatus === 'FAILED') {
            dotClass = 'failed';
          }

          const isSelected = (a.id === execSelectedActionId);
          const isActive = (isRunning || isSelected) ? ' active' : '';
          html += `<div class="exec-action-item${isActive}" data-action-id="${escHtml(a.id)}">`;
          html += `<span class="exec-status-dot ${dotClass}"></span>`;
          html += `<span class="exec-action-title">${escHtml(a.id)}: ${escHtml(a.title || '')}</span>`;
          html += `<span class="exec-action-status-label">${escHtml(labelText)}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      html += `</div>`;
    }
  });

  if (waves.length === 0) {
    html = '<div style="color:var(--text-dim);padding:20px;font-size:13px;">No milestones to display.</div>';
  }

  $pipeline.innerHTML = html;

  // Wire click handlers for action items — select in output panel + open detail
  $pipeline.querySelectorAll('.exec-action-item').forEach(el => {
    el.addEventListener('click', () => {
      const actionId = el.getAttribute('data-action-id');
      if (actionId) {
        selectExecAction(actionId, true);
        selectNode(actionId, 'action');
      }
    });
  });
}

// ─── View switching (DAG / Column browser / Execution) ────────────────────────

/**
 * Check whether all non-DONE actions are approved, allowing execution mode.
 * Returns true when there are no unapproved actions (or no actions at all).
 * @returns {boolean}
 */
function canEnterExecution() {
  const actions = (graphData && graphData.actions) || [];
  const nonDone = actions.filter(a => !COMPLETED.has((a.status || '').toUpperCase()));
  if (nonDone.length === 0) return true;
  return nonDone.every(a => a.reviewState === 'approved');
}

/**
 * Switch between DAG, column browser, and execution views.
 * @param {'dag'|'columns'|'execution'} mode
 */
function switchView(mode) {
  if (mode === 'execution' && !canEnterExecution()) {
    console.warn('Cannot enter execution mode: unapproved actions remain');
    return;
  }
  viewMode = mode;
  localStorage.setItem('declare-view-mode', mode);

  // Hide all views first
  $canvasWrap.style.display = 'none';
  if ($drillBrowser) $drillBrowser.classList.remove('active');
  if ($readinessBanner) $readinessBanner.classList.remove('active');
  if ($execView) $execView.classList.remove('active');
  document.body.classList.remove('exec-mode');
  document.body.classList.remove('dag-mode');

  if (mode === 'dag') {
    $canvasWrap.style.display = '';
    document.body.classList.add('dag-mode');
    clearColumnBrowserKbFocus();
    if ($viewToggle) $viewToggleLabel.innerHTML = '&#x2630;'; // hamburger = list view
    // Redraw edges since layout changed
    requestAnimationFrame(() => drawEdges());
  } else if (mode === 'columns') {
    // Exit focus mode before switching to columns
    if (focusNodeId) exitFocusMode();
    if ($drillBrowser) $drillBrowser.classList.add('active');
    if ($viewToggle) $viewToggleLabel.innerHTML = '&#x2B13;'; // graph icon
    // Refresh drill browser data
    renderDrillView();
  } else if (mode === 'execution') {
    if (focusNodeId) exitFocusMode();
    if ($execView) $execView.classList.add('active');
    document.body.classList.add('exec-mode');
    if ($viewToggle) $viewToggleLabel.innerHTML = '&#x2630;';
    orderConfirmed = false;
    preExecWaves = null;
    renderPreExecutionView();
    updateExecTopbar();
  }
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

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

// View toggle button — cycles: columns -> dag (execution excluded, entered only via play)
if ($viewToggle) {
  $viewToggle.addEventListener('click', () => {
    if (viewMode === 'columns') {
      switchView('dag');
    } else {
      switchView('columns');
    }
  });
}

// Execution topbar buttons
if ($execExitBtn) {
  $execExitBtn.addEventListener('click', () => switchView('columns'));
}
if ($execStopBtn) {
  $execStopBtn.addEventListener('click', () => stopPlay());
}

// Failure modal buttons
if ($execFailureView) {
  $execFailureView.addEventListener('click', () => {
    if (failedActionId) selectExecAction(failedActionId, true);
    hideFailureModal();
  });
}
if ($execFailureSkip) {
  $execFailureSkip.addEventListener('click', () => {
    fetch('/api/pipeline/skip-action', { method: 'POST' });
    hideFailureModal();
  });
}
if ($execFailureStop) {
  $execFailureStop.addEventListener('click', () => {
    fetch('/api/play/stop', { method: 'POST' });
    hideFailureModal();
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

if ($refreshBtn) $refreshBtn.addEventListener('click', () => { loadData(); });

// Execute / Next main button
if ($executeMainBtn) {
  $executeMainBtn.addEventListener('click', () => {
    // Lifecycle-aware navigation
    const lca = $executeMainBtn._lifecycleAction;
    if (lca) {
      if (lca.action === 'derive-milestones' && lca.targetId) {
        drillDeclId = lca.targetId;
        drillLevel = 'milestones';
        if (viewMode !== 'columns') switchView('columns');
        else renderDrillView();
        return;
      }
      if (lca.action === 'derive-actions' && lca.targetId && graphData) {
        const mile = (graphData.milestones || []).find(m => m.id === lca.targetId);
        if (mile && mile.realizes && mile.realizes.length) drillDeclId = mile.realizes[0];
        drillMileId = lca.targetId;
        drillLevel = 'actions';
        if (viewMode !== 'columns') switchView('columns');
        else renderDrillView();
        return;
      }
      if (lca.action === 'approve' && lca.targetId && graphData) {
        // Navigate to the node needing approval
        const { declarations, milestones, actions: acts } = graphData;
        const enrichedM = (milestones || []).map(m => ({ ...m, ...deriveMilestoneStatus(m, acts || []) }));
        const enrichedD = (declarations || []).map(d => ({ ...d, displayStatus: deriveDeclarationStatus(d, enrichedM) }));
        navigateToItem({ id: lca.targetId, type: lca.targetType || 'declaration' }, enrichedD, enrichedM, acts || []);
        return;
      }
      if (lca.action === 'execute') {
        if (canEnterExecution()) switchView('execution');
        return;
      }
    }

    // Fallback: original logic
    const target = $executeMainBtn._nextTarget;
    if (target) {
      if (target.action) {
        const action = target.action;
        const mileId = (action.causes || [])[0];
        if (mileId && graphData) {
          const mile = (graphData.milestones || []).find(m => m.id === mileId);
          if (mile && mile.realizes && mile.realizes.length) {
            drillDeclId = mile.realizes[0];
          }
          drillMileId = mileId;
          drillLevel = 'actions';
        }
      } else if (target.mile) {
        const mile = target.mile;
        if (mile.realizes && mile.realizes.length) {
          drillDeclId = mile.realizes[0];
        }
        drillLevel = 'milestones';
      } else if (target.decl) {
        drillDeclId = target.decl.id;
        drillLevel = 'milestones';
      }
      if (viewMode !== 'columns') switchView('columns');
      else renderDrillView();
    } else if ($executeMainBtn._planMode) {
      if (graphData) {
        const { declarations, milestones, actions: acts } = graphData;
        const enrichedM = (milestones || []).map(m => ({ ...m, ...deriveMilestoneStatus(m, acts || []) }));
        const enrichedD = (declarations || []).map(d => ({ ...d, displayStatus: deriveDeclarationStatus(d, enrichedM) }));
        const pending = enrichedD.find(d => d.displayStatus === 'PENDING');
        if (pending) {
          drillDeclId = pending.id;
          drillLevel = 'milestones';
          if (viewMode !== 'columns') switchView('columns');
          else renderDrillView();
        }
      }
    } else if (canEnterExecution()) {
      switchView('execution');
    }
  });
}

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

// --- Agent activity cards ---

const AGENT_TYPE_ICONS = { executor: '\uD83E\uDD16', planner: '\uD83D\uDCCB', deriver: '\u26A1', researcher: '\uD83D\uDD0D', revision: '\uD83D\uDD04', command: '\u2328\uFE0F', refine: '\uD83D\uDD0D', derivation: '\u26A1', 'action-derivation': '\u26A1', default: '\u2699\uFE0F' };
const AGENT_TYPE_LABELS = { derivation: 'Planning', 'action-derivation': 'Planning Actions', revision: 'Revision', execution: 'Execution', pipeline: 'Pipeline', refine: 'Refine', discuss: 'Discuss', command: 'Command' };

const AGENT_STATUS_LABELS = { running: 'Running', complete: 'Done', done: 'Done', failed: 'Failed', interrupted: 'Stopped' };

/**
 * Format elapsed time between two timestamps as a human-readable string.
 * @param {string|number} startedAt - ISO string or ms timestamp
 * @param {string|number|null} [completedAt] - ISO string, ms timestamp, or null (for running agents)
 * @returns {string} e.g. "0:05", "1:23", "1h 05m"
 */
function formatElapsed(startedAt, completedAt) {
  const start = typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt;
  const end = completedAt ? (typeof completedAt === 'string' ? new Date(completedAt).getTime() : completedAt) : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  if (diffSec >= 3600) {
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Generate a human-readable completion summary for an agent.
 * @param {object} agent
 * @returns {string}
 */
function getAgentCompletionSummary(agent) {
  const result = agent.result || {};
  switch (agent.type) {
    case 'execution':
      return 'Executed ' + (result.actionId || agent.target);
    case 'derivation': {
      const count = result.milestones ? result.milestones.length : 0;
      return count > 0 ? 'Planned ' + count + ' milestone' + (count !== 1 ? 's' : '') : 'Planning complete';
    }
    case 'action-derivation': {
      const count = result.actionCount;
      const mId = result.milestoneId || agent.target;
      return count != null ? 'Planned ' + count + ' action' + (count !== 1 ? 's' : '') + ' for ' + mId : 'Actions planned for ' + mId;
    }
    case 'revision':
      return 'Revised ' + (result.nodeId || agent.target);
    case 'pipeline': {
      const c = result.completed || 0;
      const f = result.failed || 0;
      return c + ' completed' + (f > 0 ? ', ' + f + ' failed' : '');
    }
    default:
      return 'Completed';
  }
}

/**
 * Render a single agent activity card as an HTML string.
 * @param {{ id: string, type: string, target: string, milestoneId?: string, status: string, startedAt: string|number, updatedAt?: string|number, completedAt?: string|number, exitCode?: number, error?: string, result?: any }} agent
 * @returns {string} HTML string
 */
function renderAgentCard(agent) {
  const icon = AGENT_TYPE_ICONS[agent.type] || AGENT_TYPE_ICONS.default;
  const statusLabel = AGENT_STATUS_LABELS[agent.status] || agent.status;
  const elapsed = formatElapsed(agent.startedAt, agent.completedAt || null);
  const completedAttr = agent.completedAt ? escHtml(String(agent.completedAt)) : '';

  let errorHtml = '';
  if (agent.error) {
    const truncated = agent.error.length > 120 ? agent.error.slice(0, 117) + '...' : agent.error;
    errorHtml = `<div class="agent-card-error" title="${escHtml(agent.error)}">${escHtml(truncated)}</div>`;
  }

  // Completion summary for done agents
  let summaryHtml = '';
  const isDone = agent.status === 'complete' || agent.status === 'done';
  if (isDone) {
    const summary = getAgentCompletionSummary(agent);
    summaryHtml = `<div class="agent-card-summary">${escHtml(summary)}</div>`;
  }

  // "View Result" button for done agents only (not failed)
  let viewResultHtml = '';
  if (isDone) {
    viewResultHtml = `<button class="agent-card-view-result" data-agent-id="${escHtml(agent.id)}">View Result</button>`;
  }

  // Timer class: final for completed/failed, ticking for running
  const timerClass = (isDone || agent.status === 'failed') ? 'agent-card-timer agent-timer-final' : 'agent-card-timer';

  return `<div class="agent-card status-${escHtml(agent.status)}" data-agent-id="${escHtml(agent.id)}" data-target="${escHtml(agent.target || '')}" style="cursor:pointer">
  <div class="agent-card-header">
    <span class="agent-card-icon">${icon}</span>
    <span class="agent-card-target">${escHtml(agent.target || '')}</span>
    <span class="agent-card-badge badge-${escHtml(agent.status)}">${escHtml(statusLabel)}</span>
  </div>
  <div class="agent-card-meta">
    <span class="agent-card-type">${escHtml(AGENT_TYPE_LABELS[agent.type] || agent.type || '')}</span>
    <span class="${timerClass}" data-started="${escHtml(String(agent.startedAt))}" data-completed="${completedAttr}">${elapsed}</span>
  </div>
  ${errorHtml}
  ${summaryHtml}
  ${viewResultHtml}
</div>`;
}

let cardTimerInterval = null;

/** Start the 1-second interval that updates elapsed timers on running agent cards. */
function startCardTimers() {
  if (cardTimerInterval) return;
  cardTimerInterval = setInterval(() => {
    const timers = document.querySelectorAll('.agent-card.status-running .agent-card-timer');
    timers.forEach(el => {
      const started = el.getAttribute('data-started');
      if (started) el.textContent = formatElapsed(started, null);
    });
  }, 1000);
}

/** Stop the card timer interval. */
function stopCardTimers() {
  if (cardTimerInterval) {
    clearInterval(cardTimerInterval);
    cardTimerInterval = null;
  }
}

/** Map of active/recent agent states keyed by agent ID. */
const agentCardState = new Map();

// DOM references for card containers (A-124)
const $activityCards = document.getElementById('activity-cards');
const $activityCardsActive = document.getElementById('activity-cards-active');
const $activityCardsRecent = document.getElementById('activity-cards-recent');

/**
 * Re-render the agent cards panel.
 * Splits agents from agentCardState into active (running) and recent (done/failed),
 * renders them into #activity-cards-active and #activity-cards-recent.
 */
function renderAgentPanel() {
  if (!$activityCardsActive) return;

  const agents = Array.from(agentCardState.values());
  const active = agents
    .filter(a => a.status === 'running')
    .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
  const recent = agents
    .filter(a => a.status === 'complete' || a.status === 'done' || a.status === 'failed' || a.status === 'interrupted')
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || 0).getTime() - new Date(a.completedAt || a.updatedAt || 0).getTime())
    .slice(0, 10);

  if (active.length === 0 && recent.length === 0) {
    $activityCardsActive.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:11px;text-align:center;">No active agents</div>';
    $activityCardsRecent.innerHTML = '';
    stopCardTimers();
    return;
  }

  $activityCardsActive.innerHTML = active.length > 0
    ? active.map(renderAgentCard).join('')
    : '<div style="padding:16px;color:var(--text-muted);font-size:11px;text-align:center;">No active agents</div>';
  $activityCardsRecent.innerHTML = recent.map(renderAgentCard).join('');

  if (active.length > 0) startCardTimers(); else stopCardTimers();
}

// Delegated click handler for "View Result" buttons on agent cards (A-128)
function handleViewResultClick(e) {
  const btn = e.target.closest('.agent-card-view-result');
  if (!btn) return;
  e.stopPropagation();
  const agentId = btn.getAttribute('data-agent-id');
  const agent = agentCardState.get(agentId);
  if (agent) navigateToResult(agent);
}
// Delegated click handler: clicking an agent card navigates to its target node
function handleAgentCardClick(e) {
  // Don't navigate if clicking a button (View Result, etc.)
  if (e.target.closest('button')) return;
  const card = e.target.closest('.agent-card');
  if (!card) return;
  const target = card.getAttribute('data-target');
  if (!target || !graphData) return;
  const prefix = target.split('-')[0];
  if (prefix === 'D') {
    drillDeclId = target;
    drillLevel = 'milestones';
    drillMileId = null;
    pushDrillHash();
    renderDrillView();
  } else if (prefix === 'M') {
    const mile = (graphData.milestones || []).find(m => m.id === target);
    if (mile && mile.realizes && mile.realizes.length) drillDeclId = mile.realizes[0];
    drillMileId = target;
    drillLevel = 'actions';
    pushDrillHash();
    renderDrillView();
  } else if (prefix === 'A') {
    const action = (graphData.actions || []).find(a => a.id === target);
    if (action && action.causes && action.causes.length) {
      drillMileId = action.causes[0];
      const parentMile = (graphData.milestones || []).find(m => m.id === drillMileId);
      if (parentMile && parentMile.realizes && parentMile.realizes.length) drillDeclId = parentMile.realizes[0];
      drillLevel = 'actions';
      pushDrillHash();
      renderDrillView();
    }
  }
}
if ($activityCardsActive) $activityCardsActive.addEventListener('click', handleAgentCardClick);
if ($activityCardsRecent) $activityCardsRecent.addEventListener('click', handleAgentCardClick);

if ($activityCardsActive) $activityCardsActive.addEventListener('click', handleViewResultClick);
if ($activityCardsRecent) $activityCardsRecent.addEventListener('click', handleViewResultClick);

// Tab switching for Agents/Log tabs (A-124)
document.querySelectorAll('.activity-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.activity-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.activity-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab === 'cards' ? $activityCards : document.getElementById('activity-list');
    if (target) target.classList.add('active');
  });
});

/**
 * Check if any agent is actively running for a given node ID.
 * @param {string} nodeId
 * @returns {{ type: string, id: string } | null}
 */
function getRunningAgentForNode(nodeId) {
  for (const [, agent] of agentCardState) {
    if (agent.status === 'running' && agent.target === nodeId) return agent;
  }
  return null;
}

/**
 * Fetch current agent state from server and populate card state.
 * Called on page load and SSE reconnect to ensure cards survive refresh.
 */
async function loadAgentCards() {
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) return;
    const data = await res.json();
    const agents = [].concat(data.active || [], data.recent || []);

    // Replace entire state with server truth
    agentCardState.clear();
    for (const agent of agents) {
      agentCardState.set(agent.id, agent);
    }
    renderAgentPanel();
    if (agents.length > 0) {
      console.log('[agents]', agents.length, 'agents loaded, active:', agents.filter(a => a.status === 'running').length);
    }
  } catch (err) {
    console.error('[agents] loadAgentCards failed:', err);
  }
}

// ─── Activity topbar ──────────────────────────────────────────────────────────

/** @type {{ actionId: string, milestoneId?: string, startedAt: number } | null} */
let topbarActiveOp = null;
/** @type {{ actionId: string, milestoneId?: string, completedAt: number } | null} */
let topbarLastOp = null;

// updateTopbar() — no-op, replaced by agent cards panel (A-124)
function updateTopbar() {}

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

// topbarOnActivity() — simplified to just pulse the activity indicator (A-124)
function topbarOnActivity() {
  if ($activityPulse) {
    $activityPulse.classList.add('live');
    clearTimeout($activityPulse._topbarTimer);
    $activityPulse._topbarTimer = setTimeout(() => $activityPulse.classList.remove('live'), 3000);
  }
}

setInterval(function() { if (!topbarActiveOp && topbarLastOp) updateTopbar(); }, 30000);

// ─── Activity feed ────────────────────────────────────────────────────────────

const $activityFeed   = document.getElementById('activity-feed');
const $activityList   = document.getElementById('activity-list');
const $activityPulse  = document.getElementById('activity-pulse');
const $activityToggle = document.getElementById('activity-toggle');
let activityExpanded  = false;

/**
 * Fetch /api/activity and render — server is single source of truth.
 */
async function loadActivity() {
  if (!$activityList) return;
  try {
    const res = await fetch('/api/activity');
    const { events } = await res.json();

    if (!events || events.length === 0) {
      $activityList.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px;text-align:center;">No activity yet</div>';
      return;
    }

    $activityFeed.classList.add('has-events');

    const html = events.slice(0, 60).map(ev => {
      const time = new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      let icon, label, labelClass, desc;

      if (ev.tool === 'Review') {
        icon = ev.reviewState === 'approved' ? '\u2705' : '\u270F\uFE0F';
        label = ev.desc || `Review: ${ev.nodeId}`;
        labelClass = 'review';
        desc = ev.reviewState === 'approved' ? 'Marked as approved' : 'Sent back for revision';
      } else if (ev.tool === 'Task') {
        icon = ev.phase === 'start' ? '\u27F3' : '\u2713';
        labelClass = ev.phase === 'start' ? 'agent-start' : 'agent-done';
        label = ev.phase === 'start' ? `Spawning ${ev.agent || 'agent'}` : 'Done';
        desc = ev.desc || '';
      } else if (ev.tool === 'Bash') {
        icon = '\u25B6';
        label = 'Command';
        labelClass = 'bash';
        desc = ev.cmd || '';
      } else if (ev.tool === 'Write') {
        icon = '\u270E';
        label = 'Write';
        labelClass = 'write';
        desc = ev.file || '';
      } else {
        return '';
      }

      // Extract node ID from desc for navigation
      const nodeMatch = (desc || '').match(/\b([DMA]-\d+)\b/);
      const clickable = nodeMatch ? ' clickable' : '';
      const nodeAttr = nodeMatch ? ` data-nav-node="${nodeMatch[1]}"` : '';

      return `<div class="activity-event${clickable}"${nodeAttr}>
        <div class="ae-top">
          <span class="ae-icon">${icon}</span>
          <span class="ae-label ${labelClass}">${escHtml(label)}</span>
          <span style="flex:1"></span>
          <span class="ae-time">${time}</span>
        </div>
        ${desc ? `<div class="ae-desc">${escHtml(desc)}</div>` : ''}
      </div>`;
    }).filter(Boolean).join('');

    $activityList.innerHTML = html;

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
  'derive-milestones':  'Plan Milestones',
  'derive-actions':     'Plan Actions',
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

async function loadLifecycleData() {
  try {
    lifecycleData = await fetchJson('/api/lifecycle');
    // Re-render if we're at the declarations level (lifecycle view)
    if (drillLevel === 'declarations' && viewMode === 'columns') {
      renderDrillView();
    }
  } catch (_) {
    lifecycleData = null;
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
  es.addEventListener('open', function() {
    sseReconnectDelay = 1000;
    hideReconnectBanner();
    // Re-sync agent state on reconnect
    loadAgentCards();
  });
  let sseChangeTimer = null;
  es.addEventListener('change', () => {
    if (focusNodeId || focusCleanupTimer) return; // skip during animation
    // Debounce rapid SSE change events (e.g. approve writes multiple files)
    clearTimeout(sseChangeTimer);
    sseChangeTimer = setTimeout(() => {
      // If a refine or discuss session is active, save and restore the area across re-renders
      if (refineActiveNodeId || refineActiveNodes.size > 0 || discussActiveNodeId) {
        // Save refine area content before re-render
        let savedRefineHtml = null;
        const savedRefineNodeId = refineActiveNodeId;
        if (savedRefineNodeId) {
          const existingArea = document.getElementById(`refine-area-${savedRefineNodeId}`);
          savedRefineHtml = existingArea ? existingArea.innerHTML : null;
        }
        // Save discuss container (detached element — just need to re-attach after render)
        const savedDiscussNodeId = discussActiveNodeId;
        loadData().then(() => {
          // Restore refine area
          if (savedRefineHtml && savedRefineNodeId) {
            const restoredArea = document.getElementById(`refine-area-${savedRefineNodeId}`);
            if (restoredArea) restoredArea.innerHTML = savedRefineHtml;
          }
          // Re-attach discuss container
          if (savedDiscussNodeId && discussActiveContainer) {
            reattachDiscussContainer();
          }
        });
      } else {
        loadData();
      }
      loadAgentCards(); // refresh agent cards on any .planning/ change
    }, 300);
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
  // Pipeline runner events (same shape, reuse handlers)
  es.addEventListener('pipeline-start', handlePlayStart);
  es.addEventListener('pipeline-wave-start', handlePlayWaveStart);
  es.addEventListener('pipeline-wave-complete', handlePlayWaveComplete);
  es.addEventListener('pipeline-complete', handlePlayComplete);
  es.addEventListener('pipeline-paused', function(e) {
    try {
      const data = JSON.parse(e.data);
      showFailureModal(data.actionId, data.exitCode, data.wave, data.totalWaves);
    } catch (_) {}
  });
  es.addEventListener('pipeline-resumed', function(e) {
    hideFailureModal();
  });
  es.addEventListener('refine-output', function(e) {
    try {
      const data = JSON.parse(e.data);
      // Find matching active refine by nodeId
      const nId = [...refineActiveNodes].find(id => id.toUpperCase() === data.nodeId) || refineActiveNodeId;
      if (!nId) return;
      const area = document.getElementById(`refine-area-${nId}`);
      if (!area) return;
      const streaming = area.querySelector('.refine-streaming');
      if (streaming) {
        if (streaming.textContent === 'Thinking...') streaming.textContent = '';
        streaming.textContent += data.text;
      }
    } catch (_) {}
  });
  es.addEventListener('refine-complete', function(e) {
    try {
      const data = JSON.parse(e.data);
      const nId = [...refineActiveNodes].find(id => id.toUpperCase() === data.nodeId) || refineActiveNodeId;
      if (!nId) return;
      refineActiveNodes.delete(nId);
      if (refineActiveNodeId === nId) refineActiveNodeId = null;
      const area = document.getElementById(`refine-area-${nId}`);
      if (!area) return;

      // Use suggestion from event, or fall back to streamed text already in the area
      let suggestion = data.suggestion || '';
      if (!suggestion) {
        const streaming = area.querySelector('.refine-streaming');
        const streamedText = streaming ? streaming.textContent || '' : '';
        if (streamedText && streamedText !== 'Thinking...') suggestion = streamedText;
      }

      // Handle errors
      if (data.exitCode !== 0 && !suggestion) {
        const errMsg = data.error || 'Refine process failed (exit code ' + data.exitCode + ')';
        area.innerHTML = `<div class="refine-area" style="border-color:var(--broken-color)"><div class="refine-streaming">${escHtml(errMsg)}</div>
          <div class="refine-actions"><button class="refine-discard" id="refine-dismiss-${nId}">Dismiss</button></div></div>`;
        area.querySelector(`#refine-dismiss-${nId}`).addEventListener('click', () => { area.innerHTML = ''; });
        return;
      }

      // Parse the suggestion for title/statement
      const titleMatch = suggestion.match(/\*\*Title:\*\*\s*(.+)/);
      const stmtMatch = suggestion.match(/\*\*Statement:\*\*\s*(.+)/);
      const newTitle = titleMatch ? titleMatch[1].trim() : '';
      const newStmt = stmtMatch ? stmtMatch[1].trim() : '';
      if (suggestion.includes('LGTM') || suggestion.includes('up-to-date') || suggestion.includes('no changes')) {
        area.innerHTML = `<div class="refine-area"><div class="refine-streaming">${escHtml(suggestion)}</div>
          <div class="refine-actions"><button class="refine-discard" id="refine-dismiss-${nId}">Dismiss</button></div></div>`;
        area.querySelector(`#refine-dismiss-${nId}`).addEventListener('click', () => { area.innerHTML = ''; });
      } else {
        area.innerHTML = `<div class="refine-area"><div class="refine-streaming">${escHtml(suggestion)}</div>
          <div class="refine-actions">
            <button class="refine-accept" id="refine-accept-${nId}">Accept</button>
            <button class="refine-discard" id="refine-dismiss-${nId}">Discard</button>
          </div></div>`;
        area.querySelector(`#refine-accept-${nId}`).addEventListener('click', async () => {
          try {
            await fetch('/api/refine/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nodeId: nId, title: newTitle, statement: newStmt }),
            });
            area.innerHTML = '';
            loadData().then(() => renderDrillView());
            loadActivity();
          } catch (err) {
            console.error('Accept failed:', err);
          }
        });
        area.querySelector(`#refine-dismiss-${nId}`).addEventListener('click', () => { area.innerHTML = ''; });
      }
    } catch (_) {}
  });
  // ─── Discuss (interview) SSE events ──────────────────────────────────────
  es.addEventListener('discuss-output', function(e) {
    try {
      const data = JSON.parse(e.data);
      const outputEl = document.getElementById(`discuss-output-${data.nodeId}`);
      if (outputEl) {
        if (outputEl.textContent === 'Thinking...') outputEl.textContent = '';
        outputEl.textContent += data.text;
      }
    } catch (_) {}
  });
  es.addEventListener('discuss-complete', function(e) {
    try {
      const data = JSON.parse(e.data);
      const container = document.getElementById(`discuss-area-${data.nodeId}`);
      if (!container) return;
      if (data.error || !Array.isArray(data.questions) || data.questions.length === 0) {
        container.innerHTML = `<div class="discuss-result">
          <div class="discuss-error">${escHtml(data.error || 'No questions generated. Proceed with derivation.')}</div>
          <button class="drill-action-btn" id="discuss-skip-${data.nodeId}">Proceed</button>
        </div>`;
        container.querySelector(`#discuss-skip-${data.nodeId}`).addEventListener('click', () => {
          clearDiscussState();
          triggerDerivation(data.nodeId);
        });
        return;
      }
      // Show questions as a form
      let html = '<div class="discuss-questions">';
      html += '<div class="discuss-header">Answer these questions to improve the plan:</div>';
      data.questions.forEach((q, i) => {
        html += `<div class="discuss-q">
          <label class="discuss-q-label">${escHtml(q.question)}</label>
          ${q.context ? `<div class="discuss-q-context">${escHtml(q.context)}</div>` : ''}
          ${q.options && q.options.length > 0
            ? `<div class="discuss-q-options">${q.options.map(opt =>
                `<button class="discuss-option-btn" data-q="${i}" data-opt="${escHtml(opt)}">${escHtml(opt)}</button>`
              ).join('')}</div>`
            : ''}
          <textarea class="discuss-q-input" data-q="${i}" rows="2" placeholder="Your answer..."></textarea>
        </div>`;
      });
      html += `<div class="discuss-actions">
        <button class="drill-action-btn drill-action-primary" id="discuss-submit-${data.nodeId}">Save &amp; Proceed</button>
        <button class="drill-action-btn" id="discuss-skip-${data.nodeId}">Skip</button>
      </div></div>`;
      container.innerHTML = html;

      // Wire option buttons to fill textarea
      container.querySelectorAll('.discuss-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = btn.dataset.q;
          const ta = container.querySelector(`.discuss-q-input[data-q="${idx}"]`);
          if (ta) ta.value = btn.dataset.opt;
        });
      });

      // Wire submit
      container.querySelector(`#discuss-submit-${data.nodeId}`).addEventListener('click', async () => {
        const answers = [];
        data.questions.forEach((q, i) => {
          const ta = container.querySelector(`.discuss-q-input[data-q="${i}"]`);
          answers.push({ question: q.question, answer: ta ? ta.value.trim() : '' });
        });
        const filtered = answers.filter(a => a.answer);
        if (filtered.length > 0) {
          await fetch(`/api/node/${encodeURIComponent(data.nodeId)}/discuss/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: filtered }),
          });
        }
        clearDiscussState();
        triggerDerivation(data.nodeId);
      });

      // Wire skip
      container.querySelector(`#discuss-skip-${data.nodeId}`).addEventListener('click', () => {
        clearDiscussState();
        triggerDerivation(data.nodeId);
      });
    } catch (_) {}
  });

  // ─── Agent lifecycle SSE events (M-44) ───────────────────────────────────
  es.addEventListener('agent-start', function(e) {
    try {
      const agent = JSON.parse(e.data);
      agentCardState.set(agent.id, agent);
      renderAgentPanel();
      // Flash pulse indicator
      if ($activityPulse) {
        $activityPulse.classList.add('live');
        clearTimeout($activityPulse._timer);
        $activityPulse._timer = setTimeout(() => $activityPulse.classList.remove('live'), 3000);
      }
    } catch (_) {}
  });
  es.addEventListener('agent-update', function(e) {
    try {
      const agent = JSON.parse(e.data);
      // Merge with existing state to preserve any client-side additions
      const existing = agentCardState.get(agent.id);
      agentCardState.set(agent.id, Object.assign({}, existing || {}, agent));
      renderAgentPanel();
    } catch (_) {}
  });
  es.addEventListener('agent-complete', function(e) {
    try {
      const agent = JSON.parse(e.data);
      const existing = agentCardState.get(agent.id);
      agentCardState.set(agent.id, Object.assign({}, existing || {}, agent));
      renderAgentPanel();
      // Flash pulse
      if ($activityPulse) {
        $activityPulse.classList.add('live');
        clearTimeout($activityPulse._timer);
        $activityPulse._timer = setTimeout(() => $activityPulse.classList.remove('live'), 3000);
      }
    } catch (_) {}
  });

  // Command output — stream text into command output area
  es.addEventListener('command-output', function(e) {
    try {
      const data = JSON.parse(e.data);
      const outputEl = document.getElementById('command-output-stream');
      if (outputEl) {
        if (outputEl.textContent === 'Running...') outputEl.textContent = '';
        outputEl.textContent += data.text;
        outputEl.scrollTop = outputEl.scrollHeight;
      }
    } catch (_) {}
  });

  // Command complete — reload graph to reflect changes
  es.addEventListener('command-complete', function(e) {
    try {
      const data = JSON.parse(e.data);
      // Update command card UI
      const outputEl = document.getElementById('command-output-stream');
      if (outputEl) {
        if (data.error) {
          outputEl.textContent += '\n\nError: ' + data.error;
        }
        outputEl.classList.remove('streaming');
      }
      const cmdCard = document.getElementById('command-card');
      if (cmdCard) { cmdCard.classList.remove('running'); cmdCard.classList.add('editing'); }
      if (data.exitCode === 0) {
        loadData().then(() => renderDrillView()); // refresh graph since command may have modified files
        loadActivity();
      }
    } catch (_) {}
  });

  // Onboarding flow SSE events
  es.addEventListener('onboard-output', function(e) {
    try {
      const data = JSON.parse(e.data);
      onboardStreamText += data.text;
      const el = document.getElementById('onboard-stream');
      if (el) {
        el.textContent = onboardStreamText;
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {}
  });

  es.addEventListener('onboard-questions-complete', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.error) {
        onboardPhase = 'idle';
        renderDrillView();
        return;
      }
      onboardQuestions = data.questions;
      onboardStreamText = '';
      renderOnboardUI();
    } catch (_) {}
  });

  es.addEventListener('onboard-proposals-complete', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.error) {
        onboardPhase = 'idle';
        renderDrillView();
        return;
      }
      onboardProposals = data.proposals;
      onboardStreamText = '';
      renderOnboardUI();
    } catch (_) {}
  });

  es.addEventListener('error', () => {
    es.close();
    showReconnectBanner();
    setTimeout(connectSSE, sseReconnectDelay);
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    sseReconnectDelay = Math.min(sseReconnectDelay * 2, 30000);
  });
}

/** @type {number} Current SSE reconnection delay (exponential backoff) */
let sseReconnectDelay = 1000;

function showReconnectBanner() {
  let banner = document.getElementById('reconnect-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'reconnect-banner';
    banner.textContent = 'Reconnecting\u2026';
    document.body.appendChild(banner);
  }
  banner.classList.add('visible');
}

function hideReconnectBanner() {
  const banner = document.getElementById('reconnect-banner');
  if (banner) banner.classList.remove('visible');
}

connectSSE();

// Prune completed agents older than 30 minutes to prevent unbounded growth
setInterval(function() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, agent] of agentCardState) {
    if (agent.status !== 'running' && agent.completedAt) {
      const completedTs = new Date(agent.completedAt).getTime();
      if (completedTs < cutoff) agentCardState.delete(id);
    }
  }
}, 60000);

// ─── Command card ─────────────────────────────────────────────────────────────

const $commandCard = document.getElementById('command-card');
const $commandInput = document.getElementById('command-card-input');

if ($commandCard && $commandInput) {
  // Click to expand
  $commandCard.addEventListener('click', function() {
    if (!$commandCard.classList.contains('editing')) {
      $commandCard.classList.add('editing');
      $commandInput.value = '';
      $commandInput.focus();
    }
  });

  // Esc to blur — stop propagation to prevent drill-level back-navigation
  $commandInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      $commandInput.value = '';
      $commandInput.blur();
    }
    // Enter to send (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const msg = $commandInput.value.trim();
      if (!msg) return;
      $commandInput.value = '';
      $commandInput.blur();
      sendCommand(msg);
    }
  });

  // Global shortcut: C key (when not in input)
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Only if agents tab is visible
      const agentsTab = document.querySelector('.activity-tab[data-tab="cards"]');
      if (agentsTab && !agentsTab.classList.contains('active')) {
        agentsTab.click();
      }
      $commandCard.click();
      e.preventDefault();
    }
  });
}

// ─── Onboarding flow functions ─────────────────────────────────────────────────

function loadOnboardState() {
  fetch('/api/onboard/state').then(r => r.json()).then(data => {
    if (!data.active) return;
    onboardPrompt = data.prompt;
    onboardQuestions = data.questions;
    onboardProposals = data.proposals;
    onboardApproveIndex = data.approveIndex || 0;
    onboardStreamText = '';

    if (data.phase === 'approving' && data.proposals) {
      // Mark already-approved proposals
      for (let i = 0; i < onboardApproveIndex && i < onboardProposals.length; i++) {
        onboardProposals[i].approvedId = onboardProposals[i].approvedId || '?';
      }
      onboardPhase = 'approving';
    } else if (data.phase === 'proposals' && data.proposals) {
      onboardPhase = 'proposals';
    } else if (data.phase === 'questions' && data.questions) {
      onboardPhase = 'questions';
    } else {
      return; // Nothing useful to restore
    }

    renderOnboardUI();
  }).catch(() => {});
}

function startOnboard(message) {
  onboardPhase = 'questions';
  onboardPrompt = message;
  onboardQuestions = null;
  onboardProposals = null;
  onboardApproveIndex = 0;
  onboardStreamText = '';
  renderOnboardUI();

  fetch('/api/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }).then(r => r.json()).then(data => {
    if (data.error) {
      onboardPhase = 'idle';
      renderDrillView();
    }
  }).catch(() => {
    onboardPhase = 'idle';
    renderDrillView();
  });
}

function submitOnboardAnswers() {
  const textareas = document.querySelectorAll('.onboard-question textarea');
  const answers = [];
  if (onboardQuestions) {
    onboardQuestions.forEach((q, i) => {
      const ta = textareas[i];
      answers.push({ question: q.question, answer: ta ? ta.value.trim() : '' });
    });
  }

  onboardPhase = 'proposals';
  onboardStreamText = '';
  renderOnboardUI();

  fetch('/api/onboard/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  }).then(r => r.json()).then(data => {
    if (data.error) {
      onboardPhase = 'idle';
      renderDrillView();
    }
  }).catch(() => {
    onboardPhase = 'idle';
    renderDrillView();
  });
}

function skipOnboardQuestions() {
  onboardPhase = 'proposals';
  onboardStreamText = '';
  renderOnboardUI();

  fetch('/api/onboard/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: [] }),
  }).then(r => r.json()).catch(() => {
    onboardPhase = 'idle';
    renderDrillView();
  });
}

function cancelOnboard() {
  fetch('/api/onboard/cancel', { method: 'POST' }).catch(() => {});
  onboardPhase = 'idle';
  onboardPrompt = null;
  onboardQuestions = null;
  onboardProposals = null;
  renderDrillView();
}

function startOnboardApproving(mode) {
  onboardPhase = 'approving';
  onboardApproveIndex = 0;
  if (mode === 'all') {
    approveAllOnboard();
  } else {
    renderOnboardUI();
  }
}

async function approveCurrentOnboard() {
  if (!onboardProposals || onboardApproveIndex >= onboardProposals.length) return;

  const proposal = onboardProposals[onboardApproveIndex];
  // Read potentially edited values from inputs
  const titleInput = document.querySelector('.onboard-proposal.current .onboard-title');
  const stmtInput = document.querySelector('.onboard-proposal.current .onboard-statement');
  const title = titleInput ? titleInput.value.trim() : proposal.title;
  const statement = stmtInput ? stmtInput.value.trim() : proposal.statement;

  try {
    const resp = await fetch('/api/onboard/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, statement }),
    });
    const data = await resp.json();
    if (data.id) {
      proposal.approvedId = data.id;
    }
  } catch (_) {}

  onboardApproveIndex++;
  if (onboardApproveIndex >= onboardProposals.length) {
    // All done — reset and refresh
    onboardPhase = 'idle';
    onboardPrompt = null;
    onboardQuestions = null;
    onboardProposals = null;
    fetch('/api/onboard/complete', { method: 'POST' }).catch(() => {});
    loadData().then(() => renderDrillView());
    loadActivity();
  } else {
    renderOnboardUI();
  }
}

async function approveAllOnboard() {
  if (!onboardProposals) return;

  for (let i = 0; i < onboardProposals.length; i++) {
    onboardApproveIndex = i;
    renderOnboardUI();
    const proposal = onboardProposals[i];
    try {
      const resp = await fetch('/api/onboard/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: proposal.title, statement: proposal.statement }),
      });
      const data = await resp.json();
      if (data.id) proposal.approvedId = data.id;
    } catch (_) {}
  }

  onboardPhase = 'idle';
  onboardPrompt = null;
  onboardQuestions = null;
  onboardProposals = null;
  fetch('/api/onboard/complete', { method: 'POST' }).catch(() => {});
  loadData().then(() => renderDrillView());
  loadActivity();
}

function renderOnboardUI() {
  if (!$drillList) return;
  $drillList.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'onboard-container';

  if (onboardPhase === 'questions') {
    if (!onboardQuestions) {
      // Still streaming
      container.innerHTML = `
        <div class="onboard-phase-label">Analyzing your vision...</div>
        <pre class="onboard-stream streaming" id="onboard-stream">${escHtml(onboardStreamText) || 'Thinking...'}</pre>
      `;
    } else {
      // Show question form
      let html = '<div class="onboard-phase-label">Clarification Questions</div>';
      html += '<div class="onboard-questions">';
      onboardQuestions.forEach((q, i) => {
        html += `<div class="onboard-question">
          <span class="oq-number">Q${i + 1}</span>
          <label>${escHtml(q.question)}</label>
          ${q.context ? `<div class="oq-context">${escHtml(q.context)}</div>` : ''}
          ${q.options && q.options.length > 0 ? `<div class="oq-options">${q.options.map(o => `<span class="oq-option" data-qi="${i}" data-val="${escHtml(o)}">${escHtml(o)}</span>`).join('')}</div>` : ''}
          <textarea placeholder="Your answer..." rows="2"></textarea>
        </div>`;
      });
      html += '</div>';
      html += `<div class="onboard-actions">
        <button class="onboard-btn-primary" onclick="submitOnboardAnswers()">Submit Answers</button>
        <button class="onboard-btn-secondary" onclick="skipOnboardQuestions()">Skip</button>
        <button class="onboard-btn-secondary" onclick="cancelOnboard()">Cancel</button>
      </div>`;
      container.innerHTML = html;

      // Attach option click handlers after DOM insertion
      setTimeout(() => {
        container.querySelectorAll('.oq-option').forEach(opt => {
          opt.addEventListener('click', () => {
            const qi = parseInt(opt.dataset.qi);
            const val = opt.dataset.val;
            const ta = container.querySelectorAll('.onboard-question textarea')[qi];
            if (ta) {
              ta.value = ta.value ? ta.value + ', ' + val : val;
            }
            opt.classList.toggle('selected');
          });
        });
      }, 0);
    }
  } else if (onboardPhase === 'proposals') {
    if (!onboardProposals) {
      container.innerHTML = `
        <div class="onboard-phase-label">Generating declarations...</div>
        <pre class="onboard-stream streaming" id="onboard-stream">${escHtml(onboardStreamText) || 'Thinking...'}</pre>
      `;
    } else {
      let html = '<div class="onboard-phase-label">Proposed Declarations</div>';
      onboardProposals.forEach((p, i) => {
        html += `<div class="onboard-proposal">
          <div class="op-header">
            <span class="op-index">${i + 1}.</span>
          </div>
          <input class="onboard-title" value="${escHtml(p.title)}" />
          <textarea class="onboard-statement" rows="2">${escHtml(p.statement)}</textarea>
          <div class="onboard-reason">${escHtml(p.reasoning || '')}</div>
        </div>`;
      });
      html += `<div class="onboard-actions">
        <button class="onboard-btn-primary" onclick="startOnboardApproving('all')">Approve All</button>
        <button class="onboard-btn-secondary" onclick="startOnboardApproving('one')">One by One</button>
        <button class="onboard-btn-secondary" onclick="cancelOnboard()">Cancel</button>
      </div>`;
      container.innerHTML = html;
    }
  } else if (onboardPhase === 'approving') {
    if (!onboardProposals) return;
    let html = `<div class="onboard-phase-label">Approving Declarations</div>`;
    html += `<div class="onboard-progress">${onboardApproveIndex} of ${onboardProposals.length} approved</div>`;
    onboardProposals.forEach((p, i) => {
      const isApproved = i < onboardApproveIndex || p.approvedId;
      const isCurrent = i === onboardApproveIndex && !p.approvedId;
      const cls = isApproved ? 'approved' : isCurrent ? 'current' : '';
      html += `<div class="onboard-proposal ${cls}">
        <div class="op-header">
          ${isApproved ? '<span class="op-check">\u2713</span>' : `<span class="op-index">${i + 1}.</span>`}
          ${p.approvedId ? `<span class="op-id">${escHtml(p.approvedId)}</span>` : ''}
        </div>
        ${isCurrent ? `
          <input class="onboard-title" value="${escHtml(p.title)}" />
          <textarea class="onboard-statement" rows="2">${escHtml(p.statement)}</textarea>
        ` : `
          <div style="font-weight:600;font-size:13px">${escHtml(p.title)}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px">${escHtml(p.statement)}</div>
        `}
        <div class="onboard-reason">${escHtml(p.reasoning || '')}</div>
      </div>`;
    });
    if (onboardApproveIndex < onboardProposals.length) {
      html += `<div class="onboard-actions">
        <button class="onboard-btn-primary" onclick="approveCurrentOnboard()">Approve &amp; Next</button>
        <button class="onboard-btn-secondary" onclick="cancelOnboard()">Cancel</button>
      </div>`;
    }
    container.innerHTML = html;
  }

  $drillList.appendChild(container);
}

function sendCommand(message) {
  // Route to onboarding when at declarations level with few declarations or long message
  if (drillLevel === 'declarations' && graphData) {
    const declCount = (graphData.declarations || []).length;
    if (declCount < 3 || message.length > 150) {
      startOnboard(message);
      return;
    }
  }

  // Gather context from current view
  const context = {};
  if (drillLevel === 'declarations') {
    context.viewDescription = 'Declaration list (lifecycle view)';
    const cards = document.querySelectorAll('#drill-list .drill-card');
    context.nodeIds = Array.from(cards).map(c => c.dataset.nodeId).filter(Boolean);
  } else if (drillLevel === 'milestones' && drillDeclId) {
    context.nodeId = drillDeclId;
    context.viewDescription = 'Milestones for ' + drillDeclId;
    const cards = document.querySelectorAll('#drill-list .drill-card');
    context.nodeIds = Array.from(cards).map(c => c.dataset.nodeId).filter(Boolean);
  } else if (drillLevel === 'actions' && drillMileId) {
    context.nodeId = drillMileId;
    context.viewDescription = 'Actions for ' + drillMileId;
    const cards = document.querySelectorAll('#drill-list .drill-card');
    context.nodeIds = Array.from(cards).map(c => c.dataset.nodeId).filter(Boolean);
  }

  // Show streaming output area in command card
  const cmdCard = document.getElementById('command-card');
  if (cmdCard) {
    cmdCard.classList.add('running');
    cmdCard.classList.remove('editing');
    // Create or reuse output area
    let outputEl = document.getElementById('command-output-stream');
    if (!outputEl) {
      outputEl = document.createElement('pre');
      outputEl.id = 'command-output-stream';
      outputEl.className = 'command-output-stream streaming';
      cmdCard.appendChild(outputEl);
    } else {
      outputEl.className = 'command-output-stream streaming';
    }
    outputEl.textContent = 'Running...';
  }

  fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
  }).then(r => r.json()).then(data => {
    if (data.error) {
      console.error('Command error:', data.error);
      const outputEl = document.getElementById('command-output-stream');
      if (outputEl) outputEl.textContent = 'Error: ' + data.error;
    }
  }).catch(err => {
    console.error('Command failed:', err);
    const outputEl = document.getElementById('command-output-stream');
    if (outputEl) outputEl.textContent = 'Error: ' + err.message;
  });
}

// ─── Clickable activity log items ─────────────────────────────────────────────

if ($activityList) {
  $activityList.addEventListener('click', function(e) {
    const item = e.target.closest('.activity-event');
    if (!item) return;
    const desc = item.querySelector('.ae-desc');
    if (!desc) return;
    // Extract node ID from description like "Review of A-117 complete"
    const match = desc.textContent.match(/\b([DMA]-\d+)\b/);
    if (match) {
      const nodeId = match[1];
      // Navigate to that node
      const prefix = nodeId.split('-')[0];
      if (prefix === 'D') {
        renderDeclarations(graphData); // back to declarations
      } else if (prefix === 'M') {
        // Find parent declaration
        const milestone = (graphData.milestones || []).find(m => m.id === nodeId);
        if (milestone && milestone.realizes) {
          const declId = Array.isArray(milestone.realizes) ? milestone.realizes[0] : milestone.realizes;
          renderMilestones(declId, graphData);
        }
      } else if (prefix === 'A') {
        // Find parent milestone
        const action = (graphData.actions || []).find(a => a.id === nodeId);
        if (action && action.causes && action.causes.length > 0) {
          renderActions(action.causes[0], graphData);
        }
      }
    }
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

showLoading();
loadData().then(() => {
  restoreExecState();
  // Restore onboard session from server
  loadOnboardState();
});
loadActivity();
loadAgentCards();

// Poll agent cards every 3s as fallback if SSE agent events are missed
setInterval(loadAgentCards, 3000);
