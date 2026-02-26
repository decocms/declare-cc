// @ts-check
'use strict';

/**
 * open command logic.
 *
 * Default invocation handler for `declare` (no subcommand), `declare .`,
 * and `declare /path/to/project`. Resolves the project root, checks if
 * the server is running, starts it in the background if needed, and prints
 * the dashboard URL.
 *
 * Zero runtime dependencies. CJS module.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { runInit } = require('./init');

/**
 * Check if the server is alive on the given port.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function checkServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/graph`, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 300);
      res.resume(); // drain
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for the port file to appear and return the port number.
 * The server writes this file after it's listening.
 * @param {string} portFile
 * @param {number} maxAttempts
 * @param {number} intervalMs
 * @returns {Promise<number|null>}
 */
async function waitForPortFile(portFile, maxAttempts = 30, intervalMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const content = fs.readFileSync(portFile, 'utf8').trim();
      const port = parseInt(content, 10);
      if (!isNaN(port) && port > 0) return port;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Run the open command: resolve project root, check/start server, print URL.
 *
 * @param {string} cwd - The project root to open (already resolved by dispatcher)
 * @param {string[]} args - Remaining CLI args (unused for now)
 * @returns {Promise<void>}
 */
async function runOpen(cwd, args) {
  // 0. Auto-init if .planning/ doesn't exist
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    console.log('Initializing Declare project in: ' + cwd);
    const result = runInit(cwd, []);
    if (result.created && result.created.length > 0) {
      console.log('Created: ' + result.created.join(', '));
    }
  }

  const portFile = path.join(cwd, '.planning', 'server.port');

  // 1. Check if server is already running for this project
  if (fs.existsSync(portFile)) {
    const existingPort = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
    if (!isNaN(existingPort) && existingPort > 0) {
      const isRunning = await checkServer(existingPort);
      if (isRunning) {
        console.log(`Dashboard: http://localhost:${existingPort}`);
        return;
      }
      // Stale port file — server crashed without cleanup
      try { fs.unlinkSync(portFile); } catch (_) {}
    }
  }

  // 2. Start server in background with port 0 (OS picks free port)
  const bundlePath = path.resolve(__dirname, 'declare-tools.cjs');
  const child = spawn(process.execPath, [bundlePath, 'serve'], {
    cwd,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // 3. Wait for the server to write its port file
  const port = await waitForPortFile(portFile);
  if (!port) {
    console.error('[declare] Server failed to start (no port file after 6s)');
    process.exit(1);
  }

  console.log(`Dashboard: http://localhost:${port}`);
}

module.exports = { runOpen };
