# Plan: M-44 -- Inline annotation UX in column browser

**Milestone:** M-44
**Realizes:** D-13
**Status:** PENDING
**Derived:** 2026-02-22

## Actions

### A-92: Add annotation storage and API
**Status:** PENDING
**Produces:** Annotation model (per-node, per-line comments with author/timestamp) stored as .planning/milestones/M-XX/annotations.json, with POST/GET/DELETE /api/node/:id/annotations endpoints

### A-93: Build annotation panel in column browser right pane
**Status:** PENDING
**Produces:** Right pane shows artifact content with clickable line-level annotation markers — click to add comment, see existing comments inline, delete resolved ones

### A-94: Wire annotations to review state transitions
**Status:** PENDING
**Produces:** Adding annotation auto-transitions node to revision-needed; resolving all annotations enables transition to approved
