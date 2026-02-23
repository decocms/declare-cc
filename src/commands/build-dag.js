// @ts-check
'use strict';

/**
 * Shared graph loading utility for Declare commands.
 *
 * Extracts the repeated pattern of parsing FUTURE.md, MILESTONES.md,
 * and milestone folder PLAN.md files into a single DAG instance.
 * Used by load-graph, status, trace, prioritize, and visualize commands.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { parseFutureFile } = require('../artifacts/future');
const { parseMilestonesFile } = require('../artifacts/milestones');
const { parsePlanFile } = require('../artifacts/plan');
const { DeclareDag } = require('../graph/engine');

/**
 * Load actions from all milestone folder PLAN.md files.
 * Also collects milestone-level produces fields.
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {{ actions: Array<{id: string, title: string, status: string, produces: string, causes: string[]}>, milestoneProduces: Record<string, string> }}
 */
function loadActionsFromFolders(planningDir) {
  const milestonesDir = join(planningDir, 'milestones');
  if (!existsSync(milestonesDir)) return { actions: [], milestoneProduces: {} };

  const allActions = [];
  /** @type {Record<string, string>} */
  const milestoneProduces = {};
  const entries = readdirSync(milestonesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const planPath = join(milestonesDir, entry.name, 'PLAN.md');
    if (!existsSync(planPath)) continue;

    const content = readFileSync(planPath, 'utf-8');
    const { milestone, actions, produces } = parsePlanFile(content);

    if (milestone && produces) {
      milestoneProduces[milestone] = produces;
    }

    for (const action of actions) {
      allActions.push({
        id: action.id,
        title: action.title,
        status: action.status,
        produces: action.produces,
        reviewState: action.reviewState || 'draft',
        causes: milestone ? [milestone] : [],
      });
    }
  }

  return { actions: allActions, milestoneProduces };
}

/**
 * Load all Declare artifacts from disk and build a DAG instance.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ dag: import('../graph/engine').DeclareDag, declarations: Array, milestones: Array, actions: Array } | { error: string }}
 */
function buildDagFromDisk(cwd) {
  const planningDir = join(cwd, '.planning');

  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  const futurePath = join(planningDir, 'FUTURE.md');
  const milestonesPath = join(planningDir, 'MILESTONES.md');

  const futureContent = existsSync(futurePath)
    ? readFileSync(futurePath, 'utf-8')
    : '';
  const milestonesContent = existsSync(milestonesPath)
    ? readFileSync(milestonesPath, 'utf-8')
    : '';

  const declarations = parseFutureFile(futureContent);
  const { milestones } = parseMilestonesFile(milestonesContent);
  const { actions: allLoadedActions, milestoneProduces } = loadActionsFromFolders(planningDir);

  // Filter actions to only those whose parent milestone is in MILESTONES.md
  const milestoneIds = new Set(milestones.map(m => m.id.toUpperCase()));
  const actions = allLoadedActions.filter(a =>
    a.causes.some(c => milestoneIds.has(c.toUpperCase()))
  );

  // Merge milestone-level produces from PLAN.md into milestone records
  for (const m of milestones) {
    if (milestoneProduces[m.id]) {
      m.produces = milestoneProduces[m.id];
    }
  }

  // Build the DAG
  const dag = new DeclareDag();

  for (const d of declarations) {
    const meta = { reviewState: d.reviewState || 'draft' };
    if (d.ref) meta.ref = d.ref;
    dag.addNode(d.id, 'declaration', d.title, d.status || 'PENDING', meta);
  }
  for (const m of milestones) {
    dag.addNode(m.id, 'milestone', m.title, m.status || 'PENDING', {
      description: m.description || '',
      produces: m.produces || '',
      classification: m.classification || 'agent',
      dependsOn: m.dependsOn || [],
      reviewState: m.reviewState || 'draft',
    });
  }
  for (const a of actions) {
    dag.addNode(a.id, 'action', a.title, a.status || 'PENDING', { reviewState: a.reviewState || 'draft' });
  }

  // Add edges: milestone->declaration (realizes)
  for (const m of milestones) {
    for (const declId of m.realizes) {
      if (dag.getNode(declId)) {
        dag.addEdge(m.id, declId);
      }
    }
  }

  // Add edges: action->milestone (causes)
  for (const a of actions) {
    for (const milestoneId of a.causes) {
      if (dag.getNode(milestoneId)) {
        dag.addEdge(a.id, milestoneId);
      }
    }
  }

  return { dag, declarations, milestones, actions };
}

module.exports = { buildDagFromDisk, loadActionsFromFolders };
