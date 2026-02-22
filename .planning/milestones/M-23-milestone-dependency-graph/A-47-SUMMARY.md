---
milestone: M-23
action: A-47
subsystem: schema
tags: [milestones, dependencies, DAG, edges]

requires:
  - action: A-45
    provides: dependsOn field in milestone schema
provides:
  - M->M dependency edges in MILESTONES.md
  - PUT /api/milestones/:id/depends-on API route
  - dependency validation (no self-deps, referenced milestones must exist)
affects: [M-24, M-25]

key-files:
  modified:
    - src/artifacts/milestones.js
    - src/server/index.js

completed: 2026-02-22
---

# Milestone [M-23] Action [A-47]: Add M-to-M dependency edges to schema Summary

**Milestone dependency declarations via dependsOn field in MILESTONES.md with PUT API route and validation**

## Accomplishments
- dependsOn field parsed from MILESTONES.md Depends On column
- PUT /api/milestones/:id/depends-on route with validation
- Self-dependency prevention
- Referenced milestone existence validation

## Task Commits

Implemented as part of A-45 (`0147213`) and A-46 (`745e929`) commits.

## Deviations from Plan

Implemented together with A-45 and A-46 since the schema and API changes are tightly coupled.

---
*Milestone: M-23*
*Completed: 2026-02-22*
