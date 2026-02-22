// @ts-check
'use strict';

/**
 * update-declaration command logic.
 *
 * Updates an existing declaration (D-XX) in FUTURE.md by ID.
 * Supports updating title, statement, and/or status fields.
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
 * Run the update-declaration command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--id, --title, --statement, --status)
 * @returns {{ id: string, title: string, statement: string, status: string, committed: boolean, hash?: string } | { error: string }}
 */
function runUpdateDeclaration(cwd, args) {
  const id = parseFlag(args, 'id');
  const title = parseFlag(args, 'title');
  const statement = parseFlag(args, 'statement');
  const status = parseFlag(args, 'status');

  if (!id) {
    return { error: 'Missing required flag: --id' };
  }
  if (!title && !statement && !status) {
    return { error: 'At least one of --title, --statement, or --status must be provided' };
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

  // Update provided fields
  if (title) decl.title = title;
  if (statement) decl.statement = statement;
  if (status) decl.status = status.toUpperCase();

  // Extract project name from FUTURE.md header
  const headerMatch = futureContent.match(/^# Future: (.+)/m);
  const projectName = headerMatch ? headerMatch[1].trim() : 'Project';

  // Write FUTURE.md
  const content = writeFutureFile(declarations, projectName);
  writeFileSync(futurePath, content, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: update ${id} "${decl.title}"`,
      ['.planning/FUTURE.md']
    );
    committed = result.committed;
    hash = result.hash;
  }

  return { id, title: decl.title, statement: decl.statement, status: decl.status, committed, hash };
}

module.exports = { runUpdateDeclaration };
