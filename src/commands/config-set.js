// @ts-check
'use strict';

/**
 * config-set command logic.
 *
 * Reads .planning/config.json, sets a value at a dotted path, and writes back.
 * Auto-parses boolean ("true"/"false") and numeric strings.
 * Examples:
 *   node declare-tools.js config-set --key workflow.research --value false
 *   node declare-tools.js config-set --key model_profile --value balanced
 *
 * Returns { key, value, updated: true } on success or { error } on failure.
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Parse a string value into its appropriate JS type.
 * "true" → true, "false" → false, "42" → 42, "3.14" → 3.14, else string.
 *
 * @param {string} raw
 * @returns {boolean | number | string}
 */
function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!Number.isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

/**
 * Set a value in a nested object using a dotted path.
 * Creates intermediate objects as needed.
 *
 * @param {Record<string, unknown>} obj
 * @param {string} path - Dot-separated key path (e.g. "workflow.research")
 * @param {unknown} value
 * @returns {void}
 */
function setAtPath(obj, path, value) {
  const parts = path.split('.');
  /** @type {Record<string, unknown>} */
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = /** @type {Record<string, unknown>} */ (current[part]);
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Parse --key and --value flags from argv.
 *
 * @param {string[]} argv
 * @returns {{ key: string | null, value: string | null }}
 */
function parseKeyValueFlags(argv) {
  let key = null;
  let value = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--key' && i + 1 < argv.length) {
      key = argv[i + 1];
      i++;
    } else if (argv[i] === '--value' && i + 1 < argv.length) {
      value = argv[i + 1];
      i++;
    }
  }
  return { key, value };
}

/**
 * Run the config-set command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI args after the subcommand (e.g. ["--key", "workflow.research", "--value", "false"])
 * @returns {{ key: string, value: unknown, updated: boolean } | { error: string }}
 */
function runConfigSet(cwd, args) {
  const { key: keyPath, value: rawValue } = parseKeyValueFlags(args);

  if (!keyPath) {
    return { error: 'config-set requires --key <path.to.key>' };
  }
  if (rawValue === null) {
    return { error: 'config-set requires --value <value>' };
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

  const parsedValue = parseValue(rawValue);
  setAtPath(config, keyPath, parsedValue);

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  } catch (err) {
    return { error: `Failed to write config.json: ${err.message}` };
  }

  return { key: keyPath, value: parsedValue, updated: true };
}

module.exports = { runConfigSet };
