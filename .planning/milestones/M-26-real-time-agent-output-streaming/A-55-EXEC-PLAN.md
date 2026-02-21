---
milestone: M-26-real-time-agent-output-streaming
action: A-55
type: execute
wave: 2
depends_on:
  - A-54
files_modified:
  - src/server/index.js
autonomous: true
declarations:
  - D-08
user_setup: []

must_haves:
  truths:
    - "GET /api/stream returns an SSE connection that stays open"
    - "When an agent run emits output, all connected /api/stream clients receive it"
    - "SSE events have the format: data: {actionId, chunk, type, timestamp}"
    - "Multiple concurrent agent runs multiplex on the same /api/stream endpoint"
    - "Clients that disconnect are cleaned up without errors"
  artifacts:
    - path: "src/server/index.js"
      provides: "SSE /api/stream route + AgentRunner singleton + POST /api/agent/run trigger"
      contains: "/api/stream"
  key_links:
    - from: "src/server/index.js"
      to: "src/server/agent-runner.js"
      via: "require and singleton instance"
      pattern: "require\\('./agent-runner'\\)"
    - from: "AgentRunner output event"
      to: "SSE stream clients"
      via: "runner.on('output') -> write to all streamClients"
      pattern: "runner\\.on\\('output'"
---

<objective>
Add an SSE streaming endpoint `GET /api/stream` to the existing HTTP server that multiplexes real-time agent subprocess output to all connected browser clients. Also add a `POST /api/agent/run` endpoint to trigger agent runs from the UI.

Purpose: Connects the subprocess runner (A-54) to the browser — any agent output is immediately visible to all connected dashboards.
Output: Updated `src/server/index.js` with /api/stream and /api/agent/run routes.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/index.js
@.planning/milestones/M-26-real-time-agent-output-streaming/A-54-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add SSE /api/stream endpoint and agent run trigger</name>
  <files>src/server/index.js</files>
  <action>
Modify `src/server/index.js` to add two new capabilities:

**1. Import AgentRunner and create singleton:**
At the top of the file (after existing requires), add:
```js
const { AgentRunner } = require('./agent-runner');
```

Create a module-level singleton:
```js
/** @type {AgentRunner | null} */
let agentRunner = null;

function getRunner() {
  if (!agentRunner) {
    agentRunner = new AgentRunner();
    agentRunner.on('output', (event) => broadcastStream(event));
  }
  return agentRunner;
}
```

**2. SSE stream client management:**
Add a new `Set` for stream clients (separate from existing `sseClients` which is for file-change events):
```js
/** @type {Set<http.ServerResponse>} Active /api/stream SSE clients */
const streamClients = new Set();

function broadcastStream(event) {
  const data = JSON.stringify(event);
  for (const client of streamClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (_) {
      streamClients.delete(client);
    }
  }
}
```

**3. Route: GET /api/stream**
In the `route()` function, add BEFORE the static file routes:
```js
if (urlPath === '/api/stream') {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('retry: 3000\n\n');
  streamClients.add(res);
  req.on('close', () => streamClients.delete(res));
  // Send current active runs as initial state
  const runner = getRunner();
  const active = runner.activeRuns();
  if (active.length > 0) {
    res.write(`data: ${JSON.stringify({ type: 'active_runs', runs: active })}\n\n`);
  }
  return;
}
```

**4. Route: POST /api/agent/run**
Add support for POST method in the route function. Currently the router rejects all non-GET methods with 405. Change the method check to allow POST for specific routes:
- Remove the blanket `if (method !== 'GET')` rejection
- Instead, check method per-route or allow GET and POST

Add the POST handler:
```js
if (method === 'POST' && urlPath === '/api/agent/run') {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { actionId, command, args, maxTokens, cwd: runCwd } = JSON.parse(body);
      if (!actionId || !command) {
        sendJson(res, 400, { error: 'actionId and command are required' });
        return;
      }
      const runner = getRunner();
      if (runner.isRunning(actionId)) {
        sendJson(res, 409, { error: `Action ${actionId} is already running` });
        return;
      }
      runner.run(actionId, command, args || [], {
        maxTokens: maxTokens || 100000,
        cwd: runCwd || cwd,
      });
      sendJson(res, 200, { started: true, actionId });
    } catch (err) {
      sendJson(res, 400, { error: String(err) });
    }
  });
  return;
}
```

**5. Route: GET /api/agent/status**
Add a simple status endpoint:
```js
if (urlPath === '/api/agent/status') {
  const runner = getRunner();
  sendJson(res, 200, { activeRuns: runner.activeRuns() });
  return;
}
```

**6. Route: POST /api/agent/kill**
```js
if (method === 'POST' && urlPath === '/api/agent/kill') {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { actionId } = JSON.parse(body);
      const runner = getRunner();
      const killed = runner.kill(actionId);
      sendJson(res, 200, { killed, actionId });
    } catch (err) {
      sendJson(res, 400, { error: String(err) });
    }
  });
  return;
}
```

**Method routing update:** Change the method gate to reject non-GET/POST:
```js
if (method !== 'GET' && method !== 'POST') {
  sendJson(res, 405, { error: 'Method Not Allowed' });
  return;
}
```

And add a catch-all for POST to non-POST routes:
After all POST routes but before GET-only routes, add:
```js
if (method === 'POST') {
  sendJson(res, 404, { error: `No POST handler for: ${urlPath}` });
  return;
}
```

**Export the runner getter** — add `getRunner` to module.exports so other modules can access it:
```js
module.exports = { createServer, startServer, getRunner };
```
  </action>
  <verify>
1. Start the server: `node -e "const {startServer} = require('./src/server/index.js'); startServer(process.cwd()).then(({url}) => console.log('UP', url));"` — should start without errors.
2. In another terminal, `curl -N http://localhost:3847/api/stream` — should hang open (SSE connection).
3. `curl http://localhost:3847/api/agent/status` — should return `{"activeRuns":[]}`.
4. `curl -X POST http://localhost:3847/api/agent/run -d '{"actionId":"test-1","command":"echo","args":["hello"]}'` — should return `{"started":true,"actionId":"test-1"}` and the SSE stream should show stdout + done events.
  </verify>
  <done>GET /api/stream serves SSE multiplexing agent output. POST /api/agent/run triggers subprocess runs. POST /api/agent/kill stops runs. GET /api/agent/status reports active runs. All routes integrated into existing server without breaking existing functionality.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild CJS bundle</name>
  <files>dist/declare-tools.cjs</files>
  <action>
Run `node esbuild.config.js` from the project root to rebuild the CJS bundle so `dist/declare-tools.cjs` includes the updated server with agent-runner integration.

After rebuilding, verify the bundle loads:
```
node -e "require('./dist/declare-tools.cjs')"
```

Also copy the updated public files if the build script does that, or verify `dist/public/` is up to date. Check the esbuild config first to understand what it bundles.
  </action>
  <verify>`node esbuild.config.js` exits with code 0. `node -e "require('./dist/declare-tools.cjs')"` exits cleanly.</verify>
  <done>CJS bundle rebuilt with agent-runner module included. Server can be started from the bundle.</done>
</task>

</tasks>

<verification>
- Server starts without errors
- `GET /api/stream` opens an SSE connection
- `POST /api/agent/run` spawns a subprocess and streams output to /api/stream
- `GET /api/agent/status` returns active runs list
- `POST /api/agent/kill` terminates a running process
- Existing routes (/api/graph, /api/status, /events, etc.) still work
- CJS bundle rebuilt and loadable
</verification>

<success_criteria>
The server has a working `/api/stream` SSE endpoint that broadcasts agent subprocess output in real-time, with trigger/kill/status endpoints for managing runs. All existing server functionality preserved. Bundle rebuilt.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-26-real-time-agent-output-streaming/A-55-SUMMARY.md`
</output>
