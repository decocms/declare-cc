// @ts-check
'use strict';

/**
 * Readiness computation for milestones.
 *
 * Given a loaded graph, computes whether each milestone is:
 *   - `done`       — milestone itself is DONE/KEPT/HONORED
 *   - `ready`      — all dependsOn milestones are DONE, and this milestone has actions
 *   - `blocked`    — at least one dependency milestone is not DONE
 *   - `no-actions` — dependencies are satisfied but milestone has no actions defined
 *
 * Zero runtime dependencies. CJS module.
 */

/** Status values that count as "completed" */
const COMPLETED = new Set(['DONE', 'KEPT', 'HONORED']);

/**
 * Compute readiness state for all milestones in the graph.
 *
 * @param {{ milestones: Array<{id: string, status: string, dependsOn?: string[], hasPlan?: boolean}>, actions: Array<{id: string, status: string, causes: string[]}> }} graph
 * @returns {Record<string, { state: 'ready' | 'blocked' | 'done' | 'no-actions', blockedBy: string[], progress: { done: number, total: number } }>}
 */
function computeReadiness(graph) {
  const { milestones, actions } = graph;

  // Build a status lookup for milestones
  /** @type {Record<string, string>} */
  const milestoneStatus = {};
  for (const m of milestones) {
    milestoneStatus[m.id] = (m.status || 'PENDING').toUpperCase();
  }

  // Build action counts per milestone
  /** @type {Record<string, { done: number, total: number }>} */
  const actionCounts = {};
  for (const m of milestones) {
    actionCounts[m.id] = { done: 0, total: 0 };
  }
  for (const a of actions) {
    const causes = a.causes || [];
    for (const mId of causes) {
      if (!actionCounts[mId]) continue;
      actionCounts[mId].total++;
      if (COMPLETED.has((a.status || '').toUpperCase())) {
        actionCounts[mId].done++;
      }
    }
  }

  /** @type {Record<string, { state: 'ready' | 'blocked' | 'done' | 'no-actions', blockedBy: string[], progress: { done: number, total: number } }>} */
  const readiness = {};

  for (const m of milestones) {
    const status = milestoneStatus[m.id];
    const progress = actionCounts[m.id] || { done: 0, total: 0 };

    // If milestone itself is completed, state is done
    if (COMPLETED.has(status)) {
      readiness[m.id] = { state: 'done', blockedBy: [], progress };
      continue;
    }

    // Check dependencies
    const deps = m.dependsOn || [];
    const blockedBy = [];
    for (const depId of deps) {
      const depStatus = milestoneStatus[depId];
      if (!depStatus || !COMPLETED.has(depStatus)) {
        blockedBy.push(depId);
      }
    }

    if (blockedBy.length > 0) {
      readiness[m.id] = { state: 'blocked', blockedBy, progress };
    } else if (progress.total === 0 && !m.hasPlan) {
      readiness[m.id] = { state: 'no-actions', blockedBy: [], progress };
    } else {
      readiness[m.id] = { state: 'ready', blockedBy: [], progress };
    }
  }

  return readiness;
}

module.exports = { computeReadiness };
