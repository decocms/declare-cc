---
milestone: M-34-declare-global-binary
action: A-72
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/declare.js
autonomous: true
declarations:
  - D-11

must_haves:
  truths:
    - "`bin/declare.js` is executable and has the correct shebang line"
    - "The script resolves the location of `declare-tools.cjs` relative to its own `__dirname` (so it works from any npm global bin location)"
    - "Running `node bin/declare.js --help` prints usage without error"
    - "The script forwards all CLI arguments to `declare-tools.cjs` unchanged"
    - "The script sets the working directory context so `declare-tools.cjs` operates on the correct project root"
  artifacts:
    - path: "bin/declare.js"
      provides: "Global CLI entry point — locates declare-tools.cjs and delegates"
      exports: []
  key_links:
    - from: "bin/declare.js"
      to: "dist/declare-tools.cjs"
      via: "path.resolve(__dirname, '../dist/declare-tools.cjs')"
      pattern: "declare-tools\\.cjs"
    - from: "bin/declare.js"
      to: "process.cwd()"
      via: "spawn/require with cwd set to invocation directory"
      pattern: "process\\.cwd|cwd"
---

<objective>
Create `bin/declare.js` — the thin wrapper script that acts as the global `declare` binary.

The script's job: given any invocation (`declare`, `declare .`, `declare /path/to/project`, `declare serve`), locate the bundled `declare-tools.cjs` and call it with the correct arguments. It does NOT implement any business logic itself — all behaviour lives in `declare-tools.cjs`.

Architecture note: `bin/declare.js` is a CJS script (no ESM, no dependencies beyond node built-ins). It resolves `declare-tools.cjs` via `path.resolve(__dirname, '../dist/declare-tools.cjs')` so the path is stable whether installed globally via npm or linked locally via `npm link`.

Purpose: Without this wrapper, users must run `node ~/.local/lib/node_modules/declare-cc/dist/declare-tools.cjs serve` — a path no human should need to know. The wrapper makes `declare` the natural entry point.

Output: `bin/declare.js` committed and executable (`chmod 755`).
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@bin/install.js
@src/commands/serve.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/declare.js entry script</name>
  <files>bin/declare.js</files>
  <action>
Create `bin/declare.js` as a CommonJS script with the following exact structure and behaviour:

1. **Shebang:** `#!/usr/bin/env node`
2. **Resolve the bundle path:** `path.resolve(__dirname, '../dist/declare-tools.cjs')`
3. **Forward all args:** pass `process.argv.slice(2)` unchanged to the tools bundle
4. **Pass cwd:** The tools bundle already uses `process.cwd()` internally, so no special handling is needed — just require/spawn in the same process and the cwd is inherited correctly.
5. **Execution method:** Use `require()` to load the bundle in-process (same process, no child_process spawn). This is simpler, avoids exit-code plumbing, and means the tools bundle's `process.argv` is already set correctly.

The script should:
- Load the bundle: `require(bundlePath)` after setting `process.argv` so the bundle's arg parser sees the right args
- Guard: if `bundlePath` does not exist (e.g. user forgot to `npm install` or `npm run build`), print a helpful error and exit 1

Pattern to follow (mirrors how `bin/install.js` uses `require('../package.json')`):

```js
#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const bundlePath = path.resolve(__dirname, '../dist/declare-tools.cjs');

if (!fs.existsSync(bundlePath)) {
  console.error('[declare] Bundle not found: ' + bundlePath);
  console.error('[declare] Run `npm run build` in the declare-cc package directory.');
  process.exit(1);
}

// Forward argv as-is — declare-tools.cjs reads process.argv
require(bundlePath);
```

After writing, make it executable: `chmod 755 bin/declare.js`

Do NOT add any business logic (no server start, no browser open — that belongs in M-35/A-73 and A-74).
Do NOT use ESM (`import`/`export`) — must be CJS for consistency with the rest of `bin/`.
Do NOT use `child_process` — in-process require is sufficient and simpler.
  </action>
  <verify>
1. File exists and is executable: `ls -la bin/declare.js`
2. Shebang present: first line is `#!/usr/bin/env node`
3. Runs without error (bundle exists): `node bin/declare.js --help 2>&1 | head -5`
4. Guard fires when bundle missing: `node -e "process.argv.push('--help'); const p = require.resolve('./bin/declare.js'); delete require.cache[p]; const origExist = require('fs').existsSync; require('fs').existsSync = () => false; try { require('./bin/declare.js') } catch(e) {}"` — or simply verify the guard code is present in the file.
  </verify>
  <done>`bin/declare.js` exists, is executable (mode 755), has `#!/usr/bin/env node` shebang, resolves and requires `../dist/declare-tools.cjs`, and exits 1 with a clear error message if the bundle is missing. No business logic in the file.</done>
</task>

</tasks>

<verification>
- `ls -la /Users/guilherme/Projects/declare-cc/bin/declare.js` shows executable bit set
- `node /Users/guilherme/Projects/declare-cc/bin/declare.js help 2>&1` exits 0 and prints usage
- File contains `path.resolve(__dirname, '../dist/declare-tools.cjs')` (bundle location is relative to `__dirname`, not `process.cwd()`)
</verification>

<success_criteria>
`bin/declare.js` exists, is executable, resolves the bundle via `__dirname`-relative path, forwards all argv to the bundle in-process, and prints a clear error if the bundle is missing.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-34-declare-global-binary/A-72-SUMMARY.md`
</output>
