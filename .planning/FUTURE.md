# Future: declare-cc

## D-12: Mesh Integration
**Statement:** The Declare dashboard runs as a local daemon that registers with the mesh daemon. The mesh UI discovers active declare projects and renders the dashboard inline as a declare plugin — giving cross-project visibility and control from a single surface without leaving mesh.
**Status:** PENDING
**Review:** approved
**Milestones:** M-36, M-37

## D-16: Real-Time Agent Presence
**Statement:** Every agent spawn — execution, revision, derivation, research — appears instantly as a persistent activity card in the dashboard topbar. Cards show the agent type, target node, elapsed time, and live status. Cards survive page refresh and navigation — you can browse other parts of the dashboard, come back, and the card is still there with its current state. When an agent completes, the card transitions to a "done" state with a click-to-navigate action that jumps you to the result — the revised plan, the derived milestones, the execution output. The activity surface is the single source of truth for everything the system is doing right now and everything it just finished.
**Status:** DONE
**Review:** approved
**Milestones:** M-43, M-44, M-45

## D-17: Quality Gate Infrastructure
**Statement:** The Declare project has automated quality gates — E2E tests covering the full D→M→A lifecycle via the HTTP API, with a CI-compatible test runner — so regressions are caught before they ship.
**Status:** PENDING
**Review:** approved
**Milestones:** M-42
