---
milestone: M-43-server-side-agent-lifecycle-tracking
action: A-122
type: execute
wave: 3
depends_on: ["A-119", "A-120", "A-121"]
files_modified:
  - src/server/index.js
  - src/server/agent-registry.js
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "On server startup, previously-running agents are marked as interrupted"
    - "GET /api/agents returns interrupted agents in the recent list immediately after restart"
    - "New agents spawned after restart work correctly alongside restored state"
  artifacts:
    - path: "src/server/index.js"
      provides: "Startup call to restore agent state"
      contains: "loadFromDisk"
    - path: "src/server/agent-registry.js"
      provides: "restoreFromDisk method for startup recovery"
      contains: "restoreFromDisk"
  key_links:
    - from: "src/server/index.js"
      to: "src/server/agent-registry.js"
      via: "restoreFromDisk called during server initialization"
      pattern: "restoreFromDisk"
    - from: "src/server/agent-registry.js"
      to: ".planning/agent-state.json"
      via: "reads persisted state on startup"
      pattern: "readFileSync.*agent-state\\.json"
---

<objective>
Add startup logic that reads the persisted agent state file, marks any previously-running agents as "interrupted", and loads recent agents so the dashboard shows correct state immediately after a server restart.

Purpose: Cards survive page refresh and server restart (D-16 requirement: "Cards survive page refresh and navigation"). Without this, restarting the server loses all agent history.
Output: restoreFromDisk method on AgentRegistry, startup call in index.js server initialization.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-119-SUMMARY.md
@.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-120-SUMMARY.md
@.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-121-SUMMARY.md
@src/server/agent-registry.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add restoreFromDisk method to AgentRegistry</name>
  <files>src/server/agent-registry.js</files>
  <action>
Add a `restoreFromDisk()` method to the registry object returned by `createAgentRegistry()`. This method:

1. Calls `loadFromDisk()` to read `.planning/agent-state.json`.
2. If null (no file or parse error), returns `{ restored: 0, interrupted: 0 }`.
3. For each agent in the persisted `agents` map (these were "running" when server stopped):
   - Set status to "interrupted", completedAt to now, exitCode to -1, error to "server restarted"
   - Add to `recentAgents` array
4. For each agent in the persisted `recentAgents` array:
   - Add to `recentAgents` if not already present and not older than 30 minutes
5. Persist the updated state (calling `persistState()` once at the end).
6. Returns `{ restored: recentAgents.length, interrupted: interruptedCount }`.

This must be idempotent — calling it twice should not duplicate entries.

Also update the self-test at the bottom to exercise restoreFromDisk:
```js
// Add after existing self-test lines:
const restored = reg.restoreFromDisk();
console.log('restored:', restored.restored, 'interrupted:', restored.interrupted);
```
  </action>
  <verify>
`node src/server/agent-registry.js` passes self-test including the restore line.
Manually test: spawn an agent, kill the process (simulating crash), call restoreFromDisk — the agent should appear as "interrupted" in getRecent().
  </verify>
  <done>
restoreFromDisk method implemented on AgentRegistry. Previously-running agents marked as "interrupted". Recent agents restored from disk. Method is idempotent.
  </done>
</task>

<task type="auto">
  <name>Task 2: Call restoreFromDisk on server startup in index.js</name>
  <files>src/server/index.js</files>
  <action>
In the `startServer(cwd, port)` function (or wherever the HTTP server is created and started), add a call to restore agent state right after the server begins listening.

Find the server.listen callback (or the section where the server is fully initialized). After the server is ready, add:

```js
// Restore agent state from previous run
const reg = getAgentRegistry(cwd);
const restored = reg.restoreFromDisk();
if (restored.interrupted > 0) {
  process.stderr.write(`[declare] Restored agent state: ${restored.interrupted} agent(s) marked as interrupted from previous run\n`);
}
```

Place this AFTER the server starts listening but BEFORE returning the server handle to the caller. This ensures the registry is populated before any client connects.

Find the exact location by searching for `server.listen` or the return statement in `startServer`. The pattern should match how the existing server startup works.

IMPORTANT: This must only run once on startup, not on every request. Place it in the server initialization code, NOT in the request handler.
  </action>
  <verify>
Start the server and check stderr output — if a previous agent-state.json exists with running agents, it should log the interrupted count.
`curl http://localhost:3847/api/agents` should return any interrupted agents in the `recent` array.
If no agent-state.json exists, startup should proceed silently (no errors).
  </verify>
  <done>
Server startup reads agent-state.json, marks previously-running agents as interrupted, and serves correct state via GET /api/agents immediately. Clean startup (no state file) works silently.
  </done>
</task>

</tasks>

<verification>
- Server starts cleanly with no agent-state.json (no errors)
- Server starts with stale agent-state.json containing running agents — they appear as "interrupted" in GET /api/agents recent list
- New agents spawned after restart work correctly (spawn/complete/fail cycle)
- restoreFromDisk is called exactly once on startup
</verification>

<success_criteria>
Agent state survives server restarts. Previously-running agents are marked as interrupted. GET /api/agents returns correct state immediately after restart. New agent lifecycle works normally after restore.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-122-SUMMARY.md`
</output>
