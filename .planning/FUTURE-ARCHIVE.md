# Future Archive: get-shit-done

---

## Archived: v1.0 — 2026-02-21

**Cycle focus:** Foundational workflow — planning pipeline, lifecycle, quality loops, dashboard, declare namespace

## D-01: Full Planning Pipeline
**Statement:** Declare has the full depth of GSD's planning pipeline — context capture per milestone, domain research, planner + plan-checker verification loop — so every execution is informed and verified before it starts.
**Status:** DONE
**Milestones:** M-01, M-02, M-03

## D-02: Complete Project Lifecycle
**Statement:** Declare handles the complete project lifecycle — map codebase, init project, complete milestones with archiving and git tags, start new milestone cycles — from first declaration through shipping.
**Status:** DONE
**Milestones:** M-04, M-05, M-06, M-07

## D-03: Post-Execution Quality Loops
**Statement:** Declare has post-execution quality loops — conversational UAT, systematic debugging with persistent state, milestone auditing — so issues are caught and resolved before a milestone is declared complete.
**Status:** DONE
**Milestones:** M-08, M-09, M-10

## D-04: Web Dashboard
**Statement:** A localhost web dashboard renders the live DAG — declarations, milestones, actions, integrity status, performance scores — browsable and interactive in a browser.
**Status:** DONE
**Milestones:** M-11, M-12, M-13

## D-05: Full Declare Namespace
**Statement:** Every GSD utility exists in Declare's namespace — quick tasks, todos, session pause/resume, settings, health checks — so the full workflow runs without ever touching a /gsd:* command.
**Status:** DONE
**Milestones:** M-14, M-15, M-16, M-17

---

## Archived: v2.0 — 2026-02-22

**Cycle focus:** Browser-first UX — column browser, review/annotation, execution pipeline, integrity model, global CLI

## D-06: UI as Primary Surface
**Statement:** The Declare workflow is experienced entirely through the browser UI — declarations emerge in-view as you work, you accept or adjust them inline, milestones derive and appear next, then actions — the process drives you forward without ever switching to a terminal.
**Status:** DONE
**Milestones:** M-18, M-19, M-20, M-21, M-39

## D-07: Human/Agent Clarity
**Statement:** During planning, milestones are explicitly classified as agent-time or human-bound, with dependencies declared between them. Agent-time milestones are prioritized and run first — they prepare the outputs and context that human-bound milestones depend on — and when conditions are met, a play action executes all autonomous work in dependency order without interruption.
**Status:** DONE
**Milestones:** M-22, M-23, M-24, M-25, M-38

## D-08: Live Execution Visibility
**Statement:** As agents execute, their work is visible in real-time in the UI — progress streams, produced files are openable inline with full markdown rendering, and commit outputs are linked — so the human sees results as they emerge without leaving the interface.
**Status:** DONE
**Milestones:** M-26, M-27, M-28, M-29, M-40, M-41

## D-09: Cross-Project References
**Statement:** A declare node can reference an external project by repo URL or local folder path, so related work across separate repositories or directories is linkable from the graph — whether the sub-project runs locally or remotely is up to the operator.
**Status:** DONE
**Milestones:** M-30

## D-10: Integrity as Architecture
**Statement:** The Declare system is built on the Erhard model of integrity — every declaration is a word given, every node shows its wholeness state, and the UI's primary function is to reveal where the project is whole and complete versus where integrity is diminished — so the path to full workability is always visible and actionable.
**Status:** DONE
**Milestones:** M-31, M-32, M-33

## D-11: Global CLI
**Statement:** declare is a global command that opens the dashboard for the current directory — declare and declare . are equivalent — showing the project's live state or prompting to initialize if empty. Subcommands like declare /path/to/project or declare serve extend it, but the default invocation is always: open and show.
**Status:** DONE
**Milestones:** M-34, M-35

## D-12: Mesh Integration
**Statement:** The Declare dashboard runs as a local daemon that registers with the mesh daemon. The mesh UI discovers active declare projects and renders the dashboard inline as a declare plugin — giving cross-project visibility and control from a single surface without leaving mesh.
**Status:** DEFERRED
**Milestones:** M-36, M-37
**Note:** Deferred — depends on external mesh daemon project, out of scope for 1.0.

## D-13: Plan Verification Before Execution
**Statement:** Every plan artifact — declaration, milestone, action EXEC-PLAN — passes through explicit human review with inline annotation before becoming executable. The UI supports iterative review cycles: generate plan → annotate with corrections → send back for revision → repeat until approved. Nothing runs until the human says the plan is tight. The review state (draft/in-review/revision-needed/approved) is tracked per node and gates execution.
**Status:** DONE
**Milestones:** M-43, M-44, M-45, M-46

## D-14: Planning and Execution Are Distinct UX Modes
**Statement:** Planning and execution are separate UX modes with an explicit transition. Planning mode uses the column browser as its primary view — you walk D → M → A reviewing and approving each artifact, with the review/annotation panel on the right. When all plans in scope are approved, you transition to Execution mode — a dedicated full-screen view showing the ordered execution pipeline, a single "Go" button, and large progress display. You cannot execute from planning mode; you cannot edit plans from execution mode.
**Status:** DONE
**Milestones:** M-47, M-48, M-49

## D-15: Autonomous Execution to Completion
**Statement:** Once the plan is verified and the execution order confirmed, a single "Go" runs the entire pipeline to completion without human intervention — because the plan was tight and reviewed. The execution view shows wave progress, live output, and a CI-pipeline-style display. If a critical failure occurs, execution pauses and offers skip-and-continue or stop — but the default path is uninterrupted completion.
**Status:** DONE
**Milestones:** M-50, M-51, M-52

## D-19: Full-Lifecycle E2E Proof (Merged into D-17)
**Statement:** A Playwright-based headed browser test creates a complete to-do list application from scratch using the Declare dashboard — from declaring the first future through project completion — proving the full lifecycle works and serving as a living demo of the product.
**Status:** MERGED
**Milestones:** M-57, M-58
**Note:** Merged into D-17 (Quality Gate Infrastructure) — both declarations address E2E testing.
