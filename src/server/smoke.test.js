// @ts-check
'use strict';

/**
 * E2E smoke tests for the Declare dashboard.
 *
 * Starts the server, fetches key endpoints, and validates:
 * - Server starts and responds
 * - API returns valid JSON
 * - Dashboard HTML loads
 * - app.js has no syntax errors (parsed by V8)
 * - No TDZ / reference errors in top-level code
 *
 * Run: node --test src/server/smoke.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

/** @type {import('node:http').Server | null} */
let server = null;
let baseUrl = '';

/**
 * Simple HTTP GET returning { status, headers, body }.
 * @param {string} url
 * @returns {Promise<{ status: number, headers: http.IncomingHttpHeaders, body: string }>}
 */
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

describe('Dashboard smoke tests', () => {
  before(async () => {
    const { startServer } = require('./index');
    // Use the declare-cc project root (find it by walking up to find package.json with name=declare-cc)
    let cwd = __dirname;
    while (cwd !== '/') {
      try {
        const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
        if (pkg.name === 'declare-cc') break;
      } catch { /* keep walking */ }
      cwd = join(cwd, '..');
    }
    const result = await startServer(cwd, 0); // port 0 = random
    server = result.server;
    baseUrl = `http://127.0.0.1:${result.port}`;
  });

  after(() => {
    if (server) server.close();
  });

  it('serves the dashboard HTML at /', async () => {
    const res = await get(baseUrl + '/');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<!DOCTYPE html>') || res.body.includes('<html'), 'Response should be HTML');
    assert.ok(res.body.includes('app.js'), 'HTML should reference app.js');
  });

  it('serves app.js without 404', async () => {
    const res = await get(baseUrl + '/public/app.js');
    assert.equal(res.status, 200);
    assert.ok(res.body.length > 1000, 'app.js should be substantial');
  });

  it('GET /api/graph returns valid JSON', async () => {
    const res = await get(baseUrl + '/api/graph');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(data.nodes || data.declarations || data.graph, 'Graph should have nodes or declarations');
  });

  it('GET /api/status returns valid JSON', async () => {
    const res = await get(baseUrl + '/api/status');
    assert.equal(res.status, 200);
    JSON.parse(res.body); // should not throw
  });

  it('GET /api/workflow/state returns valid JSON', async () => {
    const res = await get(baseUrl + '/api/workflow/state');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body);
    assert.ok(data.state, 'Should have a state field');
  });

  it('GET /api/readiness returns valid JSON', async () => {
    const res = await get(baseUrl + '/api/readiness');
    assert.equal(res.status, 200);
    JSON.parse(res.body); // should not throw
  });

  it('app.js has no syntax errors', () => {
    const appJs = readFileSync(join(__dirname, 'public', 'app.js'), 'utf-8');
    // vm.compileFunction will throw SyntaxError if invalid
    assert.doesNotThrow(() => {
      new vm.Script(appJs, { filename: 'app.js' });
    }, 'app.js should parse without syntax errors');
  });

  it('app.js top-level const/let have no TDZ issues', () => {
    const appJs = readFileSync(join(__dirname, 'public', 'app.js'), 'utf-8');
    const lines = appJs.split('\n');

    // Map: variable name -> declaration line number
    const declaredAt = new Map();
    lines.forEach((line, i) => {
      const m = line.match(/^(?:const|let)\s+(\$\w+)\s*=/);
      if (m) declaredAt.set(m[1], i);
    });

    const issues = [];
    lines.forEach((line, i) => {
      // Skip lines that ARE the declaration
      if (/^(?:const|let)\s+\$\w+\s*=/.test(line)) return;
      // Skip lines inside function bodies (rough heuristic: indented)
      if (/^\s{2,}/.test(line)) return;
      // Check for top-level references to $ variables
      const refs = [...line.matchAll(/(\$\w+)/g)];
      for (const ref of refs) {
        const name = ref[1];
        if (declaredAt.has(name) && i < declaredAt.get(name)) {
          issues.push(`${name} used at line ${i + 1}, declared at line ${declaredAt.get(name) + 1}`);
        }
      }
    });

    assert.equal(issues.length, 0, 'No TDZ issues:\n' + issues.join('\n'));
  });

  it('SSE /events endpoint connects', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.get(baseUrl + '/events', (res) => {
        // Just check headers, then abort
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
});
