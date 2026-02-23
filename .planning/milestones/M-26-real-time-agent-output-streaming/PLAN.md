# Plan: M-26 -- Real-time agent output streaming

**Milestone:** M-26
**Realizes:** D-08
**Status:** DONE
**Derived:** 2026-02-21

## Actions

### A-54: Build agent subprocess runner with token budget enforcement
**Status:** DONE
**Produces:** Server-side runner wrapping claude invocations with max-tokens per action, tagging output by action ID

### A-55: Add SSE streaming endpoint to server
**Status:** DONE
**Produces:** GET /api/stream multiplexing output across concurrent agent runs

### A-56: Build live output panel in the UI
**Status:** DONE
**Produces:** Real-time panel subscribed to SSE scoped per action or milestone
