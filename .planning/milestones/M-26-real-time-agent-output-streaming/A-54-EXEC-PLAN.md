---
milestone: M-26-real-time-agent-output-streaming
action: A-54
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/agent-runner.js
autonomous: true
declarations:
  - D-08
user_setup: []

must_haves:
  truths:
    - "A subprocess can be spawned with a command string and max-tokens budget"
    - "stdout and stderr are emitted line-by-line as tagged events with actionId"
    - "When the subprocess exits, a done or error event is emitted"
    - "Multiple concurrent runs are tracked independently by actionId"
  artifacts:
    - path: "src/server/agent-runner.js"
      provides: "AgentRunner class with spawn, event emission, budget enforcement"
      exports: ["AgentRunner"]
  key_links:
    - from: "src/server/agent-runner.js"
      to: "node:child_process"
      via: "spawn() call"
      pattern: "require\\('node:child_process'\\)"
    - from: "src/server/agent-runner.js"
      to: "node:events"
      via: "extends EventEmitter"
      pattern: "require\\('node:events'\\)"
---

<objective>
Build a server-side agent subprocess runner module that wraps CLI invocations (e.g. `claude`) with token budget enforcement, streams stdout/stderr line-by-line as tagged events, and tracks multiple concurrent runs by action ID.

Purpose: Foundation for real-time execution visibility — all agent output flows through this runner before reaching SSE clients.
Output: `src/server/agent-runner.js` — a self-contained module with no external dependencies.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create AgentRunner module</name>
  <files>src/server/agent-runner.js</files>
  <action>
Create `src/server/agent-runner.js` exporting an `AgentRunner` class that extends `EventEmitter` from `node:events`.

**Constructor:** Takes no arguments. Maintains an internal `Map<string, ChildProcess>` called `this.runs` tracking active subprocesses by actionId.

**Method: `run(actionId, command, args, options)`**
- `actionId` (string) — identifies this run (e.g. "A-54")
- `command` (string) — executable name (e.g. "claude")
- `args` (string[]) — arguments array
- `options` (object, optional):
  - `maxTokens` (number, default 100000) — appended as `--max-tokens {value}` to args if command is "claude"
  - `cwd` (string) — working directory for the subprocess
  - `env` (object) — additional env vars merged with process.env

Implementation:
1. If `options.maxTokens` and command === 'claude', push `'--max-tokens'` and `String(options.maxTokens)` onto the args array.
2. Spawn using `child_process.spawn(command, args, { cwd, env: {...process.env, ...options.env}, stdio: ['ignore', 'pipe', 'pipe'] })`.
3. Store the child process in `this.runs.set(actionId, child)`.
4. For both `child.stdout` and `child.stderr`:
   - Set encoding to 'utf-8'
   - Use a line buffer: accumulate chunks, split on `\n`, emit complete lines immediately, keep partial line in buffer
   - For each complete line, call `this.emit('output', { actionId, chunk: line, type: 'stdout' or 'stderr', timestamp: Date.now() })`
5. On child `'close'` event with exit code:
   - Flush any remaining partial line from both buffers
   - Emit `this.emit('output', { actionId, chunk: '', type: code === 0 ? 'done' : 'error', exitCode: code, timestamp: Date.now() })`
   - Remove from `this.runs`
6. On child `'error'` event (spawn failure):
   - Emit `this.emit('output', { actionId, chunk: err.message, type: 'error', timestamp: Date.now() })`
   - Remove from `this.runs`
7. Return the child process for optional external control.

**Method: `kill(actionId)`**
- If `this.runs.has(actionId)`, call `child.kill('SIGTERM')`. Return boolean indicating if a process was found.

**Method: `isRunning(actionId)`**
- Return `this.runs.has(actionId)`.

**Method: `activeRuns()`**
- Return `Array.from(this.runs.keys())`.

Use only `node:child_process` and `node:events`. No external dependencies. Add JSDoc for all public methods. Add the standard file header comment matching the style in `src/server/index.js`.
  </action>
  <verify>
Run `node -e "const { AgentRunner } = require('./src/server/agent-runner.js'); const r = new AgentRunner(); console.log(typeof r.run, typeof r.kill, typeof r.isRunning, typeof r.activeRuns);"` — should print "function function function function" with no errors.
  </verify>
  <done>AgentRunner class is importable, has run/kill/isRunning/activeRuns methods, spawns subprocesses, emits tagged output events line-by-line, handles exit and error, enforces --max-tokens for claude commands.</done>
</task>

<task type="auto">
  <name>Task 2: Verify runner with a real subprocess</name>
  <files>src/server/agent-runner.js</files>
  <action>
Write and execute an inline verification script (not saved to disk) that:

1. Requires AgentRunner
2. Creates an instance
3. Listens on 'output' events, collecting them in an array
4. Calls `runner.run('test-1', 'echo', ['hello world'], {})` — note: echo is not 'claude' so maxTokens should NOT be appended
5. Waits for the 'done' event via a promise
6. Asserts:
   - At least one stdout event with chunk containing "hello world"
   - Final event has type 'done' and exitCode 0
   - `runner.isRunning('test-1')` returns false after completion
   - `runner.activeRuns()` returns empty array after completion
7. Tests concurrent runs: spawn two `echo` commands with different actionIds simultaneously, verify both complete with correct tagging
8. Tests error case: spawn a non-existent command, verify an 'error' event is emitted

Print "ALL TESTS PASSED" if all assertions hold, throw on any failure.

If any assertion fails, fix the AgentRunner implementation until all pass.
  </action>
  <verify>The inline verification script prints "ALL TESTS PASSED" with exit code 0.</verify>
  <done>AgentRunner correctly spawns subprocesses, tags output by actionId, handles concurrent runs independently, and emits proper done/error events.</done>
</task>

</tasks>

<verification>
- `node -e "require('./src/server/agent-runner.js')"` exits cleanly (module loads without error)
- AgentRunner emits stdout/stderr events with `{ actionId, chunk, type, timestamp }` shape
- Multiple concurrent runs tracked independently
- Exit produces done/error event with exitCode
- --max-tokens only appended when command is 'claude'
</verification>

<success_criteria>
A working AgentRunner module at `src/server/agent-runner.js` that can spawn any CLI command, stream its output line-by-line as tagged events, enforce token budgets for claude commands, and track multiple concurrent runs — ready to be wired into the SSE endpoint in A-55.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-26-real-time-agent-output-streaming/A-54-SUMMARY.md`
</output>
