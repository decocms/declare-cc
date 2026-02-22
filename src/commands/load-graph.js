// @ts-check
'use strict';

/**
 * load-graph command logic.
 *
 * Loads the full Declare graph from FUTURE.md, MILESTONES.md, and
 * milestone folder PLAN.md files. Reconstructs the DAG and returns
 * structured JSON with stats and validation.
 *
 * Zero runtime dependencies. CJS module.
 */

const { buildDagFromDisk, loadActionsFromFolders } = require('./build-dag');
const { computeReadiness } = require('./readiness');

/**
 * Run the load-graph command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ declarations: Array, milestones: Array, actions: Array, stats: object, validation: object } | { error: string }}
 */
function runLoadGraph(cwd) {
  const graphResult = buildDagFromDisk(cwd);
  if (graphResult.error) return graphResult;

  const { dag, declarations, milestones, actions } = graphResult;

  const wholeness = dag.computeWholeness();

  const enrichedMilestones = milestones.map(m => ({
    ...m,
    classification: m.classification || 'agent',
    dependsOn: m.dependsOn || [],
    wholeness: wholeness.get(m.id) || 'broken',
  }));

  const enrichedActions = actions.map(a => ({ ...a, wholeness: wholeness.get(a.id) || 'broken' }));

  // Compute readiness state for all milestones
  const readiness = computeReadiness({
    milestones: enrichedMilestones,
    actions: enrichedActions,
  });

  return {
    declarations: declarations.map(d => ({ ...d, wholeness: wholeness.get(d.id) || 'broken' })),
    milestones: enrichedMilestones.map(m => ({
      ...m,
      readiness: readiness[m.id] || { state: 'blocked', blockedBy: [], progress: { done: 0, total: 0 } },
    })),
    actions: enrichedActions,
    readiness,
    stats: dag.stats(),
    validation: dag.validate(),
  };
}

module.exports = { runLoadGraph, loadActionsFromFolders };
