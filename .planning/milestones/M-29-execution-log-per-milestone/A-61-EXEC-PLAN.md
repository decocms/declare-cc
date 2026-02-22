---
milestone: M-29-execution-log-per-milestone
action: A-61
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/process-manager.js
  - src/artifacts/milestone-folders.js
autonomous: true
declarations: ["D-08"]
must_haves:
  truths:
    - "Every action execution produces a persistent execution.log in the milestone folder"
    - "Log entries include ISO timestamp, action ID, stream source, and text"
    - "Start and end markers record action ID, start time, end time, and exit code"
    - "Existing SSE streaming continues to work unchanged"
  artifacts:
    - path: "src/server/process-manager.js"
      provides: "Log-appending logic alongside existing SSE broadcast"
      contains: "execution.log"
  key_links:
    - from: "src/server/process-manager.js"
      to: ".planning/milestones/M-XX-*/execution.log"
      via: "fs.appendFileSync on each output line and on process close"
      pattern: "appendFileSync.*execution\\.log"
---

<objective>
Add persistent execution log recording to the process manager so every action execution appends timestamped output to `.planning/milestones/M-XX-slug/execution.log`.

Purpose: Provide a durable, human-readable record of agent runs that persists across server restarts and browser sessions — the foundation for D-08 (Live Execution Visibility).

Output: Modified process-manager.js that writes structured log entries alongside its existing SSE broadcast.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/process-manager.js
@src/artifacts/milestone-folders.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add log file writing to process manager</name>
  <files>src/server/process-manager.js</files>
  <action>
Modify `createProcessManager` in `src/server/process-manager.js` to write a persistent log file during action execution. The process manager already receives `cwd` and has `milestoneId` per process entry.

1. Add `const fs = require('node:fs');` and `const { findMilestoneFolder } = require('../artifacts/milestone-folders');` at the top.

2. Add a helper function `appendLog(logPath, line)` that calls `fs.appendFileSync(logPath, line + '\n', 'utf-8')`. Wrap in try/catch to never crash the server on write failure.

3. In the `execute()` function, after `processes.set(actionId, ...)`:
   - Resolve the milestone folder: `const planningDir = require('node:path').join(cwd, '.planning');`
   - `const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);`
   - If milestoneFolder is null, log a warning to stderr and skip file logging (SSE still works).
   - `const logPath = require('node:path').join(milestoneFolder, 'execution.log');`
   - Write a start marker: `appendLog(logPath, \`\n=== START ${actionId} @ ${new Date().toISOString()} ===\`);`

4. In the `createLineHandler` function (or alongside the existing stdout/stderr data handlers), after each `broadcast('action-output', ...)` call, also call `appendLog(logPath, \`[${new Date().toISOString()}] [${actionId}] [${streamName}] ${line}\`);`
   - To make `logPath` available inside the line handlers, capture it in a closure. Add `logPath` to the `ProcessEntry` typedef: `{{ proc, milestoneId, logPath?: string }}`. Store it when setting the process entry. Then in the line handler factory, accept logPath as a parameter.

5. In the `proc.on('close', ...)` handler, before `processes.delete(actionId)`:
   - Retrieve `logPath` from the process entry.
   - Write end marker: `appendLog(logPath, \`=== END ${actionId} @ ${new Date().toISOString()} exit=${exitCode ?? -1} ===\n\`);`

6. In the `proc.on('error', ...)` handler, same pattern:
   - Write: `appendLog(logPath, \`=== ERROR ${actionId} @ ${new Date().toISOString()} ===\n\`);`

Log format example:
```
=== START A-61 @ 2026-02-21T10:30:00.000Z ===
[2026-02-21T10:30:00.123Z] [A-61] [stdout] Running task 1...
[2026-02-21T10:30:01.456Z] [A-61] [stderr] Warning: something
[2026-02-21T10:30:05.789Z] [A-61] [stdout] Task complete
=== END A-61 @ 2026-02-21T10:30:06.000Z exit=0 ===
```

Do NOT change the SSE broadcast behavior at all — log writing is purely additive.
  </action>
  <verify>
Run `node -e "require('./src/server/process-manager.js')"` to confirm no syntax errors.
Grep the file for `appendFileSync` and `execution.log` to confirm log writing is present.
Grep for `broadcast('action-output'` to confirm SSE broadcasting is unchanged.
  </verify>
  <done>
process-manager.js appends timestamped entries to execution.log in the milestone folder for every action execution, with start/end markers including exit code. SSE streaming is unaffected.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rebuild CJS bundle and verify</name>
  <files>dist/declare-tools.cjs</files>
  <action>
Run `npm run build` (or the project's build command) to rebuild the CJS bundle so the updated process-manager.js is included in the distributable.

After build, verify:
1. `grep "execution.log" dist/declare-tools.cjs` returns matches
2. `grep "appendFileSync" dist/declare-tools.cjs` returns matches
3. `node dist/declare-tools.cjs --help` runs without error

If the project uses esbuild or rollup, the build command is in package.json scripts.
  </action>
  <verify>
`npm run build` exits 0.
`grep -c "execution.log" dist/declare-tools.cjs` returns >= 1.
`node dist/declare-tools.cjs --help` exits 0.
  </verify>
  <done>
dist/declare-tools.cjs is rebuilt with execution log recording included and runs without error.
  </done>
</task>

</tasks>

<verification>
1. `node -e "require('./src/server/process-manager.js')"` — no errors
2. `npm run build` — exits 0
3. `grep "execution.log" src/server/process-manager.js` — matches found
4. `grep "broadcast" src/server/process-manager.js` — SSE broadcast calls still present
</verification>

<success_criteria>
The process manager writes structured, timestamped execution logs to .planning/milestones/M-XX-*/execution.log during action execution. Each run has START/END markers with action ID, timestamps, and exit code. SSE streaming behavior is completely unchanged.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-29-execution-log-per-milestone/A-61-SUMMARY.md`
</output>
