# Future: Declare v2.0

## D-01: The full declaration lifecycle runs end-to-end with zero errors
**Statement:** A user can run `npx dcl`, go through onboarding, declare futures, derive milestones, plan actions, execute them, and verify completion — all from the web dashboard — without encountering any runtime errors, broken states, or dead-end screens.
**Why:** This is the minimum foundation. Without a working end-to-end lifecycle, nothing else matters. The current v1 accumulated inconsistencies (approve-all button differences, missing batch actions, broken navigation) because it was never tested as a single flow.
**Review:** approved

## D-02: Every user interaction is visually cohesive and uses shared components
**Statement:** All cards (declarations, milestones, actions) use the same component patterns from @deco/ui. Approve, Edit, Delete actions look and behave identically at every level. Batch operations work uniformly. There are no special-case styles or one-off UI patterns.
**Why:** v1's UX is an amalgamation of iterations — the approve flow for declarations differs from milestones, batch buttons appear inconsistently, styling varies between views. Cohesion requires shared components from the start, not retrofit.
**Review:** approved

## D-03: The meta-prompts are readable, educational, and discoverable
**Statement:** All workflow prompts (vision, declarations, milestones, actions, execution, verification) live as standalone markdown files in `src/agents/prompts/`. Each is self-contained, well-documented, and doubles as a learning resource for meta-prompting. They are exposed as MCP resources so any agent can read them.
**Why:** Declare's core value is its prompting methodology. If the prompts are buried in code, the system is just another tool. If they're readable and educational, it becomes a teaching platform for declarative AI development.
**Review:** approved

## D-04: The system is accessible via MCP, CLI, and web dashboard with identical capability
**Statement:** Every operation (add declaration, derive milestones, execute action, verify) is available through three interfaces: MCP tools/resources (for decopilot and other agents), CLI commands (for Claude Code TUI), and the web dashboard (for visual users). No interface is a second-class citizen.
**Why:** Dual-use (CLI + web) was always the goal, but v1's web dashboard lagged behind the CLI in capability. Adding MCP as a first-class interface means any MCP-compatible agent (including Mesh's decopilot) can drive the full lifecycle.
**Review:** approved

## D-05: Agent spawning, monitoring, and output streaming work reliably
**Statement:** Users can spawn derivation/execution/verification agents from the dashboard, see which agents are running with their prompts, watch streaming output in real-time, and get notified when agents complete. Agent state persists across page refreshes.
**Why:** Agent visibility was the most valuable feature in v1's dashboard. Seeing what the AI is doing, with what prompt, and being able to course-correct is essential to trust. This must work flawlessly from v2.0.
**Review:** approved

## D-06: The codebase is under 5,000 lines and navigable in an afternoon
**Statement:** The total source code (core engine, server, dashboard, CLI, MCP server) is under 5,000 lines of TypeScript. The folder structure maps 1:1 to concepts (core/, server/, app/, mcp/, agents/, cli/). A developer can read and understand the entire system in a single sitting.
**Why:** v1 grew to ~25k lines through accretion. Most of that is convenience and automation that obscured the elegant core. v2 starts from the premise that simplicity is a feature — the system should be as small as the ideas it implements.
**Review:** approved

## D-07: E2E tests cover the full lifecycle before any feature is built
**Statement:** A Playwright test suite runs the complete declaration lifecycle (init → declare → derive → plan → execute → verify) against the actual dashboard. Tests run in CI on every commit. No feature is merged without passing E2E coverage.
**Why:** v1 had no E2E tests until late in development, which is exactly why inconsistencies accumulated. Test-first means the lifecycle definition IS the specification, and regressions are caught immediately.
**Review:** approved
