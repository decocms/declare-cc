// @ts-check
'use strict';

/**
 * Declare local web server.
 *
 * Serves the Declare graph as a JSON API and static files for the dashboard.
 * Zero runtime dependencies — uses Node's built-in http and fs modules only.
 *
 * Routes:
 *   GET /api/graph          - full graph (declarations, milestones, actions, stats)
 *   GET /api/status         - graph health and performance metrics
 *   GET /api/milestone/:id  - single milestone with full action details
 *   GET /events             - SSE stream; pushes 'change' event when .planning/ changes
 *   GET /                   - serve src/server/public/index.html
 *   GET /public/*           - serve static files from src/server/public/
 *
 * Default port: 3847 (or PORT env var)
 *
 * Usage:
 *   const { createServer, startServer } = require('./src/server/index');
 *   const { server, port, url } = startServer(process.cwd(), 3847);
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { runLoadGraph } = require('../commands/load-graph');
const { runStatus } = require('../commands/status');
const { runGetExecPlan } = require('../commands/get-exec-plan');

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Resolve the public directory for serving the dashboard.
 * Resolution order:
 *  1. .claude/server/public/   — copied there by installer
 *  2. dist/public/             — copied there at build time, ships in npm package
 *  3. src/server/public/       — dev fallback (not in npm package)
 * @param {string} cwd - project root
 * @returns {string}
 */
function getPublicDir(cwd) {
  const installed = path.join(cwd, '.claude', 'server', 'public');
  if (fs.existsSync(installed)) return installed;

  // __dirname in the CJS bundle points to dist/ — dist/public/ is right next to the bundle
  const bundled = path.join(__dirname, 'public');
  if (fs.existsSync(bundled)) return bundled;

  return path.join(cwd, 'src', 'server', 'public');
}

/**
 * Send a JSON response.
 *
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} data
 */
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

/**
 * Send a static file response.
 *
 * @param {http.ServerResponse} res
 * @param {string} filePath
 */
function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

/**
 * Handle GET /api/graph
 * Returns the full graph: declarations, milestones, actions, and stats.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleGraph(res, cwd) {
  try {
    const graph = runLoadGraph(cwd);
    if ('error' in graph) {
      sendJson(res, 500, { error: graph.error });
      return;
    }
    sendJson(res, 200, graph);
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle GET /api/status
 * Returns graph health and performance metrics.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleStatus(res, cwd) {
  try {
    const status = runStatus(cwd);
    if ('error' in status) {
      sendJson(res, 500, { error: status.error });
      return;
    }
    sendJson(res, 200, status);
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle GET /api/milestone/:id
 * Returns a single milestone with full action details.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} milestoneId
 */
function handleMilestone(res, cwd, milestoneId) {
  try {
    const graph = runLoadGraph(cwd);
    if ('error' in graph) {
      sendJson(res, 500, { error: graph.error });
      return;
    }

    const normalizedId = milestoneId.toUpperCase();
    const milestone = graph.milestones.find(
      m => m.id.toUpperCase() === normalizedId
    );

    if (!milestone) {
      sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
      return;
    }

    // Collect actions that cause this milestone
    const milestoneActions = graph.actions.filter(a => {
      if (Array.isArray(a.causes)) {
        return a.causes.some(c => c.toUpperCase() === normalizedId);
      }
      return false;
    });

    sendJson(res, 200, {
      milestone,
      actions: milestoneActions,
    });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle GET /api/activity — return last N events from activity.jsonl.
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleActivity(res, cwd) {
  const activityFile = path.join(cwd, '.planning', 'activity.jsonl');
  if (!fs.existsSync(activityFile)) {
    sendJson(res, 200, { events: [] });
    return;
  }
  try {
    const lines = fs.readFileSync(activityFile, 'utf-8')
      .split('\n').filter(Boolean).slice(-100);
    const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).reverse(); // newest first
    sendJson(res, 200, { events });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/** @type {Set<http.ServerResponse>} Active SSE clients */
const sseClients = new Set();

/**
 * Notify all connected SSE clients that .planning/ changed.
 */
function broadcastChange() {
  for (const client of sseClients) {
    try {
      client.write('event: change\ndata: {}\n\n');
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

/**
 * Watch .planning/ for changes and broadcast to SSE clients.
 * Uses fs.watch with a short debounce to avoid rapid-fire events.
 *
 * @param {string} cwd
 */
function watchPlanning(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) return;

  let graphTimer = null;
  let activityTimer = null;
  const activityFile = path.join(planningDir, 'activity.jsonl');

  try {
    fs.watch(planningDir, { recursive: true }, (_evt, filename) => {
      if (filename && filename.endsWith('activity.jsonl')) {
        // Activity changed — push 'activity' event (fast, no graph reload needed)
        if (activityTimer) clearTimeout(activityTimer);
        activityTimer = setTimeout(() => {
          for (const client of sseClients) {
            try { client.write('event: activity\ndata: {}\n\n'); } catch { sseClients.delete(client); }
          }
          activityTimer = null;
        }, 50);
      } else {
        // Graph file changed — push 'change' event (triggers graph reload)
        if (graphTimer) clearTimeout(graphTimer);
        graphTimer = setTimeout(() => {
          broadcastChange();
          graphTimer = null;
        }, 200);
      }
    });
  } catch (_) {
    // fs.watch may not support recursive on all platforms — fail silently
  }
}

/**
 * Route an incoming request to the appropriate handler.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function route(req, res, cwd) {
  const method = req.method || 'GET';
  const url = req.url || '/';

  // Strip query string for routing
  const urlPath = url.split('?')[0];

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // SSE — live change events for the dashboard
  if (urlPath === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 3000\n\n'); // tell client to reconnect after 3s if dropped
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // API routes
  if (urlPath === '/api/graph') {
    handleGraph(res, cwd);
    return;
  }

  if (urlPath === '/api/status') {
    handleStatus(res, cwd);
    return;
  }

  const milestoneMatch = urlPath.match(/^\/api\/milestone\/([^/]+)$/);
  if (milestoneMatch) {
    handleMilestone(res, cwd, milestoneMatch[1]);
    return;
  }

  if (urlPath === '/api/activity') {
    handleActivity(res, cwd);
    return;
  }

  const actionMatch = urlPath.match(/^\/api\/action\/([^/]+)$/);
  if (actionMatch) {
    const result = runGetExecPlan(cwd, ['--action', actionMatch[1]]);
    sendJson(res, result.error ? 404 : 200, result);
    return;
  }

  // Static file routes
  const publicDir = getPublicDir(cwd);

  if (urlPath === '/') {
    const indexPath = path.join(publicDir, 'index.html');
    sendFile(res, indexPath);
    return;
  }

  if (urlPath.startsWith('/public/')) {
    // Prevent path traversal: resolve and verify it stays within publicDir
    const relative = urlPath.replace(/^\/public\//, '');
    const resolved = path.resolve(publicDir, relative);
    if (!resolved.startsWith(publicDir + path.sep) && resolved !== publicDir) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    sendFile(res, resolved);
    return;
  }

  sendJson(res, 404, { error: `Route not found: ${urlPath}` });
}

/**
 * Create a Declare HTTP server for a given project directory.
 *
 * @param {string} cwd - Project root (working directory)
 * @param {number} [port] - Port to listen on (default: 3847 or PORT env var)
 * @returns {http.Server}
 */
function createServer(cwd, port) {
  const server = http.createServer((req, res) => {
    route(req, res, cwd);
  });
  return server;
}

/**
 * Start the Declare server and begin listening.
 *
 * @param {string} cwd - Project root (working directory)
 * @param {number} [port] - Port to listen on (default: 3847 or PORT env var)
 * @returns {{ server: http.Server, port: number, url: string }}
 */
function startServer(cwd, port) {
  const resolvedPort = port || parseInt(process.env.PORT || '', 10) || 3847;
  const server = createServer(cwd, resolvedPort);

  server.listen(resolvedPort, '127.0.0.1', () => {
    watchPlanning(cwd);
  });

  const url = `http://localhost:${resolvedPort}`;
  return { server, port: resolvedPort, url };
}

module.exports = { createServer, startServer };
