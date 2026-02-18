// @ts-check
'use strict';

/**
 * health-check command logic.
 *
 * Validates .planning/ directory structure:
 * - FUTURE.md exists and is parseable
 * - MILESTONES.md exists and is parseable
 * - config.json exists
 * - All milestones referenced in MILESTONES.md have folders in .planning/milestones/
 * - No orphaned milestone folders (folders not referenced in MILESTONES.md)
 *
 * Returns { healthy: boolean, issues: [{type, message, path, fixable}] }
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, readdirSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { parseFutureFile } = require('../artifacts/future');
const { parseMilestonesFile } = require('../artifacts/milestones');
const { findMilestoneFolder, ensureMilestoneFolder } = require('../artifacts/milestone-folders');

/**
 * @typedef {{ type: string, message: string, path: string, fixable: boolean }} HealthIssue
 */

/**
 * Run the health-check command.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ healthy: boolean, issues: HealthIssue[], repaired?: string[] } | { error: string }}
 */
function runHealthCheck(cwd) {
  const planningDir = join(cwd, '.planning');
  const milestonesDir = join(planningDir, 'milestones');

  if (!existsSync(planningDir)) {
    return { error: 'No .planning/ directory found. Run /declare:init to initialize the project.' };
  }

  /** @type {HealthIssue[]} */
  const issues = [];

  // --- Check FUTURE.md ---
  const futurePath = join(planningDir, 'FUTURE.md');
  let declarations = [];
  if (!existsSync(futurePath)) {
    issues.push({
      type: 'missing_file',
      message: 'FUTURE.md is missing',
      path: '.planning/FUTURE.md',
      fixable: false,
    });
  } else {
    try {
      const content = readFileSync(futurePath, 'utf-8');
      declarations = parseFutureFile(content);
    } catch (err) {
      issues.push({
        type: 'parse_error',
        message: `FUTURE.md could not be parsed: ${err.message}`,
        path: '.planning/FUTURE.md',
        fixable: false,
      });
    }
  }

  // --- Check MILESTONES.md ---
  const milestonesPath = join(planningDir, 'MILESTONES.md');
  let milestones = [];
  if (!existsSync(milestonesPath)) {
    issues.push({
      type: 'missing_file',
      message: 'MILESTONES.md is missing',
      path: '.planning/MILESTONES.md',
      fixable: false,
    });
  } else {
    try {
      const content = readFileSync(milestonesPath, 'utf-8');
      const parsed = parseMilestonesFile(content);
      milestones = parsed.milestones;
    } catch (err) {
      issues.push({
        type: 'parse_error',
        message: `MILESTONES.md could not be parsed: ${err.message}`,
        path: '.planning/MILESTONES.md',
        fixable: false,
      });
    }
  }

  // --- Check config.json ---
  const configPath = join(planningDir, 'config.json');
  if (!existsSync(configPath)) {
    issues.push({
      type: 'missing_file',
      message: 'config.json is missing',
      path: '.planning/config.json',
      fixable: false,
    });
  } else {
    try {
      JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (err) {
      issues.push({
        type: 'parse_error',
        message: `config.json could not be parsed: ${err.message}`,
        path: '.planning/config.json',
        fixable: false,
      });
    }
  }

  // --- Check milestone folders ---
  if (milestones.length > 0) {
    for (const milestone of milestones) {
      const folder = findMilestoneFolder(planningDir, milestone.id);
      if (!folder) {
        issues.push({
          type: 'missing_folder',
          message: `Milestone ${milestone.id} ("${milestone.title}") has no folder in .planning/milestones/`,
          path: `.planning/milestones/${milestone.id}-*`,
          fixable: true,
          // Store data needed for repair
          _milestoneId: milestone.id,
          _milestoneTitle: milestone.title,
        });
      }
    }
  }

  // --- Check for orphaned milestone folders ---
  if (existsSync(milestonesDir)) {
    let entries;
    try {
      entries = readdirSync(milestonesDir, { withFileTypes: true });
    } catch {
      entries = [];
    }

    const referencedIds = new Set(milestones.map(m => m.id));
    const milestoneIdPattern = /^(M-\d+)/;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip _archived and similar meta-folders
      if (entry.name.startsWith('_')) continue;

      const match = entry.name.match(milestoneIdPattern);
      if (!match) continue;

      const folderId = match[1];
      if (!referencedIds.has(folderId)) {
        issues.push({
          type: 'orphaned_folder',
          message: `Folder "${entry.name}" has no corresponding milestone in MILESTONES.md`,
          path: `.planning/milestones/${entry.name}`,
          fixable: false,
        });
      }
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

/**
 * Run health-check and attempt to fix fixable issues.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ healthy: boolean, issues: HealthIssue[], repaired: string[] } | { error: string }}
 */
function runHealthCheckRepair(cwd) {
  const planningDir = join(cwd, '.planning');
  const result = runHealthCheck(cwd);

  if (result.error) return result;

  /** @type {string[]} */
  const repaired = [];

  for (const issue of result.issues) {
    if (!issue.fixable) continue;

    if (issue.type === 'missing_folder' && issue._milestoneId && issue._milestoneTitle) {
      try {
        ensureMilestoneFolder(planningDir, issue._milestoneId, issue._milestoneTitle);
        repaired.push(`Created folder for ${issue._milestoneId}: ${issue._milestoneTitle}`);
      } catch (err) {
        // Leave in issues list if repair failed
      }
    }
  }

  // Re-run health check to get updated state
  const recheck = runHealthCheck(cwd);
  if (recheck.error) return recheck;

  return {
    healthy: recheck.healthy,
    issues: recheck.issues,
    repaired,
  };
}

module.exports = { runHealthCheck, runHealthCheckRepair };
