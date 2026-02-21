# Plan: M-36 -- Declare daemon with mesh registration

**Milestone:** M-36
**Realizes:** D-12
**Status:** PENDING
**Derived:** 2026-02-21

## Actions

### A-75: Add mesh registration to the local server
**Status:** PENDING
**Produces:** On server start, POST to mesh daemon announcing project name, port, and health endpoint; deregister on stop

### A-76: Add health and metadata endpoint
**Status:** PENDING
**Produces:** GET /api/meta returning project name, port, dashboard URL, and git remote for mesh discovery
