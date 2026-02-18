// @ts-check
'use strict';

/**
 * sync-status command.
 *
 * Propagates completion status bottom-up through the DAG:
 *   1. Actions  — mark DONE in PLAN.md if produced file exists on disk
 *   2. Milestones — mark DONE in MILESTONES.md if all their actions are DONE
 *   3. Declarations — mark DONE in FUTURE.md if all their milestones are DONE
 *
 * Designed to be run after execution waves or verification passes so the
 * dashboard reflects reality without manual edits.
 *
 * Zero runtime dependencies beyond existing internal modules. CJS module.
 */

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { buildDagFromDisk, loadActionsFromFolders } = require('./build-dag');
const { parseMilestonesFile, writeMilestonesFile } = require('../artifacts/milestones');
const { parseFutureFile, writeFutureFile } = require('../artifacts/future');
const { parsePlanFile, updateActionStatus } = require('../artifacts/plan');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { isCompleted } = require('../graph/engine');

/**
 * Check whether a produces value looks like a file path.
 * @param {string} produces
 * @returns {boolean}
 */
function looksLikeFilePath(produces) {
  if (!produces || !produces.trim()) return false;
  return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
}

/**
 * Run the sync-status command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{
 *   actions:  Array<{id: string, milestone: string, changed: boolean, reason: string}>,
 *   milestones: Array<{id: string, changed: boolean, reason: string}>,
 *   declarations: Array<{id: string, changed: boolean, reason: string}>,
 *   summary: string
 * } | { error: string }}
 */
function runSyncStatus(cwd) {
  const planningDir = join(cwd, '.planning');
  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag, milestones, declarations } = graphResult;

  /** @type {Array<{id: string, milestone: string, changed: boolean, reason: string}>} */
  const actionResults = [];
  /** @type {Array<{id: string, changed: boolean, reason: string}>} */
  const milestoneResults = [];
  /** @type {Array<{id: string, changed: boolean, reason: string}>} */
  const declarationResults = [];

  // ── Step 1: Mark actions DONE in PLAN.md files ─────────────────────────────
  // Strategy (in priority order):
  //   a) Already DONE → skip
  //   b) Milestone is already DONE → mark all its actions DONE (milestone was externally verified)
  //   c) Produces is a clean file path → check file exists
  //   d) Otherwise → cannot auto-verify, leave PENDING
  for (const m of milestones) {
    const folderPath = findMilestoneFolder(planningDir, m.id);
    if (!folderPath) continue;

    const planPath = join(folderPath, 'PLAN.md');
    if (!existsSync(planPath)) continue;

    let planContent = readFileSync(planPath, 'utf-8');
    const { actions } = parsePlanFile(planContent);
    let planDirty = false;
    const milestoneAlreadyDone = isCompleted(m.status);

    for (const action of actions) {
      if (isCompleted(action.status)) {
        actionResults.push({ id: action.id, milestone: m.id, changed: false, reason: 'already DONE' });
        continue;
      }

      if (milestoneAlreadyDone) {
        // Milestone was verified DONE externally — all its actions are implicitly done
        planContent = updateActionStatus(planContent, action.id, 'DONE');
        planDirty = true;
        actionResults.push({ id: action.id, milestone: m.id, changed: true, reason: `milestone ${m.id} is DONE` });
        continue;
      }

      const produces = action.produces || '';
      if (looksLikeFilePath(produces)) {
        const filePath = resolve(cwd, produces);
        if (existsSync(filePath)) {
          planContent = updateActionStatus(planContent, action.id, 'DONE');
          planDirty = true;
          actionResults.push({ id: action.id, milestone: m.id, changed: true, reason: `produces exists: ${produces}` });
        } else {
          actionResults.push({ id: action.id, milestone: m.id, changed: false, reason: `produces missing: ${produces}` });
        }
      } else {
        actionResults.push({ id: action.id, milestone: m.id, changed: false, reason: 'no verifiable produces path' });
      }
    }

    if (planDirty) {
      writeFileSync(planPath, planContent, 'utf-8');
    }
  }

  // ── Step 2: Rebuild DAG with updated action statuses ───────────────────────
  // Re-read actions from disk so we see the freshly written DONE statuses.
  const freshActions = loadActionsFromFolders(planningDir);
  /** @type {Map<string, string[]>} milestoneId → actionIds */
  const milestoneActionIds = new Map();
  /** @type {Map<string, string>} actionId → status */
  const actionStatusMap = new Map();
  for (const a of freshActions) {
    actionStatusMap.set(a.id, a.status);
    for (const mid of a.causes) {
      if (!milestoneActionIds.has(mid)) milestoneActionIds.set(mid, []);
      /** @type {string[]} */ (milestoneActionIds.get(mid)).push(a.id);
    }
  }

  // ── Step 3: Mark milestones DONE in MILESTONES.md ──────────────────────────
  const milestonesPath = join(planningDir, 'MILESTONES.md');
  const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, 'utf-8') : '';
  const { milestones: parsedMilestones } = parseMilestonesFile(milestonesContent);

  let milestonesDirty = false;
  const updatedMilestones = parsedMilestones.map(m => {
    if (isCompleted(m.status)) {
      milestoneResults.push({ id: m.id, changed: false, reason: 'already DONE' });
      return m;
    }

    const actionIds = milestoneActionIds.get(m.id) || [];
    if (actionIds.length === 0) {
      milestoneResults.push({ id: m.id, changed: false, reason: 'no actions found' });
      return m;
    }

    const allDone = actionIds.every(aid => isCompleted(actionStatusMap.get(aid) || 'PENDING'));
    if (allDone) {
      milestonesDirty = true;
      milestoneResults.push({ id: m.id, changed: true, reason: `all ${actionIds.length} actions DONE` });
      return { ...m, status: 'DONE' };
    } else {
      const doneCount = actionIds.filter(aid => isCompleted(actionStatusMap.get(aid) || 'PENDING')).length;
      milestoneResults.push({ id: m.id, changed: false, reason: `${doneCount}/${actionIds.length} actions DONE` });
      return m;
    }
  });

  if (milestonesDirty) {
    // Extract project name from existing content header
    const projectNameMatch = milestonesContent.match(/^# Milestones:\s*(.+)/m);
    const projectName = projectNameMatch ? projectNameMatch[1].trim() : 'Project';
    writeFileSync(milestonesPath, writeMilestonesFile(updatedMilestones, projectName), 'utf-8');
  }

  // ── Step 4: Mark declarations DONE in FUTURE.md ────────────────────────────
  // A declaration is DONE when ALL milestones that realize it are DONE.
  const futurePath = join(planningDir, 'FUTURE.md');
  const futureContent = existsSync(futurePath) ? readFileSync(futurePath, 'utf-8') : '';
  const parsedDeclarations = parseFutureFile(futureContent);

  /** @type {Map<string, string>} milestoneId → status (from updatedMilestones) */
  const milestoneStatusMap = new Map(updatedMilestones.map(m => [m.id, m.status]));

  let futureDirty = false;
  const updatedDeclarations = parsedDeclarations.map(d => {
    if (isCompleted(d.status)) {
      declarationResults.push({ id: d.id, changed: false, reason: 'already DONE' });
      return d;
    }

    // Find all milestones that realize this declaration
    const realizingMilestones = updatedMilestones.filter(m => m.realizes.includes(d.id));
    if (realizingMilestones.length === 0) {
      declarationResults.push({ id: d.id, changed: false, reason: 'no milestones realize this declaration' });
      return d;
    }

    const allDone = realizingMilestones.every(m => isCompleted(milestoneStatusMap.get(m.id) || 'PENDING'));
    if (allDone) {
      futureDirty = true;
      declarationResults.push({ id: d.id, changed: true, reason: `all ${realizingMilestones.length} milestones DONE` });
      return { ...d, status: 'DONE' };
    } else {
      const doneCount = realizingMilestones.filter(m => isCompleted(milestoneStatusMap.get(m.id) || 'PENDING')).length;
      declarationResults.push({ id: d.id, changed: false, reason: `${doneCount}/${realizingMilestones.length} milestones DONE` });
      return d;
    }
  });

  if (futureDirty) {
    const projectNameMatch = futureContent.match(/^# Future:\s*(.+)/m);
    const projectName = projectNameMatch ? projectNameMatch[1].trim() : 'Project';
    writeFileSync(futurePath, writeFutureFile(updatedDeclarations, projectName), 'utf-8');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const actionsDone   = actionResults.filter(r => r.changed).length;
  const msDone        = milestoneResults.filter(r => r.changed).length;
  const declsDone     = declarationResults.filter(r => r.changed).length;

  const summary = [
    `Actions marked DONE: ${actionsDone}/${actionResults.length}`,
    `Milestones marked DONE: ${msDone}/${milestoneResults.length}`,
    `Declarations marked DONE: ${declsDone}/${declarationResults.length}`,
  ].join(' | ');

  return { actions: actionResults, milestones: milestoneResults, declarations: declarationResults, summary };
}

module.exports = { runSyncStatus };
