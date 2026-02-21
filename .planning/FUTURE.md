# Future: declare-cc

## D-06: UI as Primary Surface
**Statement:** The Declare workflow is experienced entirely through the browser UI — declarations emerge in-view as you work, you accept or adjust them inline, milestones derive and appear next, then actions — the process drives you forward without ever switching to a terminal.
**Status:** PENDING
**Milestones:** M-18, M-19, M-20, M-21

## D-07: Human/Agent Clarity
**Statement:** During planning, milestones are explicitly classified as agent-time or human-bound, with dependencies declared between them. Agent-time milestones are prioritized and run first — they prepare the outputs and context that human-bound milestones depend on — and when conditions are met, a play action executes all autonomous work in dependency order without interruption.
**Status:** PENDING
**Milestones:** M-22, M-23, M-24, M-25

## D-08: Live Execution Visibility
**Statement:** As agents execute, their work is visible in real-time in the UI — progress streams, produced files are openable inline with full markdown rendering, and commit outputs are linked — so the human sees results as they emerge without leaving the interface.
**Status:** PENDING
**Milestones:** M-26, M-27, M-28, M-29

## D-09: Cross-Project References
**Statement:** A declare node can reference an external project by repo URL or local folder path, so related work across separate repositories or directories is linkable from the graph — whether the sub-project runs locally or remotely is up to the operator.
**Status:** PENDING
**Milestones:** M-30

## D-10: Integrity as Architecture
**Statement:** The Declare system is built on the Erhard model of integrity — every declaration is a word given, every node shows its wholeness state, and the UI's primary function is to reveal where the project is whole and complete versus where integrity is diminished — so the path to full workability is always visible and actionable.
**Status:** PENDING
**Milestones:** M-31, M-32, M-33

## D-11: Global CLI
**Statement:** declare is a global command that opens the dashboard for the current directory — declare and declare . are equivalent — showing the project's live state or prompting to initialize if empty. Subcommands like declare /path/to/project or declare serve extend it, but the default invocation is always: open and show.
**Status:** PENDING
**Milestones:** M-34, M-35

## D-12: Mesh Integration
**Statement:** The Declare dashboard runs as a local daemon that registers with the mesh daemon. The mesh UI discovers active declare projects and renders the dashboard inline as a declare plugin — giving cross-project visibility and control from a single surface without leaving mesh.
**Status:** PENDING
**Milestones:** 
