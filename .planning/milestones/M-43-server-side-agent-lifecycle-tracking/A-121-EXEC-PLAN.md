---
milestone: M-43-server-side-agent-lifecycle-tracking
action: A-121
type: execute
wave: 3
depends_on: ["A-119", "A-120"]
files_modified:
  - src/server/index.js
autonomous: true
declarations: ["D-16"]

must_haves:
  truths:
    - "GET /api/agents returns both active and recent agents in a single response"
    - "GET /api/agents/:id returns a single agent's full detail or 404"
    - "SSE events agent-start, agent-update, agent-complete are broadcast on lifecycle changes"
  artifacts:
    - path: "src/server/index.js"
      provides: "Agent lifecycle API routes and SSE event types"
      contains: "/api/agents"
  key_links:
    - from: "src/server/index.js"
      to: "src/server/agent-registry.js"
      via: "getAgentRegistry(cwd).getAll()"
      pattern: "getAgentRegistry.*getAll|getAgentRegistry.*get\\("
---

<objective>
Add HTTP API endpoints for querying agent state and document the SSE event types that the registry broadcasts. The API gives the dashboard (M-44) a way to fetch current state on load, and SSE gives it real-time updates.

Purpose: The API surface M-44 (client-side activity cards) will consume. Without these endpoints, the client has no way to know what agents are running.
Output: Two new GET routes in index.js. SSE events already broadcast by A-120's registry wiring — this action adds the REST query surface.
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
@src/server/agent-registry.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GET /api/agents and GET /api/agents/:id routes</name>
  <files>src/server/index.js</files>
  <action>
Add two new GET routes to the request handler in index.js. Place them near the existing `/api/running` route (around line 2264) for consistency.

**GET /api/agents** — Returns all agents (active + recent):
```js
if (urlPath === '/api/agents') {
  const reg = getAgentRegistry(cwd);
  sendJson(res, 200, reg.getAll());
  return;
}
```

Response shape: `{ active: AgentRecord[], recent: AgentRecord[] }`

**GET /api/agents/:id** — Returns a single agent by ID:
```js
const agentMatch = urlPath.match(/^\/api\/agents\/([^/]+)$/);
if (agentMatch) {
  const reg = getAgentRegistry(cwd);
  const agent = reg.get(decodeURIComponent(agentMatch[1]));
  if (agent) {
    sendJson(res, 200, agent);
  } else {
    sendJson(res, 404, { error: 'Agent not found' });
  }
  return;
}
```

IMPORTANT: Place the `/api/agents` exact match BEFORE the `/api/agents/:id` pattern match to avoid the pattern consuming the base path.

Also add a comment block documenting the SSE event types that the registry broadcasts (already wired in A-120, this just documents them for the client developer):
```js
// Agent lifecycle SSE events (broadcast by AgentRegistry via broadcastFn):
//   agent-start   — { id, type, target, milestoneId, status: "running", startedAt }
//   agent-update  — { id, type, target, milestoneId, status, updatedAt, ...patch }
//   agent-complete — { id, type, target, milestoneId, status: "complete"|"failed", completedAt, exitCode, result|error }
```
  </action>
  <verify>
Start the server (`node dist/declare-tools.cjs serve &` or similar) and test:
- `curl http://localhost:3847/api/agents` returns `{ "active": [], "recent": [] }`
- `curl http://localhost:3847/api/agents/nonexistent` returns 404 with error message

If server cannot be started in test context, verify with:
- Grep for `/api/agents` in index.js — should find the route handlers
- `node -e "require('./src/server/index.js')"` does not throw
  </verify>
  <done>
GET /api/agents returns { active, recent } from the registry. GET /api/agents/:id returns a single agent or 404. SSE event types documented in comments. All routes follow existing patterns (sendJson, CORS headers via sendJson).
  </done>
</task>

</tasks>

<verification>
- GET /api/agents returns 200 with { active: [], recent: [] } when no agents running
- GET /api/agents/:id returns 404 for unknown ID
- SSE events agent-start, agent-update, agent-complete are documented in code comments
- No regressions in existing routes (the new routes don't conflict with /api/running or /api/pipeline/*)
</verification>

<success_criteria>
Dashboard can fetch current agent state via GET /api/agents on page load, query individual agents via GET /api/agents/:id, and receive real-time updates via existing SSE /events stream with agent-start, agent-update, agent-complete event types.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-server-side-agent-lifecycle-tracking/A-121-SUMMARY.md`
</output>
