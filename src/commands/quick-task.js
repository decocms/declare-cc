// @ts-check
'use strict';

/**
 * quick-task command logic.
 *
 * Creates a quick task folder under .planning/quick/NNN-slug/ with a QUICK-PLAN.md.
 * Quick tasks are ad-hoc work items outside the milestone structure.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, mkdirSync, writeFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Generate a URL-safe slug from a description string.
 *
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

/**
 * Determine the next sequential number for a quick task folder.
 * Scans .planning/quick/ for existing NNN-* directories.
 *
 * @param {string} quickDir - Path to .planning/quick/
 * @returns {string} Zero-padded three-digit number, e.g. "001"
 */
function nextQuickNumber(quickDir) {
  if (!existsSync(quickDir)) return '001';

  const entries = readdirSync(quickDir, { withFileTypes: true });
  let max = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^(\d{3})-/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  return String(max + 1).padStart(3, '0');
}

/**
 * Run the quick-task command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--description, --slug)
 * @returns {{ id: string, folder: string, planPath: string, committed: boolean, hash?: string } | { error: string }}
 */
function runQuickTask(cwd, args) {
  const description = parseFlag(args, 'description');
  const slugOverride = parseFlag(args, 'slug');

  if (!description) {
    return { error: 'Missing required flag: --description' };
  }

  const quickDir = join(cwd, '.planning', 'quick');

  // Ensure .planning/quick/ exists
  if (!existsSync(quickDir)) {
    mkdirSync(quickDir, { recursive: true });
  }

  const num = nextQuickNumber(quickDir);
  const slug = slugOverride ? slugify(slugOverride) : slugify(description);
  const folderName = `${num}-${slug}`;
  const folderPath = join(quickDir, folderName);
  const planPath = join(folderPath, 'QUICK-PLAN.md');
  const relFolderPath = `.planning/quick/${folderName}`;
  const relPlanPath = `${relFolderPath}/QUICK-PLAN.md`;

  // Create the task folder
  mkdirSync(folderPath, { recursive: true });

  // Write QUICK-PLAN.md
  const today = new Date().toISOString().slice(0, 10);
  const content = [
    `# Quick Task ${num}: ${description}`,
    '',
    `**ID:** ${num}`,
    `**Created:** ${today}`,
    `**Status:** PENDING`,
    '',
    '## Description',
    '',
    description,
    '',
    '## Tasks',
    '',
    '- [ ] <!-- Add tasks here -->',
    '',
    '## Notes',
    '',
    '<!-- Add notes as you work -->',
    '',
  ].join('\n');

  writeFileSync(planPath, content, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: add quick task ${num} "${description}"`,
      [relPlanPath]
    );
    committed = result.committed;
    hash = result.hash;
  }

  return {
    id: num,
    folder: relFolderPath,
    planPath: relPlanPath,
    committed,
    hash,
  };
}

module.exports = { runQuickTask };
