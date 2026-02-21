// @ts-check
'use strict';

/**
 * open command logic.
 *
 * Default invocation handler for `declare` (no subcommand), `declare .`,
 * and `declare /path/to/project`. Resolves the project root, checks if
 * the server is running, starts it in the background if needed, and opens
 * the dashboard in the default browser.
 *
 * Zero runtime dependencies. CJS module.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

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
 * Wait for the server to become available, polling up to maxAttempts times.
 * @param {number} port
 * @param {number} maxAttempts
 * @param {number} intervalMs
 * @returns {Promise<boolean>}
 */
async function waitForServer(port, maxAttempts = 10, intervalMs = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkServer(port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Run the open command: resolve project root, check/start server, open browser.
 *
 * @param {string} cwd - The project root to open (already resolved by dispatcher)
 * @param {string[]} args - Remaining CLI args (unused for now)
 * @returns {Promise<void>}
 */
async function runOpen(cwd, args) {
  // 1. Read port
  const portFile = path.join(cwd, '.planning', 'server.port');
  const port = fs.existsSync(portFile)
    ? parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10)
    : 3847;

  // 2. Check if server is running
  const isRunning = await checkServer(port);

  // 3. Start server if not running
  if (!isRunning) {
    // After esbuild bundling, __dirname === dist/ -- reference bundle by its own filename.
    const bundlePath = path.resolve(__dirname, 'declare-tools.cjs');
    const child = spawn(process.execPath, [bundlePath, 'serve', '--port', String(port)], {
      cwd,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Poll until server is up (up to ~1s)
    const ready = await waitForServer(port);
    if (!ready) {
      console.error('[declare] Warning: server may not be ready yet');
    }
  }

  // 4. Open browser
  const url = `http://localhost:${port}`;
  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();

  // 5. Print confirmation
  console.log(`Dashboard: ${url}`);
}

module.exports = { runOpen };
