// @ts-check
'use strict';

/**
 * serve command logic.
 *
 * Starts the Declare local web server, which exposes the graph as a JSON API
 * and serves the browser-based dashboard from src/server/public/.
 *
 * Zero runtime dependencies. CJS module.
 *
 * Usage:
 *   node declare-tools.js serve [--port 3847] [--cwd /path/to/project]
 */

const { spawn } = require('child_process');
const { startServer } = require('../server/index');

/**
 * Parse --port flag from argv.
 *
 * @param {string[]} args
 * @returns {number | undefined}
 */
function parsePortFlag(args) {
  const idx = args.indexOf('--port');
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  const value = parseInt(args[idx + 1], 10);
  return Number.isNaN(value) ? undefined : value;
}

/**
 * Run the serve command.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (e.g. ['--port', '3847'])
 * @returns {Promise<{ url: string, port: number, pid: number }>}
 */
async function runServe(cwd, args) {
  const port = parsePortFlag(args) || parseInt(process.env.PORT || '', 10) || 3847;

  const { server, port: resolvedPort, url } = await startServer(cwd, port);

  // Open browser
  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();

  // Keep the process alive — the server handles shutdown via SIGINT/SIGTERM
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });

  return { url, port: resolvedPort, pid: process.pid };
}

module.exports = { runServe };
