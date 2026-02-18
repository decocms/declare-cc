// @ts-check
'use strict';

/**
 * audit-milestone command logic.
 *
 * Cross-references completed actions against declarations to identify gaps
 * before a milestone is declared complete.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { parsePlanFile } = require('../artifacts/plan');

/**
 * Run the audit-milestone command.
 *
 * @param {string} cwd
 * @param {string[]} args
 * @returns {{ milestoneId: string, declarationsChecked: number, actionsChecked: number, gaps: Array<{type: string, description: string, severity: string}>, passed: boolean, error?: string }}
 */
function runAuditMilestone(cwd, args) {
  const milestoneId = parseFlag(args, '--milestone') || args[0];

  if (!milestoneId) {
    return { milestoneId: '', declarationsChecked: 0, actionsChecked: 0, gaps: [], passed: false, error: 'Missing --milestone argument (e.g., --milestone M-01)' };
  }

  let dag;
  try {
    dag = buildDagFromDisk(cwd);
  } catch (err) {
    return { milestoneId, declarationsChecked: 0, actionsChecked: 0, gaps: [], passed: false, error: 'Failed to load graph: ' + err.message };
  }

  const milestone = dag.getNode(milestoneId);
  if (!milestone) {
    return { milestoneId, declarationsChecked: 0, actionsChecked: 0, gaps: [], passed: false, error: `Milestone ${milestoneId} not found in graph` };
  }

  // Get declarations this milestone realizes
  const declarationIds = (milestone.realizes || []);
  const declarations = declarationIds.map(id => dag.getNode(id)).filter(Boolean);

  // Get actions for this milestone from PLAN.md
  const milestoneFolder = findMilestoneFolder(cwd, milestoneId);
  let actions = [];
  let planExists = false;

  if (milestoneFolder) {
    const planPath = join(milestoneFolder, 'PLAN.md');
    if (existsSync(planPath)) {
      planExists = true;
      try {
        const plan = parsePlanFile(readFileSync(planPath, 'utf8'));
        actions = plan.actions || [];
      } catch (e) {
        // ignore parse errors, continue with empty actions
      }
    }
  }

  const gaps = [];

  // Check 1: Plan exists
  if (!planExists) {
    gaps.push({
      type: 'missing-plan',
      description: `Milestone ${milestoneId} has no PLAN.md. Run /declare:actions first.`,
      severity: 'blocker',
    });
  }

  // Check 2: All actions are DONE
  const pendingActions = actions.filter(a => a.status !== 'DONE');
  if (pendingActions.length > 0) {
    gaps.push({
      type: 'pending-actions',
      description: `${pendingActions.length} action(s) not yet complete: ${pendingActions.map(a => a.id).join(', ')}`,
      severity: 'blocker',
    });
  }

  // Check 3: Each action has non-empty produces
  const unproducedActions = actions.filter(a => !a.produces || a.produces.trim() === '');
  if (unproducedActions.length > 0) {
    gaps.push({
      type: 'unspecified-produces',
      description: `${unproducedActions.length} action(s) have no "produces" defined: ${unproducedActions.map(a => a.id).join(', ')}`,
      severity: 'warning',
    });
  }

  // Check 4: VERIFICATION.md exists (from /declare:execute)
  if (milestoneFolder) {
    const verificationPath = join(milestoneFolder, 'VERIFICATION.md');
    if (!existsSync(verificationPath)) {
      gaps.push({
        type: 'missing-verification',
        description: `No VERIFICATION.md found. Run /declare:execute to produce verified results.`,
        severity: 'warning',
      });
    }
  }

  // Check 5: Each declaration has at least one completed action tracing to it
  for (const decl of declarations) {
    // Actions that produce something relevant to this declaration
    // (Simplified: check if any DONE action exists — full causal trace would need graph traversal)
    const doneActions = actions.filter(a => a.status === 'DONE');
    if (doneActions.length === 0) {
      gaps.push({
        type: 'declaration-unsupported',
        description: `Declaration ${decl.id} ("${decl.title}") has no completed actions supporting it.`,
        severity: 'blocker',
      });
    }
  }

  const blockers = gaps.filter(g => g.severity === 'blocker');
  const passed = blockers.length === 0;

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    declarationsChecked: declarations.length,
    actionsChecked: actions.length,
    actionsDone: actions.filter(a => a.status === 'DONE').length,
    gaps,
    passed,
  };
}

module.exports = { runAuditMilestone };
