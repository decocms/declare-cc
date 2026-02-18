// @ts-check
'use strict';

/**
 * config-get command logic.
 *
 * Reads .planning/config.json and returns the value at a dotted path.
 * Examples:
 *   node declare-tools.js config-get workflow.research  → true
 *   node declare-tools.js config-get model_profile      → "quality"
 *
 * Returns { key, value } on success or { error } on failure.
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Get a value from a nested object using a dotted path.
 *
 * @param {Record<string, unknown>} obj
 * @param {string} path - Dot-separated key path (e.g. "workflow.research")
 * @returns {{ found: boolean, value: unknown }}
 */
function getAtPath(obj, path) {
  const parts = path.split('.');
  /** @type {unknown} */
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return { found: false, value: undefined };
    }
    const record = /** @type {Record<string, unknown>} */ (current);
    if (!(part in record)) {
      return { found: false, value: undefined };
    }
    current = record[part];
  }
  return { found: true, value: current };
}

/**
 * Run the config-get command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - Positional args: first is the dotted key path
 * @returns {{ key: string, value: unknown } | { error: string }}
 */
function runConfigGet(cwd, args) {
  const keyPath = args && args[0];
  if (!keyPath) {
    return { error: 'config-get requires a key path argument (e.g., "workflow.research")' };
  }

  const configPath = join(cwd, '.planning', 'config.json');
  if (!existsSync(configPath)) {
    return { error: 'No config.json found. Run /declare:init to initialize the project.' };
  }

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (err) {
    return { error: `Failed to parse config.json: ${err.message}` };
  }

  const { found, value } = getAtPath(config, keyPath);
  if (!found) {
    return { error: `Key not found: ${keyPath}` };
  }

  return { key: keyPath, value };
}

module.exports = { runConfigGet };
