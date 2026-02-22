// @ts-check
'use strict';

/**
 * Workflow state machine for the Declare D->M->A progression.
 *
 * Computes the current workflow state from graph data (declarations,
 * milestones, actions) and returns the state, suggested next step,
 * and progress metrics.
 *
 * States:
 *   empty             - No declarations yet
 *   declarations_only - Declarations exist but no milestones
 *   milestones_pending - Milestones exist but some lack actions
 *   actions_pending   - All milestones have actions, some not executed
 *   executing         - An action is currently running
 *   complete          - All actions done
 *
 * Zero runtime dependencies. CJS module.
 */

/**
 * @typedef {'empty' | 'declarations_only' | 'milestones_pending' | 'actions_pending' | 'executing' | 'complete'} WorkflowState
 */

/**
 * @typedef {Object} NextStep
 * @property {string} label - Human-readable description of the next step
 * @property {string} action - Machine-readable action identifier (e.g. 'create-declaration', 'derive-milestones')
 * @property {string} [targetId] - Optional target node ID (e.g. milestone or action ID)
 */

/**
 * @typedef {Object} WorkflowProgress
 * @property {number} declarations - Total declarations
 * @property {number} milestones - Total milestones
 * @property {number} actions - Total actions
 * @property {number} actionsDone - Actions with DONE/KEPT/HONORED status
 * @property {number} actionsExecuting - Actions currently executing
 * @property {number} percentage - Overall completion percentage (0-100)
 */

/**
 * @typedef {Object} WorkflowResult
 * @property {WorkflowState} state
 * @property {NextStep} nextStep
 * @property {WorkflowProgress} progress
 */

const DONE_STATUSES = new Set(['DONE', 'KEPT', 'HONORED']);
const EXECUTING_STATUSES = new Set(['EXECUTING', 'IN_PROGRESS', 'RUNNING']);

/**
 * Compute the current workflow state from graph data.
 *
 * @param {{ declarations?: any[], milestones?: any[], actions?: any[] }} graph
 * @param {Set<string>} [runningActionIds] - Set of action IDs currently running (from process manager)
 * @returns {WorkflowResult}
 */
function computeWorkflowState(graph, runningActionIds) {
  const declarations = graph.declarations || [];
  const milestones = graph.milestones || [];
  const actions = graph.actions || [];
  const running = runningActionIds || new Set();

  // Count action statuses
  const actionsDone = actions.filter(a => DONE_STATUSES.has((a.status || '').toUpperCase())).length;
  const actionsExecuting = actions.filter(a =>
    EXECUTING_STATUSES.has((a.status || '').toUpperCase()) || running.has(a.id)
  ).length;

  const totalActions = actions.length;
  const percentage = totalActions > 0 ? Math.round((actionsDone / totalActions) * 100) : 0;

  const progress = {
    declarations: declarations.length,
    milestones: milestones.length,
    actions: totalActions,
    actionsDone,
    actionsExecuting,
    percentage,
  };

  // State: empty
  if (declarations.length === 0) {
    return {
      state: 'empty',
      nextStep: {
        label: 'Create your first declaration',
        action: 'create-declaration',
      },
      progress,
    };
  }

  // State: declarations_only
  if (milestones.length === 0) {
    return {
      state: 'declarations_only',
      nextStep: {
        label: 'Derive milestones from declarations',
        action: 'derive-milestones',
      },
      progress,
    };
  }

  // Build a set of milestones that have at least one action
  const milestonesWithActions = new Set();
  for (const a of actions) {
    if (Array.isArray(a.causes)) {
      for (const mId of a.causes) {
        milestonesWithActions.add(mId.toUpperCase());
      }
    }
  }

  // Find milestones without actions (excluding DONE milestones)
  const pendingMilestones = milestones.filter(m => {
    const mStatus = (m.status || '').toUpperCase();
    if (DONE_STATUSES.has(mStatus)) return false;
    return !milestonesWithActions.has(m.id.toUpperCase());
  });

  // State: milestones_pending
  if (pendingMilestones.length > 0) {
    const target = pendingMilestones[0];
    return {
      state: 'milestones_pending',
      nextStep: {
        label: `Derive actions for ${target.id}`,
        action: 'derive-actions',
        targetId: target.id,
      },
      progress,
    };
  }

  // State: executing
  if (actionsExecuting > 0) {
    const executingAction = actions.find(a =>
      EXECUTING_STATUSES.has((a.status || '').toUpperCase()) || running.has(a.id)
    );
    return {
      state: 'executing',
      nextStep: {
        label: executingAction ? `Executing ${executingAction.id}` : 'Execution in progress',
        action: 'view-execution',
        targetId: executingAction ? executingAction.id : undefined,
      },
      progress,
    };
  }

  // State: complete
  if (totalActions > 0 && actionsDone === totalActions) {
    return {
      state: 'complete',
      nextStep: {
        label: 'All actions complete',
        action: 'view-summary',
      },
      progress,
    };
  }

  // State: actions_pending — find the next pending action to execute
  const pendingActions = actions.filter(a => {
    const s = (a.status || '').toUpperCase();
    return !DONE_STATUSES.has(s) && !EXECUTING_STATUSES.has(s);
  });

  const nextAction = pendingActions[0];
  return {
    state: 'actions_pending',
    nextStep: {
      label: nextAction ? `Execute ${nextAction.id}` : 'Plan next actions',
      action: nextAction ? 'execute-action' : 'plan-actions',
      targetId: nextAction ? nextAction.id : undefined,
    },
    progress,
  };
}

module.exports = { computeWorkflowState };
