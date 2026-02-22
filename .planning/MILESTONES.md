# Milestones: declare-cc

## Milestones

| ID   | Title                                        | Description                                                                | Status  | Realizes | Plan |
|------|----------------------------------------------|----------------------------------------------------------------------------|---------|----------|------|
| M-18 | Browser-based declaration capture            | Capture and edit declarations directly in the browser dashboard            | DONE    | D-06     | YES  |
| M-19 | Browser-based milestone derivation           | Derive milestones from declarations via agent invocation in the browser    | DONE    | D-06     | YES  |
| M-20 | Browser-based action derivation              | Derive actions per milestone via scoped agent invocation in the browser    | DONE    | D-06     | YES  |
| M-21 | UI workflow state machine                    | State machine driving the D-M-A workflow progression in the UI            | DONE    | D-06     | YES  |
| M-22 | Milestone classification in planning         | Classify milestones as agent-time or human-bound during planning           | DONE    | D-07     | YES  |
| M-23 | Milestone dependency graph                   | Declare and visualize dependencies between milestones in the DAG          | DONE    | D-07     | YES  |
| M-24 | Readiness state per milestone                | Compute and display readiness state based on dependency completion         | DONE    | D-07     | YES  |
| M-25 | Play action for autonomous execution         | One-click execution of all ready agent-time milestones in dependency order | DONE    | D-07     | YES  |
| M-26 | Real-time agent output streaming             | Stream agent output in real-time to the dashboard during execution         | DONE    | D-08     | YES  |
| M-27 | Inline file viewer with markdown rendering   | View produced files inline with full markdown rendering                    | DONE    | D-08     | YES  |
| M-28 | Commit and output linking per action         | Link commit SHAs and output files to each action in the dashboard         | DONE    | D-08     | YES  |
| M-29 | Execution log per milestone                  | Persistent timestamped execution log per milestone                        | DONE    | D-08     | YES  |
| M-30 | Reference field on declare nodes             | Reference external projects by URL or path from any declaration node      | DONE    | D-09     | YES  |
| M-31 | Wholeness state computed per node            | Compute wholeness state (whole/partial/broken) for every DAG node         | DONE    | D-10     | YES  |
| M-32 | Integrity visualization in the dashboard     | Visualize integrity with colored borders, dots, and percentage in status bar | DONE  | D-10     | YES  |
| M-33 | Workability path surface                     | Trace diminished integrity to root causes and show actionable fix steps   | DONE    | D-10     | YES  |
| M-34 | declare global binary                        | Install declare as a global npm binary accessible from any directory      | DONE    | D-11     | YES  |
| M-35 | Default open behavior                        | Running declare with no args opens the dashboard for the current project  | DONE    | D-11     | YES  |
| M-36 | Declare daemon with mesh registration        | Local daemon that registers the declare project with the mesh network     | PENDING | D-12     | YES  |
| M-37 | Mesh declare plugin                          | Mesh UI plugin discovering and embedding declare dashboards inline        | PENDING | D-12     | YES  |
| M-38 | Model-aware agent dispatch                   | Each agent role dispatches to the optimal model (opus/sonnet/haiku)       | DONE    | D-07     | YES  |
| M-39 | Tri-part column browser for D-M-A navigation | Three-column Finder-style browser for navigating D-M-A hierarchy         | DONE    | D-06     | YES  |
| M-40 | Live activity topbar with jump-to-operation  | Persistent topbar showing the current running operation with click-to-jump | DONE    | D-08     | YES  |
| M-41 | Execute actions from dashboard               | Execute and stop actions from the dashboard with live output streaming    | DONE    | D-08     | YES  |
| M-42 | Full-cycle E2E test suite                    | E2E test exercising complete D-M-A lifecycle through the HTTP API        | PENDING | D-06     | NO   |
