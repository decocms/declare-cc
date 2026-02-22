// @ts-check
'use strict';

/**
 * Full-cycle E2E test: exercises the complete D-M-A lifecycle through the HTTP API.
 *
 * Simulates a user building a simple "to-do list app" project:
 *   1. Init a fresh project in a temp directory
 *   2. Create declarations via POST /api/declarations
 *   3. Accept milestones via POST /api/milestones/derive/accept
 *   4. Accept actions via POST /api/milestones/:id/actions/derive/accept
 *   5. Verify graph state, workflow progression, and readiness at each step
 *   6. Verify milestone detail endpoint
 *   7. Clean up
 *
 * Run: node --test src/server/e2e-cycle.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { execSync } = require('node:child_process');

/** @type {import('node:http').Server | null} */
let server = null;
let baseUrl = '';
let tmpDir = '';

// ── HTTP helpers ──────────────────────────────────────────────────────

/**
 * @param {string} url
 * @returns {Promise<{ status: number, body: string }>}
 */
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * @param {string} url
 * @param {unknown} data
 * @param {string} [method]
 * @returns {Promise<{ status: number, body: string }>}
 */
function request(url, data, method = 'POST') {
  const payload = JSON.stringify(data);
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/** Parse JSON body, throw if malformed */
function json(res) {
  return JSON.parse(res.body);
}

// ── Setup / teardown ──────────────────────────────────────────────────

describe('Full-cycle E2E: to-do list app', () => {
  before(async () => {
    // Create a temp directory and init a git repo + declare project
    tmpDir = mkdtempSync(join(tmpdir(), 'declare-e2e-'));
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "E2E Test"', { cwd: tmpDir, stdio: 'ignore' });

    // Initialize the declare project
    const { runInit } = require('../commands/init');
    runInit(tmpDir, ['todo-list-app']);

    // Start the server against the temp project
    const { startServer } = require('./index');
    const result = await startServer(tmpDir, 0);
    server = result.server;
    baseUrl = `http://127.0.0.1:${result.port}`;
  });

  after(() => {
    if (server) server.close();
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
  });

  // ── Step 1: Empty project state ───────────────────────────────────

  it('starts with an empty graph', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.declarations.length, 0, 'No declarations yet');
    assert.equal(data.milestones.length, 0, 'No milestones yet');
    assert.equal(data.actions.length, 0, 'No actions yet');
  });

  it('workflow state is empty when no declarations', async () => {
    const res = await get(`${baseUrl}/api/workflow/state`);
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.state, 'empty', 'Should start in empty state');
  });

  // ── Step 2: Create declarations ───────────────────────────────────

  /** @type {string} */
  let declId1 = '';
  /** @type {string} */
  let declId2 = '';

  it('creates first declaration: task CRUD', async () => {
    const res = await request(`${baseUrl}/api/declarations`, {
      title: 'Task CRUD',
      statement: 'Users can create, read, update, and delete to-do items with a title and completion status.',
    });
    assert.equal(res.status, 201);
    const data = json(res);
    assert.ok(data.id, 'Should return an ID');
    assert.equal(data.title, 'Task CRUD');
    declId1 = data.id;
  });

  it('creates second declaration: persistence', async () => {
    const res = await request(`${baseUrl}/api/declarations`, {
      title: 'Data Persistence',
      statement: 'To-do items persist across app restarts using a local JSON file store.',
    });
    assert.equal(res.status, 201);
    const data = json(res);
    declId2 = data.id;
  });

  it('graph now has 2 declarations', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    const data = json(res);
    assert.equal(data.declarations.length, 2);
    assert.equal(data.milestones.length, 0);
  });

  it('workflow state is declarations_only after adding declarations', async () => {
    const res = await get(`${baseUrl}/api/workflow/state`);
    const data = json(res);
    assert.equal(data.state, 'declarations_only', 'Should be declarations_only');
  });

  // ── Step 3: Accept milestones ─────────────────────────────────────

  /** @type {string} */
  let msId1 = '';
  /** @type {string} */
  let msId2 = '';
  /** @type {string} */
  let msId3 = '';

  it('accepts 3 milestones (simulating derivation output)', async () => {
    const res = await request(`${baseUrl}/api/milestones/derive/accept`, {
      milestones: [
        { title: 'Implement task model and in-memory store', realizes: declId1 },
        { title: 'Build CLI interface for CRUD operations', realizes: declId1 },
        { title: 'Add JSON file persistence layer', realizes: declId2 },
      ],
    });
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.milestones.length, 3, 'Should create 3 milestones');
    msId1 = data.milestones[0].id;
    msId2 = data.milestones[1].id;
    msId3 = data.milestones[2].id;
  });

  it('graph now has 2 declarations and 3 milestones', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    const data = json(res);
    assert.equal(data.declarations.length, 2);
    assert.equal(data.milestones.length, 3);

    // Check realization links
    const ms1 = data.milestones.find(m => m.id === msId1);
    assert.ok(ms1, 'Milestone 1 should exist');
    assert.ok(ms1.realizes.includes(declId1), `${msId1} should realize ${declId1}`);
  });

  it('workflow state is milestones_pending (milestones have no actions yet)', async () => {
    const res = await get(`${baseUrl}/api/workflow/state`);
    const data = json(res);
    assert.equal(data.state, 'milestones_pending', 'Should be milestones_pending');
  });

  it('milestone detail endpoint works', async () => {
    const res = await get(`${baseUrl}/api/milestone/${msId1}`);
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.milestone.id, msId1);
    assert.equal(data.actions.length, 0, 'No actions yet for this milestone');
  });

  // ── Step 4: Set milestone dependencies ────────────────────────────

  it('sets dependency: milestone 2 depends on milestone 1', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId2}/depends-on`,
      { dependsOn: [msId1] },
      'PUT'
    );
    assert.equal(res.status, 200);
    const data = json(res);
    assert.ok(data.ok);
    assert.deepEqual(data.dependsOn, [msId1]);
  });

  it('sets dependency: milestone 3 depends on milestone 1', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId3}/depends-on`,
      { dependsOn: [msId1] },
      'PUT'
    );
    assert.equal(res.status, 200);
  });

  it('readiness reflects dependencies', async () => {
    const res = await get(`${baseUrl}/api/readiness`);
    assert.equal(res.status, 200);
    const data = json(res);
    // Readiness returns objects with { state, blockedBy, progress }
    // msId1 has no deps — state should be 'no-actions' (no actions defined yet)
    assert.ok(data[msId1], `${msId1} should have readiness data`);
    assert.equal(data[msId1].blockedBy.length, 0, `${msId1} should not be blocked`);
    // msId2/msId3 depend on msId1 — they should show blockers
    assert.ok(data[msId2].blockedBy.length > 0, `${msId2} should be blocked`);
    assert.ok(data[msId3].blockedBy.length > 0, `${msId3} should be blocked`);
  });

  // ── Step 5: Classify milestones ───────────────────────────────────

  it('classifies milestone 1 as agent-time', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId1}/classify`,
      { classification: 'agent' },
      'PUT'
    );
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.classification, 'agent');
  });

  // ── Step 6: Accept actions for milestone 1 ────────────────────────

  /** @type {string[]} */
  let actionIds = [];

  it('accepts actions for milestone 1', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId1}/actions/derive/accept`,
      {
        actions: [
          { title: 'Create Task class with id, title, done fields', produces: 'src/task.js' },
          { title: 'Create TaskStore with add/get/update/delete/list methods', produces: 'src/store.js' },
          { title: 'Write unit tests for Task and TaskStore', produces: 'src/store.test.js' },
        ],
      }
    );
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.actions.length, 3, 'Should create 3 actions');
    actionIds = data.actions.map(a => a.id);
  });

  it('graph now includes actions linked to milestone', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    const data = json(res);
    assert.equal(data.actions.length, 3, 'Should have 3 actions');

    // All actions should be linked to milestone 1
    for (const action of data.actions) {
      assert.ok(
        action.causes.map(c => c.toUpperCase()).includes(msId1.toUpperCase()),
        `Action ${action.id} should be caused by ${msId1}`
      );
    }
  });

  it('milestone detail now shows its actions', async () => {
    const res = await get(`${baseUrl}/api/milestone/${msId1}`);
    const data = json(res);
    assert.equal(data.actions.length, 3, 'Milestone 1 should now have 3 actions');
  });

  // ── Step 7: Accept actions for remaining milestones ───────────────

  it('accepts actions for milestone 2', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId2}/actions/derive/accept`,
      {
        actions: [
          { title: 'Build CLI add/list/done/delete commands', produces: 'src/cli.js' },
          { title: 'Wire CLI to TaskStore', produces: 'src/index.js' },
        ],
      }
    );
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.actions.length, 2);
  });

  it('accepts actions for milestone 3', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId3}/actions/derive/accept`,
      {
        actions: [
          { title: 'Implement JSON file read/write', produces: 'src/persistence.js' },
          { title: 'Integrate persistence into TaskStore', produces: 'src/store.js (modified)' },
        ],
      }
    );
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.actions.length, 2);
  });

  // ── Step 8: Verify complete graph ─────────────────────────────────

  it('final graph has correct node counts', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    const data = json(res);
    assert.equal(data.declarations.length, 2, '2 declarations');
    assert.equal(data.milestones.length, 3, '3 milestones');
    assert.equal(data.actions.length, 7, '7 total actions (3 + 2 + 2)');
  });

  it('workflow state is actions_pending (all milestones have actions, none executed)', async () => {
    const res = await get(`${baseUrl}/api/workflow/state`);
    const data = json(res);
    assert.equal(data.state, 'actions_pending', 'Should transition to actions_pending');
  });

  // ── Step 9: Verify status endpoint ────────────────────────────────

  it('status endpoint returns health info', async () => {
    const res = await get(`${baseUrl}/api/status`);
    assert.equal(res.status, 200);
    const data = json(res);
    assert.ok(data.health || data.declarations || data.graph, 'Should have health or graph info');
  });

  // ── Step 10: Update a declaration ─────────────────────────────────

  it('updates declaration title via PUT', async () => {
    const res = await request(
      `${baseUrl}/api/declarations/${declId1}`,
      { title: 'Task CRUD Operations' },
      'PUT'
    );
    assert.equal(res.status, 200);
    const data = json(res);
    assert.ok(!data.error, 'Should not have an error');
  });

  it('graph reflects the updated declaration title', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    const data = json(res);
    const decl = data.declarations.find(d => d.id === declId1);
    assert.equal(decl.title, 'Task CRUD Operations');
  });

  // ── Step 11: Delete declaration ─────────────────────────────────

  it('refuses to delete declaration with linked milestones', async () => {
    const parsed = new URL(`${baseUrl}/api/declarations/${declId2}`);
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'DELETE',
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.end();
    });
    // Declaration has linked milestones — delete should be refused
    assert.equal(res.status, 400);
    const data = json(res);
    assert.ok(data.error.includes('linked milestones'), 'Should mention linked milestones');
  });

  it('can delete a declaration with no milestones', async () => {
    // Create a temporary declaration with no milestones
    const createRes = await request(`${baseUrl}/api/declarations`, {
      title: 'Temp Declaration',
      statement: 'This will be deleted immediately.',
    });
    assert.equal(createRes.status, 201);
    const tempId = json(createRes).id;

    // Delete it
    const parsed = new URL(`${baseUrl}/api/declarations/${tempId}`);
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'DELETE',
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 200);
    const data = json(res);
    assert.equal(data.deleted, true);
  });

  it('graph still has 2 original declarations', async () => {
    const res = await get(`${baseUrl}/api/graph`);
    const data = json(res);
    assert.equal(data.declarations.length, 2, 'Original 2 declarations remain');
  });

  // ── Step 12: SSE endpoint ─────────────────────────────────────────

  it('SSE /events connects and returns event-stream', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}/events`, (res) => {
        resolve({ status: res.statusCode, headers: res.headers });
        req.destroy();
      });
      req.on('error', (err) => {
        if (err.message.includes('aborted') || err.message.includes('destroyed')) return;
        reject(err);
      });
      setTimeout(() => { req.destroy(); reject(new Error('Timeout')); }, 3000);
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/event-stream');
  });

  // ── Step 13: Edge cases ───────────────────────────────────────────

  it('rejects declaration without title', async () => {
    const res = await request(`${baseUrl}/api/declarations`, {
      statement: 'Missing title field',
    });
    assert.equal(res.status, 400);
  });

  it('rejects declaration without statement', async () => {
    const res = await request(`${baseUrl}/api/declarations`, {
      title: 'Missing statement',
    });
    assert.equal(res.status, 400);
  });

  it('returns 404 for non-existent milestone', async () => {
    const res = await get(`${baseUrl}/api/milestone/M-99`);
    assert.equal(res.status, 404);
  });

  it('rejects self-dependency on milestone', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId1}/depends-on`,
      { dependsOn: [msId1] },
      'PUT'
    );
    assert.equal(res.status, 400);
    const data = json(res);
    assert.ok(data.error.includes('self'), 'Should reject self-dependency');
  });

  it('rejects accept with empty milestones array', async () => {
    const res = await request(`${baseUrl}/api/milestones/derive/accept`, {
      milestones: [],
    });
    assert.equal(res.status, 400);
  });

  it('rejects accept with empty actions array', async () => {
    const res = await request(
      `${baseUrl}/api/milestones/${msId1}/actions/derive/accept`,
      { actions: [] }
    );
    assert.equal(res.status, 400);
  });
});
