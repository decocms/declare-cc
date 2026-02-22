// @ts-check
'use strict';

/**
 * delete-declaration command logic.
 *
 * Removes an existing declaration (D-XX) from FUTURE.md by ID.
 * Refuses to delete declarations with linked milestones (use renegotiate instead).
 * Commits atomically when configured.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseFutureFile, writeFutureFile } = require('../artifacts/future');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Run the delete-declaration command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--id)
 * @returns {{ id: string, title: string, deleted: boolean, committed: boolean, hash?: string } | { error: string }}
 */
function runDeleteDeclaration(cwd, args) {
  const id = parseFlag(args, 'id');

  if (!id) {
    return { error: 'Missing required flag: --id' };
  }

  const planningDir = join(cwd, '.planning');
  const futurePath = join(planningDir, 'FUTURE.md');

  if (!existsSync(futurePath)) {
    return { error: 'FUTURE.md not found' };
  }

  // Load existing declarations
  const futureContent = readFileSync(futurePath, 'utf-8');
  const declarations = parseFutureFile(futureContent);

  // Find declaration by ID
  const decl = declarations.find(d => d.id === id);
  if (!decl) {
    return { error: `Declaration not found: ${id}` };
  }

  // Check for linked milestones
  if (decl.milestones && decl.milestones.length > 0) {
    return { error: 'Cannot delete declaration with linked milestones. Renegotiate instead.' };
  }

  // Remove declaration
  const filtered = declarations.filter(d => d.id !== id);

  // Extract project name from FUTURE.md header
  const headerMatch = futureContent.match(/^# Future: (.+)/m);
  const projectName = headerMatch ? headerMatch[1].trim() : 'Project';

  // Write FUTURE.md
  const content = writeFutureFile(filtered, projectName);
  writeFileSync(futurePath, content, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: delete ${id} "${decl.title}"`,
      ['.planning/FUTURE.md']
    );
    committed = result.committed;
    hash = result.hash;
  }

  return { id, title: decl.title, deleted: true, committed, hash };
}

module.exports = { runDeleteDeclaration };
