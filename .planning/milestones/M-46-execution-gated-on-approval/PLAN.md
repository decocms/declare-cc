# Plan: M-46 -- Execution gated on approval

**Milestone:** M-46
**Realizes:** D-13
**Status:** DONE
**Derived:** 2026-02-22

## Actions

### A-98: Add approval gate to execute API endpoints
**Status:** DONE
**Produces:** POST /api/action/:id/execute and POST /api/play reject with 403 if any in-scope action has reviewState not approved — returns list of unapproved nodes in error response

### A-99: Disable execute controls in UI for unapproved nodes
**Status:** DONE
**Produces:** Execute and Play All buttons visually disabled (grayed out) when any action in scope is not approved — tooltip shows N plans need approval before execution
