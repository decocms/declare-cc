---
milestone: M-35-default-open-behavior
action: A-73
type: execute
wave: 2
depends_on:
  - A-72
files_modified:
  - src/commands/open.js
  - src/declare-tools.js
  - dist/declare-tools.cjs
autonomous: true
declarations:
  - D-11

must_haves:
  truths:
    - "Running `declare` with no subcommand starts the server (if not already running) and opens the browser"
    - "Running `declare .` behaves identically to `declare` with no arguments"
    - "Running `declare /path/to/project` resolves that absolute path as the project root and opens its dashboard"
    - "Running `declare serve` still works as an explicit foreground server start (no change to existing behaviour)"
    - "The server port is read from `.planning/server.port` if it exists, else defaults to 3847"
    - "If the server is already running on the resolved port, the command opens the browser without starting a second server"
  artifacts:
    - path: "src/commands/open.js"
      provides: "open command — resolves project root, checks/starts server, opens browser"
      exports: ["runOpen"]
    - path: "src/declare-tools.js"
      provides: "CLI dispatcher — routes no-subcommand and '.' and absolute-path invocations to runOpen"
      contains: "runOpen"
    - path: "dist/declare-tools.cjs"
      provides: "Rebuilt bundle including open.js"
  key_links:
    - from: "bin/declare.js"
      to: "src/commands/open.js via declare-tools.cjs"
      via: "require('../dist/declare-tools.cjs') + argv routing"
      pattern: "runOpen|open"
    - from: "src/commands/open.js"
      to: ".planning/server.port"
      via: "fs.readFileSync"
      pattern: "server\\.port"
    - from: "src/commands/open.js"
      to: "http://localhost:{PORT}/api/graph"
      via: "node:http GET to check liveness"
      pattern: "api/graph"
    - from: "src/commands/open.js"
      to: "child_process.spawn nohup"
      via: "background server start when not running"
      pattern: "spawn|nohup|serve"
---

<objective>
Implement the default `declare` invocation: no subcommand (or `.` or an absolute path) opens the dashboard for the resolved project root.

This is the core of D-11: "declare is a global command that opens the dashboard for the current directory — declare and declare . are equivalent."

The logic lives in a new `src/commands/open.js` command module. The CLI dispatcher in `src/declare-tools.js` is updated to route the appropriate invocations to it. Then the bundle is rebuilt.

Purpose: Today `declare` (once installed as a global binary via A-71/A-72) would fall through to the existing help text or an error because there is no handler for the no-subcommand case. This action wires that path.

Output: `src/commands/open.js`, updated `src/declare-tools.js`, rebuilt `dist/declare-tools.cjs`.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/commands/serve.js
@commands/declare/dashboard.md
@src/declare-tools.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/commands/open.js</name>
  <files>src/commands/open.js</files>
  <action>
Create `src/commands/open.js` as a CJS module. It implements the open command:

**Function signature:** `async function runOpen(cwd, args)`
- `cwd`: the project root to open (already resolved by the dispatcher)
- `args`: remaining CLI args (unused for now, but accept for future flags)

**Algorithm (mirrors the logic in `commands/declare/dashboard.md`):**

1. **Read port.** `const portFile = path.join(cwd, '.planning', 'server.port'); const port = fs.existsSync(portFile) ? parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10) : 3847;`

2. **Check if server is running.** Make an HTTP GET to `http://localhost:{port}/api/graph`. Use `node:http` (no fetch, no axios — zero deps rule). If response status is 2xx → already running. If connection refused or non-2xx → not running.

3. **Start server if not running.** Use `child_process.spawn` with `detached: true` and `stdio: 'ignore'` to background the server:
   ```js
   const child = spawn(process.execPath, [bundlePath, 'serve', '--port', String(port)], {
     cwd,
     detached: true,
     stdio: 'ignore',
   });
   child.unref();
   ```
   Where `bundlePath = path.resolve(__dirname, '../../dist/declare-tools.cjs')`.

   After spawning, poll `/api/graph` up to 10 times (100ms apart) until it responds. If still not up after 1s, print a warning but do not exit 1 — the browser open should still be attempted.

4. **Open browser.** Use `child_process.spawn` (not exec, no shell injection):
   ```js
   const url = `http://localhost:${port}`;
   const opener = process.platform === 'darwin' ? 'open'
     : process.platform === 'win32' ? 'start'
     : 'xdg-open';
   spawn(opener, [url], { stdio: 'ignore', detached: true }).unref();
   ```

5. **Print confirmation.**
   ```
   Dashboard: http://localhost:{port}
   ```
   Then exit 0.

**Constraints:**
- Zero runtime deps: only `node:http`, `node:fs`, `node:path`, `node:child_process`
- No `async/await` at module top level — wrap in an `async function runOpen()` that the dispatcher awaits
- Export: `module.exports = { runOpen };`
  </action>
  <verify>
1. File exists: `ls -la src/commands/open.js`
2. Exports check: `node -e "const {runOpen} = require('./src/commands/open.js'); console.log(typeof runOpen)"` → prints `function`
3. No external requires: `node -e "const mod = require('module'); const orig = mod._resolveFilename.bind(mod); mod._resolveFilename = (req, ...a) => { if (!req.startsWith('node:') && !req.startsWith('.') && !req.startsWith('/') && req !== 'path' && req !== 'fs' && req !== 'http' && req !== 'child_process') throw new Error('external dep: '+req); return orig(req,...a); }; require('./src/commands/open.js')"` exits 0
  </verify>
  <done>`src/commands/open.js` exists, exports `runOpen`, uses only node built-ins, implements the port-read → liveness-check → start-if-needed → browser-open → print flow.</done>
</task>

<task type="auto">
  <name>Task 2: Wire open command into CLI dispatcher and rebuild bundle</name>
  <files>src/declare-tools.js, dist/declare-tools.cjs</files>
  <action>
**Step 1 — Update `src/declare-tools.js`:**

Read the current dispatcher to understand how subcommands are routed (it uses a switch or if-chain on `args[0]`). Add the following routing logic at the TOP of the dispatch (before the existing subcommand checks):

```js
const { runOpen } = require('./commands/open');

// Default invocation: no subcommand, '.', or an absolute/relative path arg
const sub = args[0];
const isDefaultOpen = !sub                          // `declare`
  || sub === '.'                                    // `declare .`
  || (sub.startsWith('/') || sub.startsWith('~'));  // `declare /path/to/project`

if (isDefaultOpen) {
  // Resolve project root
  let projectRoot = process.cwd();
  if (sub && sub !== '.') {
    projectRoot = sub.startsWith('~')
      ? sub.replace('~', require('os').homedir())
      : sub;
  }
  runOpen(projectRoot, args.slice(1)).catch(err => {
    console.error('[declare] ' + err.message);
    process.exit(1);
  });
} else {
  // ... existing subcommand dispatch continues here
}
```

The existing `serve`, `help`, `load-graph`, etc. subcommands must remain fully functional — this change wraps them in the `else` branch, it does not replace them.

**Step 2 — Rebuild the bundle:**

```bash
node /Users/guilherme/Projects/declare-cc/esbuild.config.js
```

Verify `dist/declare-tools.cjs` timestamp is updated after the build.
  </action>
  <verify>
1. Dispatcher updated: `grep -n "runOpen\|isDefaultOpen" src/declare-tools.js` shows the new routing lines
2. Bundle rebuilt: `ls -la dist/declare-tools.cjs` shows a recent modification time
3. Bundle contains open logic: `grep -c "runOpen\|isDefaultOpen\|api/graph" dist/declare-tools.cjs` returns > 0
4. Existing serve still works: `node dist/declare-tools.cjs help 2>&1 | head -3` exits 0
  </verify>
  <done>`src/declare-tools.js` routes default invocations to `runOpen`. `dist/declare-tools.cjs` is rebuilt and contains the open command logic. Existing subcommands (serve, help, load-graph, etc.) are unaffected.</done>
</task>

</tasks>

<verification>
- `node dist/declare-tools.cjs help` prints usage (existing subcommands intact)
- `node dist/declare-tools.cjs serve --port 9999 &` starts a server (existing serve intact); kill it after
- `grep "runOpen" dist/declare-tools.cjs` finds the open command in the bundle
- In a directory with `.planning/`, running `node dist/declare-tools.cjs` (no args) triggers the open path (check with a `console.log` or by observing the server start attempt)
</verification>

<success_criteria>
`src/commands/open.js` implements the full open flow (port read, liveness check, background server start, browser open, confirmation print). The CLI dispatcher routes no-subcommand, `.`, and absolute-path invocations to it. The bundle is rebuilt. All existing subcommands work unchanged.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-35-default-open-behavior/A-73-SUMMARY.md`
</output>
