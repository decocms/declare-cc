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
 *   GET /api/milestone/:id/log - execution log for a milestone (plain text)
 *   GET /api/readiness         - readiness state map for all milestones
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
const net = require('node:net');
const path = require('node:path');

const { runLoadGraph } = require('../commands/load-graph');
const { runStatus } = require('../commands/status');
const { runGetExecPlan } = require('../commands/get-exec-plan');
const { runAddDeclaration } = require('../commands/add-declaration');
const { runUpdateDeclaration } = require('../commands/update-declaration');
const { runDeleteDeclaration } = require('../commands/delete-declaration');
const { createProcessManager } = require('./process-manager');
const { createDerivationRunner } = require('./derivation-runner');
const { createActionDerivationRunner } = require('./action-derivation-runner');
const { createRevisionRunner } = require('./revision-runner');
const { runAddMilestonesBatch } = require('../commands/add-milestones-batch');
const { buildDagFromDisk } = require('../commands/build-dag');
const { computeWorkabilityPath, VALID_REVIEW_STATES } = require('../graph/engine');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');
const { parseFutureFile, writeFutureFile } = require('../artifacts/future');
const { parsePlanFile, writePlanFile } = require('../artifacts/plan');
const { parseMilestonesFile, writeMilestonesFile } = require('../artifacts/milestones');
const { computeWorkflowState } = require('../commands/workflow-state');
const { createPlayRunner } = require('../commands/play');
const { computeReadiness } = require('../commands/readiness');

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

/**
 * Read and parse JSON body from an incoming request.
 * Caps at 64KB to prevent abuse.
 *
 * @param {http.IncomingMessage} req
 * @returns {Promise<any>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX_SIZE = 64 * 1024; // 64KB

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_SIZE) {
        reject(new Error('Request body too large (max 64KB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
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
 * Handle GET /api/milestone/:id/log
 * Returns the execution.log content as plain text for a milestone.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} milestoneId
 */
function handleMilestoneLog(res, cwd, milestoneId) {
  const planningDir = path.join(cwd, '.planning');
  const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);

  if (!milestoneFolder) {
    sendJson(res, 404, { error: 'Milestone folder not found' });
    return;
  }

  const logPath = path.join(milestoneFolder, 'execution.log');
  fs.readFile(logPath, 'utf-8', (err, data) => {
    if (err) {
      // Missing log file is not an error — return empty response
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end('');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(data),
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

/**
 * Handle GET /api/workability/:id
 * Returns the workability path for a given node.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
function handleWorkability(res, cwd, nodeId) {
  try {
    const result = buildDagFromDisk(cwd);
    if ('error' in result && !('dag' in result)) {
      sendJson(res, 500, { error: result.error });
      return;
    }

    const { dag } = result;
    const normalizedId = nodeId.toUpperCase();

    if (!dag.getNode(normalizedId)) {
      sendJson(res, 404, { error: `Node '${nodeId}' not found` });
      return;
    }

    const path = computeWorkabilityPath(dag, normalizedId);
    sendJson(res, 200, path);
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle GET /api/workflow/state
 * Computes and returns the current workflow state from the DAG.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleWorkflowState(res, cwd) {
  try {
    const graph = runLoadGraph(cwd);
    if ('error' in graph) {
      sendJson(res, 500, { error: graph.error });
      return;
    }

    // Include running actions for accurate executing state detection
    const pm = getProcessManager(cwd);
    const runningIds = new Set(pm.running());

    const result = computeWorkflowState(graph, runningIds);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle GET /api/readiness
 * Returns the readiness state map for all milestones.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleReadiness(res, cwd) {
  try {
    const graph = runLoadGraph(cwd);
    if ('error' in graph) {
      sendJson(res, 500, { error: graph.error });
      return;
    }
    sendJson(res, 200, graph.readiness || {});
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

/**
 * Handle GET /api/files?path=...
 * Returns raw file content as JSON for the inline file viewer.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleFileContent(req, res, cwd) {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestedPath = parsedUrl.searchParams.get('path');

    if (!requestedPath) {
      sendJson(res, 400, { error: "Missing 'path' query parameter" });
      return;
    }

    const resolvedPath = path.resolve(cwd, requestedPath);

    // Path traversal guard: resolved path must be within cwd
    if (resolvedPath !== cwd && !resolvedPath.startsWith(cwd + path.sep)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    if (fs.statSync(resolvedPath).isDirectory()) {
      sendJson(res, 400, { error: 'Path is a directory' });
      return;
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    sendJson(res, 200, { path: requestedPath, content: fileContent });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/action/:id/execute
 * Validates action has an exec-plan, then spawns Claude CLI.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} actionId
 */
function handleExecuteAction(res, cwd, actionId) {
  try {
    const result = runGetExecPlan(cwd, ['--action', actionId]);
    if (result.error || !result.execPlan) {
      sendJson(res, 400, { error: 'Action not found or no exec-plan' });
      return;
    }

    // Approval gate: reject if action's reviewState is not 'approved'
    const graph = runLoadGraph(cwd);
    if (!('error' in graph)) {
      const normalizedId = actionId.toUpperCase();
      const action = graph.actions.find(a => a.id.toUpperCase() === normalizedId);
      if (action && action.reviewState !== 'approved') {
        sendJson(res, 403, {
          error: 'Action not approved for execution',
          unapproved: [{ id: action.id, title: action.title, reviewState: action.reviewState || 'draft' }],
        });
        return;
      }
    }

    const pm = getProcessManager(cwd);
    const execResult = pm.execute(actionId, result.milestoneId);
    if (execResult.error) {
      sendJson(res, execResult.status || 500, { error: execResult.error });
      return;
    }

    sendJson(res, 202, { ok: true, actionId });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/milestones/derive
 * Triggers a milestone derivation subprocess via the derivation runner.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
async function handleDerive(req, res, cwd) {
  try {
    const body = await readJsonBody(req);
    const graph = runLoadGraph(cwd);
    if ('error' in graph) {
      sendJson(res, 500, { error: graph.error });
      return;
    }

    const declarations = graph.declarations.map(d => ({
      id: d.id,
      statement: d.statement,
      milestones: d.milestones || [],
    }));

    const dr = getDerivationRunner(cwd);
    const result = dr.derive(body.declarationId || null, declarations);
    if (result.error) {
      sendJson(res, result.status || 500, { error: result.error });
      return;
    }

    sendJson(res, 202, { ok: true, sessionId: result.sessionId });
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

/**
 * Handle POST /api/milestones/derive/stop
 * Stops the running derivation process.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleDeriveStop(res, cwd) {
  const dr = getDerivationRunner(cwd);
  const result = dr.stop();
  if (result.error) {
    sendJson(res, result.status || 500, { error: result.error });
  } else {
    sendJson(res, 200, { ok: true });
  }
}

/**
 * Handle POST /api/milestones/derive/accept
 * Accepts proposed milestones and persists them via add-milestones-batch.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
async function handleDeriveAccept(req, res, cwd) {
  try {
    const body = await readJsonBody(req);
    if (!body.milestones || !Array.isArray(body.milestones) || body.milestones.length === 0) {
      sendJson(res, 400, { error: 'Missing or empty milestones array' });
      return;
    }

    const result = runAddMilestonesBatch(cwd, ['--json', JSON.stringify(body.milestones)]);
    if ('error' in result) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    sendJson(res, 200, result);
    broadcastChange();
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

/**
 * Handle POST /api/milestones/:id/actions/derive
 * Triggers action derivation for a specific milestone.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} milestoneId
 */
function handleActionDerive(res, cwd, milestoneId) {
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

    // Get existing actions for this milestone
    const existingActions = graph.actions.filter(a =>
      (a.causes || []).some(c => c.toUpperCase() === normalizedId)
    );

    const adr = getActionDerivationRunner(cwd);
    const result = adr.derive(
      { id: milestone.id, title: milestone.title, status: milestone.status, realizes: milestone.realizes || [] },
      existingActions.map(a => ({ id: a.id, title: a.title, status: a.status, produces: a.produces || '' }))
    );

    if (result.error) {
      sendJson(res, result.status || 500, { error: result.error });
      return;
    }

    sendJson(res, 202, { ok: true, sessionId: result.sessionId });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/milestones/:id/actions/derive/stop
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleActionDeriveStop(res, cwd) {
  const adr = getActionDerivationRunner(cwd);
  const result = adr.stop();
  if (result.error) {
    sendJson(res, result.status || 500, { error: result.error });
  } else {
    sendJson(res, 200, { ok: true });
  }
}

/**
 * Handle POST /api/milestones/:id/actions/derive/accept
 * Accepts proposed actions and persists them to the milestone's PLAN.md.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} milestoneId
 */
async function handleActionDeriveAccept(req, res, cwd, milestoneId) {
  try {
    const body = await readJsonBody(req);
    if (!body.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
      sendJson(res, 400, { error: 'Missing or empty actions array' });
      return;
    }

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

    // Find milestone folder
    const planningDir = path.join(cwd, '.planning');
    const milestoneFolder = findMilestoneFolder(planningDir, milestone.id);

    // Get existing actions from PLAN.md (if any)
    let existingActions = [];
    let planContent = '';
    const planPath = milestoneFolder
      ? path.join(milestoneFolder, 'PLAN.md')
      : null;

    if (planPath && fs.existsSync(planPath)) {
      planContent = fs.readFileSync(planPath, 'utf-8');
      const parsed = parsePlanFile(planContent);
      existingActions = parsed.actions || [];
    }

    // Compute next action IDs — find the max existing action number
    let maxActionNum = 0;
    for (const a of graph.actions) {
      const num = parseInt(a.id.split('-')[1], 10);
      if (!isNaN(num) && num > maxActionNum) maxActionNum = num;
    }

    // Build merged action list
    const newActions = [];
    for (const input of body.actions) {
      maxActionNum++;
      const id = `A-${maxActionNum < 10 ? '0' + maxActionNum : maxActionNum}`;
      newActions.push({
        id,
        title: input.title,
        status: 'PENDING',
        produces: input.produces || '',
      });
    }

    const allActions = [...existingActions, ...newActions];

    // Ensure milestone folder exists
    const { ensureMilestoneFolder } = require('../artifacts/milestone-folders');
    const folder = ensureMilestoneFolder(planningDir, milestone.id, milestone.title);
    const targetPlanPath = path.join(folder, 'PLAN.md');

    // Write PLAN.md
    const realizes = milestone.realizes || [];
    const output = writePlanFile(milestone.id, milestone.title, realizes, allActions);
    fs.writeFileSync(targetPlanPath, output, 'utf-8');

    // Update MILESTONES.md to mark hasPlan = true
    const milestonesPath = path.join(planningDir, 'MILESTONES.md');
    if (fs.existsSync(milestonesPath)) {
      let milestonesContent = fs.readFileSync(milestonesPath, 'utf-8');
      // Simple regex replace: find the milestone row and set Plan to YES
      const rowPattern = new RegExp(`(\\|\\s*${milestone.id}\\s*\\|.*?)\\s*NO\\s*\\|\\s*$`, 'm');
      if (rowPattern.test(milestonesContent)) {
        milestonesContent = milestonesContent.replace(rowPattern, '$1 YES |');
        fs.writeFileSync(milestonesPath, milestonesContent, 'utf-8');
      }
    }

    sendJson(res, 200, {
      actions: newActions,
      milestoneId: milestone.id,
    });
    broadcastChange();
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

/**
 * Set the review state of any D, M, or A node by writing to the appropriate artifact file.
 * Reusable helper — called by both the review-state PUT endpoint and the annotation handler.
 *
 * @param {string} cwd
 * @param {string} nodeId
 * @param {string} reviewState
 * @returns {{ ok: true, id: string, reviewState: string } | { error: string, status?: number }}
 */
function setReviewState(cwd, nodeId, reviewState) {
  if (!reviewState || !VALID_REVIEW_STATES.has(reviewState)) {
    return { error: `Invalid reviewState. Must be one of: ${[...VALID_REVIEW_STATES].join(', ')}`, status: 400 };
  }

  const id = nodeId.toUpperCase();
  const prefix = id.split('-')[0];
  const planningDir = path.join(cwd, '.planning');

  if (prefix === 'D') {
    const futurePath = path.join(planningDir, 'FUTURE.md');
    if (!fs.existsSync(futurePath)) return { error: 'FUTURE.md not found', status: 404 };
    const content = fs.readFileSync(futurePath, 'utf-8');
    const declarations = parseFutureFile(content);
    const decl = declarations.find(d => d.id === id);
    if (!decl) return { error: `Declaration ${id} not found`, status: 404 };
    decl.reviewState = reviewState;
    const headerMatch = content.match(/^# Future: (.+)/m);
    const projectName = headerMatch ? headerMatch[1].trim() : 'Project';
    fs.writeFileSync(futurePath, writeFutureFile(declarations, projectName), 'utf-8');

  } else if (prefix === 'M') {
    const milestonesPath = path.join(planningDir, 'MILESTONES.md');
    if (!fs.existsSync(milestonesPath)) return { error: 'MILESTONES.md not found', status: 404 };
    const content = fs.readFileSync(milestonesPath, 'utf-8');
    const { milestones } = parseMilestonesFile(content);
    const mile = milestones.find(m => m.id === id);
    if (!mile) return { error: `Milestone ${id} not found`, status: 404 };
    mile.reviewState = reviewState;
    const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
    const pName = nameMatch ? nameMatch[1].trim() : 'Project';
    fs.writeFileSync(milestonesPath, writeMilestonesFile(milestones, pName), 'utf-8');

  } else if (prefix === 'A') {
    const milestonesDir = path.join(planningDir, 'milestones');
    if (!fs.existsSync(milestonesDir)) return { error: 'No milestones directory', status: 404 };
    let found = false;
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const planPath = path.join(milestonesDir, entry.name, 'PLAN.md');
      if (!fs.existsSync(planPath)) continue;
      const content = fs.readFileSync(planPath, 'utf-8');
      const parsed = parsePlanFile(content);
      const action = parsed.actions.find(a => a.id === id);
      if (!action) continue;
      const lines = content.split('\n');
      let inSection = false;
      let patched = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
          inSection = lines[i].startsWith(`### ${id}:`);
        }
        if (inSection && !patched && /^\*\*Review:\*\*/i.test(lines[i].trim())) {
          lines[i] = `**Review:** ${reviewState}`;
          patched = true;
          break;
        }
        if (inSection && !patched && /^\*\*Status:\*\*/i.test(lines[i].trim())) {
          if (i + 1 < lines.length && /^\*\*Review:\*\*/i.test(lines[i + 1].trim())) {
            lines[i + 1] = `**Review:** ${reviewState}`;
            patched = true;
          } else {
            lines.splice(i + 1, 0, `**Review:** ${reviewState}`);
            patched = true;
          }
          break;
        }
      }
      if (patched) {
        fs.writeFileSync(planPath, lines.join('\n'), 'utf-8');
        found = true;
      }
      break;
    }
    if (!found) return { error: `Action ${id} not found in any PLAN.md`, status: 404 };

  } else {
    return { error: `Unknown node type prefix: ${prefix}`, status: 400 };
  }

  return { ok: true, id, reviewState };
}

/**
 * Handle PUT /api/node/:id/review-state
 * Updates the review state of any D, M, or A node by writing to the appropriate artifact file.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
async function handleUpdateReviewState(req, res, cwd, nodeId) {
  try {
    const body = await readJsonBody(req);
    const result = setReviewState(cwd, nodeId, body.reviewState);

    if ('error' in result) {
      sendJson(res, result.status || 500, { error: result.error });
      return;
    }

    sendJson(res, 200, result);
    broadcastChange();
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Annotation helpers and handlers
// ---------------------------------------------------------------------------

/**
 * Get the path to the annotations JSON file for a given node.
 * @param {string} cwd
 * @param {string} nodeId
 * @returns {string}
 */
function getAnnotationsPath(cwd, nodeId) {
  return path.join(cwd, '.planning', 'annotations', `${nodeId.toUpperCase()}.json`);
}

/**
 * Read annotations for a node. Returns default structure if file is missing.
 * @param {string} cwd
 * @param {string} nodeId
 * @returns {{ nodeId: string, annotations: Array<{id: string, line: number, text: string, timestamp: string, resolved: boolean}> }}
 */
function readAnnotations(cwd, nodeId) {
  const filePath = getAnnotationsPath(cwd, nodeId);
  if (!fs.existsSync(filePath)) {
    return { nodeId: nodeId.toUpperCase(), annotations: [], revisionRound: 0 };
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data.revisionRound = data.revisionRound || 0;
    return data;
  } catch (_) {
    return { nodeId: nodeId.toUpperCase(), annotations: [], revisionRound: 0 };
  }
}

/**
 * Write annotations data for a node.
 * @param {string} cwd
 * @param {string} nodeId
 * @param {{ nodeId: string, annotations: Array<any> }} data
 */
function writeAnnotations(cwd, nodeId, data) {
  const filePath = getAnnotationsPath(cwd, nodeId);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Handle GET /api/node/:id/annotations
 * Returns all annotations for the given node.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
function handleGetAnnotations(res, cwd, nodeId) {
  try {
    const data = readAnnotations(cwd, nodeId);
    sendJson(res, 200, data);
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/node/:id/annotations
 * Creates a new annotation on the given node.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
async function handleAddAnnotation(req, res, cwd, nodeId) {
  try {
    const body = await readJsonBody(req);
    const { line, text } = body;

    if (typeof line !== 'number' || line < 1) {
      sendJson(res, 400, { error: 'line must be a number >= 1' });
      return;
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      sendJson(res, 400, { error: 'text must be a non-empty string' });
      return;
    }

    const id = 'ann-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const annotation = {
      id,
      line,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    const data = readAnnotations(cwd, nodeId);
    data.annotations.push(annotation);
    writeAnnotations(cwd, nodeId, data);

    // Auto-transition node to revision_needed when an annotation is added
    setReviewState(cwd, nodeId, 'revision_needed');

    broadcastChange();

    sendJson(res, 201, annotation);
  } catch (err) {
    sendJson(res, 400, { error: String(err) });
  }
}

/**
 * Handle DELETE /api/node/:id/annotations/:annotationId
 * Removes a specific annotation from the given node.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 * @param {string} annotationId
 */
function handleDeleteAnnotation(res, cwd, nodeId, annotationId) {
  try {
    const data = readAnnotations(cwd, nodeId);
    const before = data.annotations.length;
    data.annotations = data.annotations.filter(a => a.id !== annotationId);

    if (data.annotations.length === before) {
      sendJson(res, 404, { error: 'Annotation not found' });
      return;
    }

    writeAnnotations(cwd, nodeId, data);
    broadcastChange();

    sendJson(res, 200, { ok: true, id: annotationId });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/node/:id/annotations/increment-round
 * Increments the revision round counter for a node's annotations.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
function handleIncrementRevisionRound(res, cwd, nodeId) {
  try {
    const data = readAnnotations(cwd, nodeId);
    data.revisionRound = (data.revisionRound || 0) + 1;
    writeAnnotations(cwd, nodeId, data);
    broadcastChange();
    sendJson(res, 200, { ok: true, revisionRound: data.revisionRound });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/** @type {Set<http.ServerResponse>} Active SSE clients */
const sseClients = new Set();

/** @type {ReturnType<typeof createProcessManager> | null} */
let processManager = null;

/**
 * Get or create the process manager singleton.
 * @param {string} cwd
 * @returns {ReturnType<typeof createProcessManager>}
 */
function getProcessManager(cwd) {
  if (!processManager) processManager = createProcessManager(sseClients, cwd);
  return processManager;
}

/** @type {ReturnType<typeof createDerivationRunner> | null} */
let derivationRunner = null;

/**
 * Get or create the derivation runner singleton.
 * @param {string} cwd
 * @returns {ReturnType<typeof createDerivationRunner>}
 */
function getDerivationRunner(cwd) {
  if (!derivationRunner) derivationRunner = createDerivationRunner(sseClients, cwd);
  return derivationRunner;
}

/** @type {ReturnType<typeof createActionDerivationRunner> | null} */
let actionDerivationRunner = null;

/**
 * Get or create the action derivation runner singleton.
 * @param {string} cwd
 * @returns {ReturnType<typeof createActionDerivationRunner>}
 */
function getActionDerivationRunner(cwd) {
  if (!actionDerivationRunner) actionDerivationRunner = createActionDerivationRunner(sseClients, cwd);
  return actionDerivationRunner;
}

/** @type {ReturnType<typeof createPlayRunner> | null} */
let playRunner = null;

/**
 * Get or create the play runner singleton.
 * @param {string} cwd
 * @returns {ReturnType<typeof createPlayRunner>}
 */
function getPlayRunner(cwd) {
  if (!playRunner) playRunner = createPlayRunner(sseClients, cwd);
  return playRunner;
}

/** @type {ReturnType<typeof createRevisionRunner> | null} */
let revisionRunner = null;

/**
 * Get or create the revision runner singleton.
 * @param {string} cwd
 * @returns {ReturnType<typeof createRevisionRunner>}
 */
function getRevisionRunner(cwd) {
  if (!revisionRunner) {
    revisionRunner = createRevisionRunner(sseClients, cwd, (nodeId) => {
      setReviewState(cwd, nodeId, 'in_review');
      broadcastChange();
    });
  }
  return revisionRunner;
}

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
 * Handle GET /api/node/:id/revisions
 * Returns current and previous version content for diffing.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
function handleGetRevisions(res, cwd, nodeId) {
  try {
    const id = nodeId.toUpperCase();
    const prefix = id.split('-')[0];
    const planningDir = path.join(cwd, '.planning');

    // Determine artifact path based on node type (same logic as handleRevise)
    let artifactPath = null;
    if (prefix === 'D') {
      artifactPath = path.join(planningDir, 'FUTURE.md');
    } else if (prefix === 'M') {
      const folder = findMilestoneFolder(planningDir, id);
      if (folder) artifactPath = path.join(folder, 'PLAN.md');
    } else if (prefix === 'A') {
      const graph = runLoadGraph(cwd);
      if (!('error' in graph)) {
        const action = graph.actions.find(a => a.id.toUpperCase() === id);
        if (action) {
          const milestoneId = (action.causes || [])[0];
          if (milestoneId) {
            const folder = findMilestoneFolder(planningDir, milestoneId);
            if (folder) {
              const aNum = id.replace(/^A-/, '');
              artifactPath = path.join(folder, `A-${aNum}-EXEC-PLAN.md`);
              if (!fs.existsSync(artifactPath)) {
                artifactPath = path.join(folder, 'PLAN.md');
              }
            }
          }
        }
      }
    }

    if (!artifactPath || !fs.existsSync(artifactPath)) {
      sendJson(res, 404, { error: 'Artifact not found for node ' + id });
      return;
    }

    const current = fs.readFileSync(artifactPath, 'utf-8');

    // Read revisionRound from annotations
    const annData = readAnnotations(cwd, id);
    const revisionRound = annData.revisionRound || 0;

    // Read previous version: .vN.md where N = revisionRound - 1
    // The revision-runner versions files as artifact.v{round}.md before overwriting,
    // where round is the round at the time of revision (before incrementing).
    // So the previous version (before the latest revision) is at .v{revisionRound - 1}.md
    // But actually: the runner copies to .v{round} where round is the round BEFORE incrementing.
    // After revision round 1 completes, revisionRound becomes 1, and the file saved was .v0.md.
    // So to get the version before the latest revision, we want .v{revisionRound - 1}.md
    let previous = null;
    if (revisionRound >= 1) {
      const prevRound = revisionRound - 1;
      const prevPath = artifactPath.replace('.md', '') + '.v' + prevRound + '.md';
      if (fs.existsSync(prevPath)) {
        previous = fs.readFileSync(prevPath, 'utf-8');
      }
    }

    sendJson(res, 200, { current, previous, revisionRound });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/node/:id/revise
 * Triggers a revision subprocess that sends open annotations to Claude CLI
 * for plan revision. Versions current artifact and overwrites on success.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} cwd
 * @param {string} nodeId
 */
async function handleRevise(req, res, cwd, nodeId) {
  try {
    const id = nodeId.toUpperCase();
    const prefix = id.split('-')[0];
    const planningDir = path.join(cwd, '.planning');

    // Determine artifact path based on node type
    let artifactPath = null;
    if (prefix === 'D') {
      artifactPath = path.join(planningDir, 'FUTURE.md');
    } else if (prefix === 'M') {
      const folder = findMilestoneFolder(planningDir, id);
      if (folder) artifactPath = path.join(folder, 'PLAN.md');
    } else if (prefix === 'A') {
      // Find the milestone this action belongs to
      const graph = runLoadGraph(cwd);
      if (!('error' in graph)) {
        const action = graph.actions.find(a => a.id.toUpperCase() === id);
        if (action) {
          const milestoneId = (action.causes || [])[0];
          if (milestoneId) {
            const folder = findMilestoneFolder(planningDir, milestoneId);
            if (folder) {
              const aNum = id.replace(/^A-/, '');
              artifactPath = path.join(folder, `A-${aNum}-EXEC-PLAN.md`);
              // If exec-plan doesn't exist, try PLAN.md as fallback
              if (!fs.existsSync(artifactPath)) {
                artifactPath = path.join(folder, 'PLAN.md');
              }
            }
          }
        }
      }
    }

    if (!artifactPath || !fs.existsSync(artifactPath)) {
      sendJson(res, 404, { error: 'Artifact not found for node ' + id });
      return;
    }

    const artifactContent = fs.readFileSync(artifactPath, 'utf-8');

    // Read open annotations
    const annData = readAnnotations(cwd, id);
    const annotations = annData.annotations || [];

    if (annotations.length === 0) {
      sendJson(res, 400, { error: 'no_annotations' });
      return;
    }

    const rr = getRevisionRunner(cwd);
    const result = rr.revise(id, artifactPath, artifactContent, annotations);
    if (result.error) {
      sendJson(res, result.status || 500, { error: result.error });
      return;
    }

    sendJson(res, 202, { ok: true, sessionId: result.sessionId });
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}

/**
 * Handle POST /api/revise/stop
 * Stops the running revision process.
 *
 * @param {http.ServerResponse} res
 * @param {string} cwd
 */
function handleReviseStop(res, cwd) {
  const rr = getRevisionRunner(cwd);
  const result = rr.stop();
  if (result.error) {
    sendJson(res, result.status || 500, { error: result.error });
  } else {
    sendJson(res, 200, { ok: true });
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (method !== 'GET' && method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Declaration CRUD routes (POST, PUT, DELETE)
  if (method === 'POST' && urlPath === '/api/declarations') {
    readJsonBody(req).then(body => {
      if (!body.title || !body.statement) {
        sendJson(res, 400, { error: 'Missing required fields: title and statement' });
        return;
      }
      const result = runAddDeclaration(cwd, ['--title', body.title, '--statement', body.statement]);
      if ('error' in result) {
        sendJson(res, 400, result);
        return;
      }
      sendJson(res, 201, result);
      broadcastChange();
    }).catch(err => sendJson(res, 400, { error: String(err) }));
    return;
  }

  // PUT /api/declarations/:id/ref -- set or update ref field
  const declRefPutMatch = method === 'PUT' && urlPath.match(/^\/api\/declarations\/([^/]+)\/ref$/);
  if (declRefPutMatch) {
    readJsonBody(req).then(body => {
      const declId = declRefPutMatch[1].toUpperCase();
      const planningDir = path.join(cwd, '.planning');
      const futurePath = path.join(planningDir, 'FUTURE.md');

      if (!fs.existsSync(futurePath)) {
        sendJson(res, 404, { error: 'FUTURE.md not found' });
        return;
      }

      const futureContent = fs.readFileSync(futurePath, 'utf-8');
      const declarations = parseFutureFile(futureContent);
      const decl = declarations.find(d => d.id === declId);

      if (!decl) {
        sendJson(res, 404, { error: `Declaration not found: ${declId}` });
        return;
      }

      // Update ref field
      const ref = {};
      if (body.url != null) ref.url = body.url || undefined;
      if (body.path != null) ref.path = body.path || undefined;
      decl.ref = (ref.url || ref.path) ? ref : undefined;

      // Extract project name from header
      const headerMatch = futureContent.match(/^# Future: (.+)/m);
      const projectName = headerMatch ? headerMatch[1].trim() : 'Project';

      const content = writeFutureFile(declarations, projectName);
      fs.writeFileSync(futurePath, content, 'utf-8');

      sendJson(res, 200, { id: declId, ref: decl.ref || null });
      broadcastChange();
    }).catch(err => sendJson(res, 400, { error: String(err) }));
    return;
  }

  // GET /api/node/:id/annotations
  const getAnnotationsMatch = method === 'GET' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations$/);
  if (getAnnotationsMatch) {
    handleGetAnnotations(res, cwd, getAnnotationsMatch[1]);
    return;
  }

  // GET /api/node/:id/revisions
  const getRevisionsMatch = method === 'GET' && urlPath.match(/^\/api\/node\/([^/]+)\/revisions$/);
  if (getRevisionsMatch) {
    handleGetRevisions(res, cwd, getRevisionsMatch[1]);
    return;
  }

  // POST /api/node/:id/annotations/increment-round
  const incrementRoundMatch = method === 'POST' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations\/increment-round$/);
  if (incrementRoundMatch) {
    handleIncrementRevisionRound(res, cwd, incrementRoundMatch[1]);
    return;
  }

  // POST /api/node/:id/annotations
  const postAnnotationsMatch = method === 'POST' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations$/);
  if (postAnnotationsMatch) {
    handleAddAnnotation(req, res, cwd, postAnnotationsMatch[1]);
    return;
  }

  // DELETE /api/node/:id/annotations/:annotationId
  const deleteAnnotationMatch = method === 'DELETE' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations\/([^/]+)$/);
  if (deleteAnnotationMatch) {
    handleDeleteAnnotation(res, cwd, deleteAnnotationMatch[1], deleteAnnotationMatch[2]);
    return;
  }

  // PUT /api/node/:id/review-state — update review state on any node
  const reviewStateMatch = method === 'PUT' && urlPath.match(/^\/api\/node\/([^/]+)\/review-state$/);
  if (reviewStateMatch) {
    handleUpdateReviewState(req, res, cwd, reviewStateMatch[1]);
    return;
  }

  const declPutMatch = method === 'PUT' && urlPath.match(/^\/api\/declarations\/([^/]+)$/);
  if (declPutMatch) {
    readJsonBody(req).then(body => {
      const args = ['--id', declPutMatch[1]];
      if (body.title) { args.push('--title', body.title); }
      if (body.statement) { args.push('--statement', body.statement); }
      if (body.status) { args.push('--status', body.status); }
      if (!body.title && !body.statement && !body.status) {
        sendJson(res, 400, { error: 'At least one of title, statement, or status must be provided' });
        return;
      }
      const result = runUpdateDeclaration(cwd, args);
      if ('error' in result) {
        const status = result.error.includes('not found') ? 404 : 400;
        sendJson(res, status, result);
        return;
      }
      sendJson(res, 200, result);
      broadcastChange();
    }).catch(err => sendJson(res, 400, { error: String(err) }));
    return;
  }

  // PUT /api/milestones/:id/classify — toggle milestone classification (agent/human)
  const classifyMatch = method === 'PUT' && urlPath.match(/^\/api\/milestones\/([^/]+)\/classify$/);
  if (classifyMatch) {
    readJsonBody(req).then(body => {
      const milestoneId = classifyMatch[1].toUpperCase();
      const newClassification = body.classification === 'human' ? 'human' : 'agent';
      try {
        const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
        if (!fs.existsSync(milestonesPath)) {
          sendJson(res, 404, { error: 'MILESTONES.md not found' });
          return;
        }
        const { parseMilestonesFile: parseMF, writeMilestonesFile: writeMF } = require('../artifacts/milestones');
        const content = fs.readFileSync(milestonesPath, 'utf-8');
        const { milestones: allM } = parseMF(content);
        const target = allM.find(m => m.id.toUpperCase() === milestoneId);
        if (!target) {
          sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
          return;
        }
        target.classification = newClassification;
        const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
        const pName = nameMatch ? nameMatch[1].trim() : 'Project';
        fs.writeFileSync(milestonesPath, writeMF(allM, pName));
        sendJson(res, 200, { ok: true, id: target.id, classification: newClassification });
        broadcastChange();
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }).catch(err => sendJson(res, 400, { error: String(err) }));
    return;
  }

  // PUT /api/milestones/:id/depends-on — set milestone dependencies
  const depsMatch = method === 'PUT' && urlPath.match(/^\/api\/milestones\/([^/]+)\/depends-on$/);
  if (depsMatch) {
    readJsonBody(req).then(body => {
      const milestoneId = depsMatch[1].toUpperCase();
      const deps = Array.isArray(body.dependsOn) ? body.dependsOn.map(d => d.toUpperCase()) : [];
      try {
        const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
        if (!fs.existsSync(milestonesPath)) {
          sendJson(res, 404, { error: 'MILESTONES.md not found' });
          return;
        }
        const { parseMilestonesFile: parseMF, writeMilestonesFile: writeMF } = require('../artifacts/milestones');
        const content = fs.readFileSync(milestonesPath, 'utf-8');
        const { milestones: allM } = parseMF(content);
        const target = allM.find(m => m.id.toUpperCase() === milestoneId);
        if (!target) {
          sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
          return;
        }
        for (const depId of deps) {
          if (!allM.find(m => m.id.toUpperCase() === depId)) {
            sendJson(res, 400, { error: `Dependency '${depId}' not found` });
            return;
          }
        }
        if (deps.includes(milestoneId)) {
          sendJson(res, 400, { error: 'Cannot depend on self' });
          return;
        }
        target.dependsOn = deps;
        const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
        const pName = nameMatch ? nameMatch[1].trim() : 'Project';
        fs.writeFileSync(milestonesPath, writeMF(allM, pName));
        sendJson(res, 200, { ok: true, id: target.id, dependsOn: deps });
        broadcastChange();
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }).catch(err => sendJson(res, 400, { error: String(err) }));
    return;
  }

  const declDeleteMatch = method === 'DELETE' && urlPath.match(/^\/api\/declarations\/([^/]+)$/);
  if (declDeleteMatch) {
    const result = runDeleteDeclaration(cwd, ['--id', declDeleteMatch[1]]);
    if ('error' in result) {
      const status = result.error.includes('not found') ? 404 : 400;
      sendJson(res, status, result);
      return;
    }
    sendJson(res, 200, result);
    broadcastChange();
    return;
  }

  // POST routes — action execution
  if (method === 'POST') {
    const executeMatch = urlPath.match(/^\/api\/action\/([^/]+)\/execute$/);
    if (executeMatch) {
      handleExecuteAction(res, cwd, executeMatch[1]);
      return;
    }

    const stopMatch = urlPath.match(/^\/api\/action\/([^/]+)\/stop$/);
    if (stopMatch) {
      const pm = getProcessManager(cwd);
      const result = pm.stop(stopMatch[1]);
      if (result.error) {
        sendJson(res, result.status || 500, { error: result.error });
      } else {
        sendJson(res, 200, { ok: true });
      }
      return;
    }

    if (urlPath === '/api/milestones/derive') {
      handleDerive(req, res, cwd);
      return;
    }
    if (urlPath === '/api/milestones/derive/stop') {
      handleDeriveStop(res, cwd);
      return;
    }
    if (urlPath === '/api/milestones/derive/accept') {
      handleDeriveAccept(req, res, cwd);
      return;
    }

    // Action derivation routes: POST /api/milestones/:id/actions/derive[/stop|/accept]
    const actionDeriveMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive$/);
    if (actionDeriveMatch) {
      handleActionDerive(res, cwd, actionDeriveMatch[1]);
      return;
    }

    const actionDeriveStopMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive\/stop$/);
    if (actionDeriveStopMatch) {
      handleActionDeriveStop(res, cwd);
      return;
    }

    const actionDeriveAcceptMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive\/accept$/);
    if (actionDeriveAcceptMatch) {
      handleActionDeriveAccept(req, res, cwd, actionDeriveAcceptMatch[1]);
      return;
    }

    // Play routes: POST /api/play, POST /api/play/stop
    if (urlPath === '/api/play') {
      const pr = getPlayRunner(cwd);
      const result = pr.start();
      if (result.error) {
        const status = result.unapproved ? 403 : 409;
        sendJson(res, status, { error: result.error, ...(result.unapproved && { unapproved: result.unapproved }) });
      } else {
        sendJson(res, 202, { ok: true, waves: result.waves });
      }
      return;
    }

    if (urlPath === '/api/play/stop') {
      const pr = getPlayRunner(cwd);
      const result = pr.stop();
      if (result.error) {
        sendJson(res, 400, { error: result.error });
      } else {
        sendJson(res, 200, { ok: true });
      }
      return;
    }

    // Revision routes: POST /api/node/:id/revise, POST /api/revise/stop
    const reviseMatch = urlPath.match(/^\/api\/node\/([^/]+)\/revise$/);
    if (reviseMatch) {
      handleRevise(req, res, cwd, reviseMatch[1]);
      return;
    }

    if (urlPath === '/api/revise/stop') {
      handleReviseStop(res, cwd);
      return;
    }

    sendJson(res, 404, { error: `Route not found: ${urlPath}` });
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

  const workabilityMatch = urlPath.match(/^\/api\/workability\/([^/]+)$/);
  if (workabilityMatch) {
    handleWorkability(res, cwd, workabilityMatch[1]);
    return;
  }

  const milestoneLogMatch = urlPath.match(/^\/api\/milestone\/([^/]+)\/log$/);
  if (milestoneLogMatch) {
    handleMilestoneLog(res, cwd, milestoneLogMatch[1]);
    return;
  }

  const milestoneMatch = urlPath.match(/^\/api\/milestone\/([^/]+)$/);
  if (milestoneMatch) {
    handleMilestone(res, cwd, milestoneMatch[1]);
    return;
  }

  if (urlPath === '/api/running') {
    const pm = getProcessManager(cwd);
    sendJson(res, 200, { running: pm.running() });
    return;
  }

  if (urlPath === '/api/play/status') {
    const pr = getPlayRunner(cwd);
    sendJson(res, 200, { running: pr.running(), status: pr.status() });
    return;
  }

  if (urlPath === '/api/derivation/running') {
    const dr = getDerivationRunner(cwd);
    sendJson(res, 200, { running: dr.running() });
    return;
  }

  // GET /api/milestones/:id/actions/derive/running
  const actionDeriveRunningMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive\/running$/);
  if (actionDeriveRunningMatch) {
    const adr = getActionDerivationRunner(cwd);
    sendJson(res, 200, { running: adr.running() });
    return;
  }

  if (urlPath === '/api/workflow/state') {
    handleWorkflowState(res, cwd);
    return;
  }

  if (urlPath === '/api/activity') {
    handleActivity(res, cwd);
    return;
  }

  if (urlPath === '/api/readiness') {
    handleReadiness(res, cwd);
    return;
  }

  if (urlPath === '/api/files') {
    handleFileContent(req, res, cwd);
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
/**
 * Find the next available TCP port starting from `startPort`.
 * @param {number} startPort
 * @returns {Promise<number>}
 */
function findFreePort(startPort) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(startPort, '127.0.0.1', () => {
      const { port } = /** @type {import('net').AddressInfo} */ (probe.address());
      probe.close(() => resolve(port));
    });
    probe.on('error', () => resolve(findFreePort(startPort + 1)));
  });
}

/**
 * Start the Declare local web server.
 * Automatically finds a free port if the preferred port is in use.
 *
 * @param {string} cwd - Project root (working directory)
 * @param {number} [port] - Preferred port (default: 3847 or PORT env var)
 * @returns {Promise<{ server: import('http').Server, port: number, url: string }>}
 */
async function startServer(cwd, port) {
  const preferredPort = port || parseInt(process.env.PORT || '', 10) || 3847;
  const resolvedPort = await findFreePort(preferredPort);

  const server = createServer(cwd, resolvedPort);

  await new Promise((resolve) => {
    server.listen(resolvedPort, '127.0.0.1', () => {
      watchPlanning(cwd);
      resolve(undefined);
    });
  });

  const url = `http://localhost:${resolvedPort}`;
  return { server, port: resolvedPort, url };
}

module.exports = { createServer, startServer };
