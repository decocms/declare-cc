# Plan: M-43 -- Server-side agent lifecycle tracking

**Milestone:** M-43
**Realizes:** D-16
**Status:** PENDING
**Derived:** 2026-02-23

## Actions

### A-119: Build agent registry module
**Status:** DONE
**Review:** approved
**Produces:** AgentRegistry class (src/server/agent-registry.js) with in-memory agent map, spawn/update/complete/fail lifecycle methods, and periodic persistence to .planning/agent-state.json

### A-120: Integrate registry with all spawn points
**Status:** DONE
**Review:** approved
**Produces:** Hook-in points in process-manager.js, derivationRunner, actionDerivationRunner, revisionRunner, and pipelineRunner so every agent spawn registers and every completion/failure updates the registry

### A-121: Add agent lifecycle API endpoints
**Status:** DONE
**Review:** approved
**Produces:** GET /api/agents (active + recent), GET /api/agents/:id (single agent detail), and SSE event types agent-start, agent-update, agent-complete broadcast on state changes

### A-122: Restore agent state on server restart
**Status:** DONE
**Review:** approved
**Produces:** Startup logic that reads agent-state.json, marks previously-running agents as interrupted, and serves correct state immediately
