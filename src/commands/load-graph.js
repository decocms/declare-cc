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

  return {
    declarations: declarations.map(d => ({ ...d, wholeness: wholeness.get(d.id) || 'broken' })),
    milestones: milestones.map(m => ({ ...m, wholeness: wholeness.get(m.id) || 'broken' })),
    actions: actions.map(a => ({ ...a, wholeness: wholeness.get(a.id) || 'broken' })),
    stats: dag.stats(),
    validation: dag.validate(),
  };
}

module.exports = { runLoadGraph, loadActionsFromFolders };
