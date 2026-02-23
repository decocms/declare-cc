# Plan: M-50 -- Execution order configuration

**Milestone:** M-50
**Realizes:** D-15
**Status:** DONE
**Derived:** 2026-02-22

## Actions

### A-108: Build pre-execution wave order view
**Status:** DONE
**Review:** approved
**Produces:** View showing computed wave order (milestones grouped by dependency waves, actions within each) as ordered list — displayed after entering execution mode, before Execute button is available

### A-109: Add reorder capability within dependency constraints
**Status:** DONE
**Review:** approved
**Produces:** Drag-to-reorder within a wave (actions within same milestone, milestones within same wave) — dependency violations prevented with visual feedback — cross-wave reordering blocked

### A-110: Persist execution manifest
**Status:** DONE
**Review:** approved
**Produces:** Confirmed execution order saved as .planning/execution-manifest.json with wave structure, milestone order, action order — reusable for re-runs
