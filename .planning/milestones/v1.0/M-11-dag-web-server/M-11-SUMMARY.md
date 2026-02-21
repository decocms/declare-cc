---
phase: v2
plan: M-11
subsystem: server
tags: [http-server, json-api, graph, dashboard, zero-deps]
dependency_graph:
  requires: [load-graph, status, compute-performance]
  provides: [json-api, serve-command]
  affects: [dist/declare-tools.cjs]
tech_stack:
  added: [node:http, node:fs, node:path]
  patterns: [CJS-module, zero-runtime-deps, CORS-headers, path-traversal-guard]
key_files:
  created:
    - src/server/index.js
    - src/server/public/  (directory, empty — dashboard files TBD in M-12/M-13)
    - src/commands/serve.js
  modified:
    - src/declare-tools.js  (added serve dispatch + require)
    - dist/declare-tools.cjs  (rebuilt bundle)
decisions:
  - "Zero runtime deps: used node:http, node:fs, node:path exclusively"
  - "Port 3847 chosen as default to avoid conflicts with common ports (3000, 8080, etc.)"
  - "Path traversal guard on /public/* routes using path.resolve + startsWith check"
  - "Server emits startup JSON then keeps process alive via event loop (no explicit block)"
metrics:
  duration: 8min
  completed: 2026-02-17
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase v2 Plan M-11: DAG Web Server Summary

**One-liner:** Node built-in HTTP server exposing the Declare graph as a JSON API with CORS, path-traversal guard, and a `serve` CLI command.

## What Was Built

A local web server that reads the Declare graph on each request and exposes it as a zero-dependency JSON API, enabling the browser-based dashboard milestone (M-13).

### Action A-22: Node HTTP Server (commit c4e6876)

`src/server/index.js` implements a Node `http.createServer` handler with five routes:

| Route | Handler | Description |
|---|---|---|
| `GET /api/graph` | `handleGraph` | Full graph via `runLoadGraph` |
| `GET /api/status` | `handleStatus` | Health + performance via `runStatus` |
| `GET /api/milestone/:id` | `handleMilestone` | Single milestone + its actions |
| `GET /` | `sendFile` | Serves `src/server/public/index.html` |
| `GET /public/*` | `sendFile` | Static files from `src/server/public/` |

CORS preflight (`OPTIONS`) returns 204 with `Access-Control-Allow-Origin: *`. All JSON responses include the same CORS headers for browser fetch compatibility.

Path traversal protection on `/public/*` uses `path.resolve` + `.startsWith(PUBLIC_DIR + path.sep)` to prevent directory escape.

Exports: `createServer(cwd, port)` returns an `http.Server`. `startServer(cwd, port)` calls `listen` and returns `{ server, port, url }`.

### Action A-23: serve CLI Command (commit 7cf5e1c)

`src/commands/serve.js` exports `runServe(cwd, args)`:
- Parses `--port NNNN` (default 3847 or `PORT` env var)
- Calls `startServer` then installs `SIGINT`/`SIGTERM` handlers for clean shutdown
- Returns `{ url, port, pid }` — the dispatch prints this as JSON before the process stays alive

`src/declare-tools.js` updated: added `require('./commands/serve')` and a `case 'serve':` block that calls `runServe` and prints the JSON result, then keeps the process alive via the event loop.

`dist/declare-tools.cjs` rebuilt via `node esbuild.config.js`. Bundle verified to contain both `case "serve"` and `runServe`.

## Deviations from Plan

None — plan executed exactly as written.

The file at `src/declare-tools.js` had grown significantly since the initial plan was written (new commands: `quick-task`, `add-todo`, `check-todos`, `complete-todo`, `config-get`, `config-set`, `health-check`, `complete-milestone`, `record-session`, `get-state`). The `serve` dispatch was added alongside all existing commands, preserving them.

## Verification

```
node -e "
  const { createServer, startServer } = require('./src/server/index');
  console.log('createServer:', typeof createServer);  // function
  console.log('startServer:', typeof startServer);    // function
"

node -e "
  const { runServe } = require('./src/commands/serve');
  console.log('runServe:', typeof runServe);           // function
"

node -e "
  const fs = require('fs');
  const b = fs.readFileSync('./dist/declare-tools.cjs', 'utf-8');
  console.log('serve in bundle:', b.includes('case \"serve\"'));  // true
"
```

All three passed.

## Self-Check: PASSED

- `src/server/index.js` — exists, 272 lines, exports `createServer` + `startServer`
- `src/commands/serve.js` — exists, exports `runServe`
- Commit `c4e6876` — feat(M-11-A22): build Node HTTP server with graph API
- Commit `7cf5e1c` — feat(M-11-A23): add serve CJS command and rebuild bundle
- `dist/declare-tools.cjs` rebuilt, contains `serve` dispatch
