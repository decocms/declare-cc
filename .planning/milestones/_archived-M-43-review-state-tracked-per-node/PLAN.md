# Plan: M-43 -- Review state tracked per node

**Milestone:** M-43
**Realizes:** D-13
**Status:** DONE
**Derived:** 2026-02-22

## Actions

### A-89: Add reviewState field to graph engine and artifact parsers
**Status:** DONE
**Review:** approved
**Produces:** reviewState (draft/in-review/revision-needed/approved) on every D, M, A node in DeclareDag, persisted in FUTURE.md, MILESTONES.md, and PLAN.md with parser/writer support

### A-90: Add review state API endpoints
**Status:** DONE
**Review:** approved
**Produces:** PUT /api/node/:id/review-state endpoint + reviewState included in /api/graph response for all nodes

### A-91: Surface review badges in column browser and DAG view
**Status:** DONE
**Review:** approved
**Produces:** Visual review state badge (color-coded) on every node in both column browser items and DAG node cards
