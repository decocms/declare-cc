// @ts-check
'use strict';

/**
 * PROJECT.md reader and writer for Declare projects.
 *
 * PROJECT.md is the persistent project context document — it captures
 * what the project is, its core value, current state, and constraints.
 * It survives across sessions and is the primary reference for all agents.
 *
 * Zero runtime dependencies. CJS module.
 */

const fs = require('fs');
const path = require('path');

/**
 * Get the path to PROJECT.md for a given project directory.
 * @param {string} cwd - Project root directory
 * @returns {string}
 */
function projectPath(cwd) {
  return path.join(cwd, '.planning', 'PROJECT.md');
}

/**
 * Read PROJECT.md from a project directory.
 *
 * Returns the raw markdown string, or null if the file does not exist.
 *
 * @param {string} cwd - Project root directory
 * @returns {string | null}
 */
function readProject(cwd) {
  const filePath = projectPath(cwd);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Write PROJECT.md to a project directory.
 *
 * The content parameter is written verbatim — callers are responsible
 * for formatting. This allows both template-based initialization and
 * freeform updates from agents.
 *
 * Creates .planning/ directory if it does not exist.
 *
 * @param {string} cwd - Project root directory
 * @param {string} content - Raw markdown content
 * @returns {{ ok: boolean, path: string }}
 */
function writeProject(cwd, content) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  const filePath = projectPath(cwd);
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, path: filePath };
}

module.exports = { readProject, writeProject };
