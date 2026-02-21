---
milestone: M-35-default-open-behavior
action: A-74
type: execute
wave: 2
depends_on:
  - A-72
  - A-73
files_modified:
  - src/commands/open.js
  - dist/declare-tools.cjs
autonomous: true
declarations:
  - D-11

must_haves:
  truths:
    - "Running `declare` in a directory without `.planning/` prints a friendly message and exits 0 (not an error)"
    - "The message tells the user exactly what to run to initialize a project"
    - "Running `declare` in a directory WITH `.planning/` is unaffected by this change"
    - "The check happens before any server start or browser open attempt"
  artifacts:
    - path: "src/commands/open.js"
      provides: "Updated open command with .planning/ guard at top"
      contains: ".planning"
    - path: "dist/declare-tools.cjs"
      provides: "Rebuilt bundle with the guard included"
  key_links:
    - from: "src/commands/open.js runOpen()"
      to: "path.join(projectRoot, '.planning')"
      via: "fs.existsSync check at function entry"
      pattern: "\\.planning"
---

<objective>
Add a graceful "uninitialized project" guard to `runOpen` in `src/commands/open.js`.

When `declare` is run in a directory that has no `.planning/` folder, instead of hanging (waiting for a server that will never respond to `/api/graph`) or throwing an unhelpful error, print a clear message telling the user how to initialize.

Purpose: D-11 specifies "prompting to initialize if empty." This is the implementation of that prompt. Without it, users who run `declare` in a fresh project directory get a confusing hang or a connection-refused error.

Output: Guard added to `src/commands/open.js`, bundle rebuilt.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/commands/open.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add .planning/ guard to runOpen and rebuild</name>
  <files>src/commands/open.js, dist/declare-tools.cjs</files>
  <action>
**Step 1 — Update `src/commands/open.js`:**

At the very top of the `runOpen` function body (before the port read), add:

```js
const planningDir = path.join(cwd, '.planning');
if (!fs.existsSync(planningDir)) {
  console.log('');
  console.log('  No .planning/ directory found in: ' + cwd);
  console.log('');
  console.log('  To initialize this project with Declare, run:');
  console.log('    npx declare-cc');
  console.log('');
  console.log('  Or, if declare-cc is already installed globally:');
  console.log('    declare-cc');
  console.log('');
  process.exit(0);
}
```

This guard must:
- Fire BEFORE the port read, server liveness check, and browser open
- Exit 0 (not 1) — missing `.planning/` is not an error, it is a usage guide moment
- Print to stdout (not stderr)
- Include exactly what command the user should run (`npx declare-cc`)

Do NOT change any other logic in `runOpen`. The rest of the function (port read, liveness check, server start, browser open) stays exactly as written in A-73.

**Step 2 — Rebuild the bundle:**

```bash
node /Users/guilherme/Projects/declare-cc/esbuild.config.js
```
  </action>
  <verify>
1. Guard is present: `grep -n "\.planning" src/commands/open.js` shows the check
2. Test guard fires: create a temp dir without .planning and run the command:
   ```bash
   TMPDIR=$(mktemp -d) && node /Users/guilherme/Projects/declare-cc/dist/declare-tools.cjs --cwd "$TMPDIR" 2>&1 || true
   ```
   Expected: prints the "No .planning/ directory found" message. Exit code 0.

   Note: the guard uses `cwd` passed to `runOpen`, which in the dispatcher comes from `process.cwd()` or a resolved path arg. Test by temporarily changing to a dir without `.planning/` or by patching cwd in a quick test.

3. Guard does not fire in this project: `node /Users/guilherme/Projects/declare-cc/dist/declare-tools.cjs help` still works (existing subcommands unaffected)

4. Bundle rebuilt: `ls -la dist/declare-tools.cjs` shows recent modification time and `grep -c "No .planning" dist/declare-tools.cjs` returns > 0
  </verify>
  <done>Guard is at the top of `runOpen`. Running in a directory without `.planning/` prints the initialization prompt and exits 0. Running in a directory with `.planning/` proceeds to port read and server start. Bundle is rebuilt with the guard included.</done>
</task>

</tasks>

<verification>
- `grep "No .planning" dist/declare-tools.cjs` finds the guard message in the bundle
- `grep "npx declare-cc" dist/declare-tools.cjs` finds the init instruction
- Running `node dist/declare-tools.cjs` from a directory without `.planning/` exits 0 with the prompt message
- Running `node dist/declare-tools.cjs` from the declare-cc project root (which has `.planning/`) proceeds past the guard (attempts server connection)
</verification>

<success_criteria>
`runOpen` checks for `.planning/` before doing anything else. Missing `.planning/` → print friendly init prompt, exit 0. Present `.planning/` → continue with port read, liveness check, server start, browser open as implemented in A-73. Bundle rebuilt and contains the guard.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-35-default-open-behavior/A-74-SUMMARY.md`
</output>
