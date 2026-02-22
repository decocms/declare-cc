---
milestone: M-20
action: A-41
subsystem: frontend
tags: [ui, derivation, actions, sse]
dependency-graph:
  requires: [A-40, derivation-panel-css]
  provides: [action-derivation-ui]
  affects: [app.js]
tech-stack:
  added: []
  patterns: [sse-event-handler, editable-checklist, streaming-log]
key-files:
  created: []
  modified:
    - src/server/public/app.js
    - dist/public/app.js
    - dist/declare-tools.cjs
decisions:
  - Reused existing derivation-panel CSS class and derivation-checklist styles
  - Action proposals show both produces and reason fields (milestone derivation only showed reason)
  - Button wired in milestone panel rendering via event listener (same pattern as declaration derive)
metrics:
  duration: ~10min
  completed: 2026-02-22
---

# Milestone [M-20] Action [A-41]: Build per-milestone action derivation UI Summary

Streaming action derivation UI on milestone detail panels with editable checklist and accept/cancel flow.

## What Was Built

### Milestone Detail Panel
- "Derive Actions" button added to every milestone detail panel (in the side panel)
- Reuses `.derivation-panel` CSS styling from milestone derivation
- Button disables during derivation, shows "Deriving..." state

### Streaming Log
- `action-derivation-log` element shows real-time Claude CLI output
- Subscribes to `action-derivation-output` SSE events
- Auto-scrolls to bottom as new lines arrive

### Proposal Checklist
- On `action-derivation-complete`, parses JSON array of proposed actions
- Renders editable checklist with checkboxes, editable title inputs
- Shows "Produces" and "Reason" fields for each proposal
- Accept button POSTs selected actions to `/api/milestones/:id/actions/derive/accept`
- Cancel button stops running derivation and clears UI

### SSE Integration
- `handleActionDerivationOutput` and `handleActionDerivationComplete` registered in `connectSSE()`
- Session ID tracking prevents stale events from affecting UI

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

- `3ed5d11`: feat(M-20-A-41): build per-milestone action derivation UI

## Self-Check: PASSED
