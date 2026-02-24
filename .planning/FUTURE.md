# Future: declare-cc

## D-16: Real-Time Agent Presence
**Statement:** Every agent spawn — execution, revision, derivation, research — appears instantly as a persistent activity card in the dashboard topbar. Cards show the agent type, target node, elapsed time, and live status. Cards survive page refresh and navigation — you can browse other parts of the dashboard, come back, and the card is still there with its current state. When an agent completes, the card transitions to a "done" state with a click-to-navigate action that jumps you to the result — the revised plan, the derived milestones, the execution output. The activity surface is the single source of truth for everything the system is doing right now and everything it just finished.
**Status:** DONE
**Review:** approved
**Milestones:** M-43, M-44, M-45

## D-17: Quality Gate Infrastructure
**Statement:** The Declare project has automated quality gates — E2E tests covering the full D→M→A lifecycle via the HTTP API and a Playwright-based headed browser test that creates a complete application from scratch using the dashboard, proving the full lifecycle works end-to-end. A CI-compatible test runner ensures regressions are caught before they ship.
**Status:** PENDING
**Review:** approved
**Milestones:** M-42, M-53, M-57, M-58

## D-18: Lifecycle Stage Dashboard
**Statement:** The Declare dashboard organizes every project item by lifecycle stage — Needs Planning, Needs Approval, Ready to Execute, In Execution, and Done — so users always see what needs attention now and items flow visually downward through stages as they progress. Empty projects show guided onboarding, and the Next action always knows the single most important thing to do.
**Status:** PENDING
**Review:** approved
**Milestones:** M-54, M-55, M-56

## D-20: Release Polish
**Statement:** The Declare dashboard handles edge cases, errors, and visual transitions at production quality — stale connections reconnect, errors show recovery paths, and lifecycle stage transitions animate smoothly.
**Status:** PENDING
**Review:** approved
**Milestones:** M-59, M-60
