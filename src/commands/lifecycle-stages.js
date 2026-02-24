// @ts-check
'use strict';

/**
 * Lifecycle stage computation engine.
 *
 * Classifies every node in the Declare graph into one of five lifecycle stages:
 *   - Needs Planning   — declarations without milestones, milestones without actions
 *   - Needs Approval   — nodes with reviewState !== 'approved'
 *   - Ready to Execute — approved, dependencies satisfied, not yet running
 *   - In Execution     — currently executing
 *   - Done             — completed
 *
 * Also computes `nextAction` — the single most important thing to do next.
 *
 * Zero runtime dependencies. CJS module.
 */

const COMPLETED_STATUSES = new Set(['DONE', 'KEPT', 'HONORED']);
const EXECUTING_STATUSES = new Set(['EXECUTING', 'IN_PROGRESS', 'RUNNING']);

/**
 * @typedef {'needs-planning' | 'needs-approval' | 'ready-to-execute' | 'in-execution' | 'done'} LifecycleStage
 */

/**
 * @typedef {Object} StageItem
 * @property {string} id
 * @property {string} title
 * @property {'declaration' | 'milestone' | 'action'} type
 * @property {string} status
 * @property {string} [reviewState]
 * @property {LifecycleStage} stage
 */

/**
 * @typedef {Object} NextAction
 * @property {string} action - Machine-readable action (derive-milestones, derive-actions, approve, execute, complete)
 * @property {string} label - Human-readable description
 * @property {string} [targetId] - Target node ID
 * @property {string} [targetType] - Target node type
 */

/**
 * @typedef {Object} LifecycleResult
 * @property {Record<LifecycleStage, StageItem[]>} stages
 * @property {NextAction | null} nextAction
 * @property {{ total: number, done: number, percentage: number }} progress
 */

/**
 * Compute lifecycle stages for all nodes in the graph.
 *
 * @param {{ declarations: any[], milestones: any[], actions: any[] }} graph
 * @param {Set<string>} [runningActionIds] - Action IDs currently running
 * @returns {LifecycleResult}
 */
function computeLifecycleStages(graph, runningActionIds) {
  const { declarations = [], milestones = [], actions = [] } = graph;
  const running = runningActionIds || new Set();

  /** @type {Record<LifecycleStage, StageItem[]>} */
  const stages = {
    'needs-planning': [],
    'needs-approval': [],
    'ready-to-execute': [],
    'in-execution': [],
    'done': [],
  };

  // Build lookup maps
  const milestoneById = new Map(milestones.map(m => [m.id, m]));
  const actionsByMilestone = new Map();
  for (const a of actions) {
    for (const mId of (a.causes || [])) {
      if (!actionsByMilestone.has(mId)) actionsByMilestone.set(mId, []);
      actionsByMilestone.get(mId).push(a);
    }
  }

  // Milestone IDs per declaration
  const milestonesByDecl = new Map();
  for (const d of declarations) {
    milestonesByDecl.set(d.id, (d.milestones || []).filter(mId => milestoneById.has(mId)));
  }

  // --- Classify declarations ---
  for (const d of declarations) {
    const status = (d.status || '').toUpperCase();
    if (COMPLETED_STATUSES.has(status)) {
      stages['done'].push(makeItem(d, 'declaration', 'done'));
      continue;
    }

    const myMilestones = milestonesByDecl.get(d.id) || [];
    if (myMilestones.length === 0) {
      stages['needs-planning'].push(makeItem(d, 'declaration', 'needs-planning'));
      continue;
    }

    if (d.reviewState !== 'approved') {
      stages['needs-approval'].push(makeItem(d, 'declaration', 'needs-approval'));
      continue;
    }

    // Declaration with milestones that's approved — stage follows its milestones
    // Check if all milestones are done
    const allMilestonesDone = myMilestones.every(mId => {
      const m = milestoneById.get(mId);
      return m && COMPLETED_STATUSES.has((m.status || '').toUpperCase());
    });
    if (allMilestonesDone) {
      stages['done'].push(makeItem(d, 'declaration', 'done'));
    } else {
      // Approved declaration with in-progress milestones — don't show in any stage
      // (its milestones show individually)
    }
  }

  // --- Classify milestones ---
  for (const m of milestones) {
    const status = (m.status || '').toUpperCase();
    if (COMPLETED_STATUSES.has(status)) {
      stages['done'].push(makeItem(m, 'milestone', 'done'));
      continue;
    }

    const myActions = actionsByMilestone.get(m.id) || [];
    const hasPlan = m.hasPlan || myActions.length > 0;

    if (!hasPlan) {
      stages['needs-planning'].push(makeItem(m, 'milestone', 'needs-planning'));
      continue;
    }

    if (m.reviewState !== 'approved') {
      stages['needs-approval'].push(makeItem(m, 'milestone', 'needs-approval'));
      continue;
    }

    // Check if any actions are executing
    const hasExecuting = myActions.some(a =>
      EXECUTING_STATUSES.has((a.status || '').toUpperCase()) || running.has(a.id)
    );
    if (hasExecuting) {
      stages['in-execution'].push(makeItem(m, 'milestone', 'in-execution'));
      continue;
    }

    // Check if all actions are done
    const allActionsDone = myActions.length > 0 && myActions.every(a =>
      COMPLETED_STATUSES.has((a.status || '').toUpperCase())
    );
    if (allActionsDone) {
      stages['done'].push(makeItem(m, 'milestone', 'done'));
      continue;
    }

    // Check dependencies satisfied
    const deps = m.dependsOn || [];
    const depsBlocked = deps.some(depId => {
      const dep = milestoneById.get(depId);
      return !dep || !COMPLETED_STATUSES.has((dep.status || '').toUpperCase());
    });

    if (depsBlocked) {
      // Blocked — show in needs-approval or ready-to-execute depending on approval
      stages['needs-approval'].push(makeItem(m, 'milestone', 'needs-approval'));
    } else {
      stages['ready-to-execute'].push(makeItem(m, 'milestone', 'ready-to-execute'));
    }
  }

  // --- Classify actions ---
  for (const a of actions) {
    const status = (a.status || '').toUpperCase();
    if (COMPLETED_STATUSES.has(status)) {
      stages['done'].push(makeItem(a, 'action', 'done'));
      continue;
    }

    if (EXECUTING_STATUSES.has(status) || running.has(a.id)) {
      stages['in-execution'].push(makeItem(a, 'action', 'in-execution'));
      continue;
    }

    if (a.reviewState !== 'approved') {
      stages['needs-approval'].push(makeItem(a, 'action', 'needs-approval'));
      continue;
    }

    // Approved, not executing, not done — check if milestone deps are satisfied
    const parentMilestones = (a.causes || []).map(mId => milestoneById.get(mId)).filter(Boolean);
    const parentBlocked = parentMilestones.some(m => {
      const deps = m.dependsOn || [];
      return deps.some(depId => {
        const dep = milestoneById.get(depId);
        return !dep || !COMPLETED_STATUSES.has((dep.status || '').toUpperCase());
      });
    });

    if (parentBlocked) {
      stages['needs-approval'].push(makeItem(a, 'action', 'needs-approval'));
    } else {
      stages['ready-to-execute'].push(makeItem(a, 'action', 'ready-to-execute'));
    }
  }

  // --- Compute next action ---
  const nextAction = computeNextAction(stages, declarations, milestones, actions);

  // --- Compute progress ---
  const total = declarations.length + milestones.length + actions.length;
  const done = stages['done'].length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    stages,
    nextAction,
    progress: { total, done, percentage },
  };
}

/**
 * Determine the single most important next action.
 * Priority: Needs Planning > Needs Approval > Ready to Execute
 *
 * @param {Record<LifecycleStage, StageItem[]>} stages
 * @param {any[]} declarations
 * @param {any[]} milestones
 * @param {any[]} actions
 * @returns {NextAction | null}
 */
function computeNextAction(stages, declarations, milestones, actions) {
  // 1. Needs planning — declarations without milestones first
  const planningDecl = stages['needs-planning'].find(item => item.type === 'declaration');
  if (planningDecl) {
    return {
      action: 'derive-milestones',
      label: `Plan milestones for ${planningDecl.id}`,
      targetId: planningDecl.id,
      targetType: 'declaration',
    };
  }

  // 2. Needs planning — milestones without actions
  const planningMile = stages['needs-planning'].find(item => item.type === 'milestone');
  if (planningMile) {
    return {
      action: 'derive-actions',
      label: `Plan actions for ${planningMile.id}`,
      targetId: planningMile.id,
      targetType: 'milestone',
    };
  }

  // 3. Needs approval — find first unapproved
  if (stages['needs-approval'].length > 0) {
    const first = stages['needs-approval'][0];
    return {
      action: 'approve',
      label: `Review ${first.id}`,
      targetId: first.id,
      targetType: first.type,
    };
  }

  // 4. Ready to execute
  if (stages['ready-to-execute'].length > 0) {
    return {
      action: 'execute',
      label: 'Execute approved actions',
    };
  }

  // 5. In execution — just show status
  if (stages['in-execution'].length > 0) {
    return {
      action: 'view-execution',
      label: 'Execution in progress',
    };
  }

  // 6. All done
  const total = declarations.length + milestones.length + actions.length;
  if (total > 0) {
    return {
      action: 'complete',
      label: 'All items complete',
    };
  }

  return null;
}

/**
 * @param {any} node
 * @param {'declaration' | 'milestone' | 'action'} type
 * @param {LifecycleStage} stage
 * @returns {StageItem}
 */
function makeItem(node, type, stage) {
  return {
    id: node.id,
    title: node.title || node.statement || node.id,
    type,
    status: node.status || 'PENDING',
    reviewState: node.reviewState,
    stage,
  };
}

module.exports = { computeLifecycleStages, COMPLETED_STATUSES, EXECUTING_STATUSES };
