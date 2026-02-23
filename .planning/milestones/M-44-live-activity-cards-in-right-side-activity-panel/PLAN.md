# Plan: M-44 -- Live activity cards in right-side activity panel

**Milestone:** M-44
**Realizes:** D-16
**Status:** PENDING
**Derived:** 2026-02-23

## Actions

### A-123: Build activity card UI component
**Status:** PENDING
**Review:** approved
**Produces:** renderAgentCard() function in app.js that renders a card with agent type icon, target node, elapsed timer, and status badge (running/done/failed)

### A-124: Replace activity feed with card-based panel
**Status:** PENDING
**Review:** approved
**Produces:** Refactored right-side panel (#activity-feed) with active agent cards at top, recently completed cards below, and existing event feed collapsed into a secondary log tab

### A-125: Wire SSE agent events to card lifecycle
**Status:** PENDING
**Review:** approved
**Produces:** Client-side handlers for agent-start, agent-update, agent-complete SSE events that create, update, and transition cards in real-time

### A-126: Persist card state across navigation and refresh
**Status:** PENDING
**Review:** approved
**Produces:** Client-side state management fed by /api/agents endpoint on load so cards survive route changes and page refreshes
