#!/usr/bin/env node
// Declare dashboard server — SessionStart hook
//
// On every Claude Code session start (for a Declare project):
//   1. Derive a stable port for this project (hash of cwd, range 3847-4846)
//   2. If a server is already running on that port for THIS project, leave it
//   3. If a server is running on that port for a DIFFERENT project, kill it
//   4. Start a fresh server for the current project
//   5. Write the port to .planning/server.port for /declare:dashboard to read
//
// This means each project gets its own port, servers survive between sessions,
// and switching projects always gives you the right server.

'use strict';

const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const cp     = require('child_process');

const cwd         = process.cwd();
const planningDir = path.join(cwd, '.planning');

// Only run for Declare projects
if (!fs.existsSync(planningDir)) process.exit(0);

const PORT_BASE  = 3847;
const PORT_RANGE = 1000; // ports 3847–4846

/**
 * Simple djb2 hash to derive a stable port from the project path.
 * @param {string} str
 * @returns {number} port in [PORT_BASE, PORT_BASE + PORT_RANGE)
 */
function projectPort(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return PORT_BASE + (h % PORT_RANGE);
}

const port = projectPort(cwd);
const portFile = path.join(planningDir, 'server.port');
const bundle   = path.join(cwd, '.claude', 'declare-tools.cjs');

// If bundle doesn't exist, nothing to do
if (!fs.existsSync(bundle)) process.exit(0);

/**
 * Ask the running server on `port` which cwd it's serving, via /api/graph.
 * Returns the project name or null if nothing is running / not a Declare server.
 */
function checkRunningServer(port, callback) {
  const req = http.get(`http://127.0.0.1:${port}/api/graph`, { timeout: 1500 }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        // If it has a valid graph response it's our server
        callback(data && !data.error ? 'declare' : null);
      } catch { callback(null); }
    });
  });
  req.on('error', () => callback(null));
  req.on('timeout', () => { req.destroy(); callback(null); });
}

/**
 * Kill any process currently listening on the given port.
 */
function killPort(port) {
  try {
    const pid = cp.execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (pid) {
      pid.split('\n').forEach(p => {
        try { process.kill(parseInt(p), 'SIGTERM'); } catch {}
      });
    }
  } catch {}
}

/**
 * Start the dashboard server for this project in the background.
 */
function startServer() {
  const child = cp.spawn(process.execPath, [bundle, 'serve', '--port', String(port)], {
    cwd,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Write port file so /declare:dashboard knows where to open
  setTimeout(() => {
    try { fs.writeFileSync(portFile, String(port)); } catch {}
  }, 800);
}

// Check if something is already running on this port
checkRunningServer(port, status => {
  if (status === 'declare') {
    // A Declare server is already up on our port.
    // It might be from a previous session for this same project — reuse it.
    // Write port file to make sure /declare:dashboard finds it.
    try { fs.writeFileSync(portFile, String(port)); } catch {}
    process.exit(0);
  }

  // Nothing running (or non-Declare process) — kill whatever is there and start fresh
  killPort(port);
  setTimeout(startServer, 300);
  process.exit(0);
});
