---
milestone: M-22
action: A-45
subsystem: schema
tags: [milestones, classification, parser, CJS]

requires:
  - milestone: M-11
    provides: DAG web server and milestone parsing
provides:
  - classification field (agent|human) on milestone schema
  - dependsOn field on milestone schema
  - backward-compatible MILESTONES.md parser
affects: [M-23, M-24, M-25]

tech-stack:
  added: []
  patterns: [conditional column rendering in markdown tables]

key-files:
  created: []
  modified:
    - src/artifacts/milestones.js
    - src/commands/build-dag.js
    - src/commands/load-graph.js

key-decisions:
  - "Default classification is 'agent' for backward compatibility"
  - "Classification and Depends On columns only written when non-default values exist"
  - "dependsOn stored as comma-separated M-XX IDs in MILESTONES.md table"

completed: 2026-02-22
---

# Milestone [M-22] Action [A-45]: Add classification field to milestone schema Summary

**Milestone classification (agent/human) and dependsOn fields added to MILESTONES.md parser with backward-compatible conditional columns**

## Accomplishments
- Parse Classification column (agent|human, default: agent) from MILESTONES.md
- Parse Depends On column (comma-separated M-XX IDs) from MILESTONES.md
- Write both columns conditionally when non-default values present
- Pass classification and dependsOn to DAG node metadata
- Expose both fields in /api/graph response

## Task Commits

1. **A-45: Schema fields** - `0147213` (feat)

## Files Modified
- `src/artifacts/milestones.js` - Added classification and dependsOn parsing/writing
- `src/commands/build-dag.js` - Pass classification and dependsOn to DAG metadata
- `src/commands/load-graph.js` - Expose classification and dependsOn in API response

## Deviations from Plan

None - plan executed exactly as written.

---
*Milestone: M-22*
*Completed: 2026-02-22*
