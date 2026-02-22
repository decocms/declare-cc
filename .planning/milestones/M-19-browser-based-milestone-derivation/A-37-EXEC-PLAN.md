---
milestone: M-19-browser-based-milestone-derivation
action: A-37
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/derivation-runner.js
autonomous: true
declarations:
  - D-06
must_haves:
  truths:
    - "A derivation subprocess can be spawned with a scoped prompt containing only declaration context"
    - "The subprocess streams stdout/stderr line-by-line to SSE clients tagged with a derivation session ID"
    - "The subprocess produces structured JSON output (proposed milestones) parseable by the caller"
  artifacts:
    - path: "src/server/derivation-runner.js"
      provides: "Derivation subprocess manager — spawn, stream, parse results"
      exports: ["createDerivationRunner"]
  key_links:
    - from: "src/server/derivation-runner.js"
      to: "claude CLI"
      via: "child_process.spawn('claude', ['-p', prompt, '--output-format', 'json'])"
      pattern: "spawn.*claude.*-p"
    - from: "src/server/derivation-runner.js"
      to: "SSE clients"
      via: "broadcast function passed from caller"
      pattern: "broadcast.*derivation-output"
---

<objective>
Build a scoped agent invocation module for milestone derivation that spawns `claude -p` with a minimal derivation prompt and streams output via SSE.

Purpose: Provides the server-side engine that powers browser-based milestone derivation. Reuses the process-manager pattern from M-41 but specialized for derivation (different prompt, structured JSON output, session-based tracking instead of action-based).

Output: `src/server/derivation-runner.js` — a self-contained module the API endpoint (A-38) will import.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/process-manager.js
@src/commands/add-milestones-batch.js
@workflows/milestones.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create derivation-runner.js module</name>
  <files>src/server/derivation-runner.js</files>
  <action>
Create `src/server/derivation-runner.js` exporting `createDerivationRunner(sseClients, cwd)`.

Follow the exact pattern from `src/server/process-manager.js` (broadcast helper, line-buffered stream handler, process tracking map) but adapted for derivation:

**Key differences from process-manager.js:**

1. **Session-based, not action-based.** Track by a generated session ID (e.g., `deriv-${Date.now()}`), not by action ID. Only one derivation can run at a time (same as process-manager's one-at-a-time cap).

2. **Scoped prompt.** The `derive(declarationId, declarations)` method builds a tight prompt:
   - If `declarationId` is provided, include only that declaration's statement
   - If null, include all declarations that have no milestones yet
   - The prompt instructs Claude to output ONLY a JSON array: `[{"title": "...", "realizes": "D-XX", "reason": "..."}]`
   - Prompt template: "You are deriving milestones for a Declare project. Given these declarations, propose 2-4 milestones per declaration by asking 'For this to be true, what must be true?' Output ONLY a JSON array with no markdown fencing: [{\"title\": \"milestone title\", \"realizes\": \"D-XX\", \"reason\": \"why this must be true\"}]. Declarations:\n\n{formatted declarations}"

3. **SSE events.** Broadcast using event names:
   - `derivation-output` with `{ sessionId, text, stream }` (line-by-line stdout/stderr)
   - `derivation-complete` with `{ sessionId, exitCode, milestones }` where `milestones` is the parsed JSON array from stdout (or null on parse failure)

4. **Output parsing.** On process close, attempt to parse the accumulated stdout as JSON. The runner collects all stdout text (in addition to line-by-line streaming). On exit code 0, try `JSON.parse(fullStdout)`. If parsing fails, set milestones to null in the complete event so the UI can show raw output.

5. **Spawn args.** Use `spawn('claude', ['-p', prompt, '--output-format', 'text', '--no-input'], { cwd, env: { ...process.env, FORCE_COLOR: '0' } })` — same as process-manager.js.

**Return shape from createDerivationRunner:**
```js
{
  derive: (declarationId, declarations) => { ok?, error?, status?, sessionId? },
  stop: () => { ok?, error?, status? },
  running: () => string | null  // session ID or null
}
```

Where `declarations` is an array of `{ id, statement, milestones }` objects (from load-graph).

Use `'use strict'` and `// @ts-check` header. Zero runtime dependencies — only `node:child_process`.
  </action>
  <verify>
Run `node -e "const { createDerivationRunner } = require('./src/server/derivation-runner.js'); console.log(typeof createDerivationRunner)"` — should print "function".

Run `node -e "const { createDerivationRunner } = require('./src/server/derivation-runner.js'); const r = createDerivationRunner(new Set(), '.'); console.log(typeof r.derive, typeof r.stop, typeof r.running)"` — should print "function function function".
  </verify>
  <done>
Module exports createDerivationRunner. It spawns claude -p with a derivation-scoped prompt, streams output line-by-line via broadcast, parses final JSON output, and emits derivation-complete with parsed milestones.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add unit-level smoke test</name>
  <files>src/server/derivation-runner.js</files>
  <action>
Verify the prompt-building logic works correctly by adding a quick inline test at the bottom of the file (guarded by `if (require.main === module)`):

```js
if (require.main === module) {
  // Smoke test: prompt building
  const runner = createDerivationRunner(new Set(), '.');
  // Verify module shape
  console.log('derive:', typeof runner.derive);
  console.log('stop:', typeof runner.stop);
  console.log('running:', typeof runner.running);
  console.log('OK');
}
```

Run `node src/server/derivation-runner.js` to confirm it prints OK without errors.
  </action>
  <verify>Run `node src/server/derivation-runner.js` — should print "derive: function", "stop: function", "running: function", "OK" with exit code 0.</verify>
  <done>Module is self-testable and confirms its API shape.</done>
</task>

</tasks>

<verification>
- `node -e "require('./src/server/derivation-runner.js')"` loads without error
- Module exports match the documented API (derive, stop, running)
- No runtime dependencies beyond node:child_process
</verification>

<success_criteria>
derivation-runner.js exists, exports createDerivationRunner, follows process-manager.js patterns, builds scoped prompts from declaration data, streams output via SSE broadcast, and parses structured JSON results on completion.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-19-browser-based-milestone-derivation/A-37-SUMMARY.md`
</output>
