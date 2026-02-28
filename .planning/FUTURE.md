# Future: Declare v2.0

## D-01: The full declaration lifecycle runs end-to-end with zero errors
**Statement:** A user can run `npx dcl`, go through onboarding, declare futures, derive milestones, plan actions, execute them, and verify completion — all from the web dashboard — without encountering any runtime errors, broken states, or dead-end screens.
**Why:** This is the minimum foundation. Without a working end-to-end lifecycle, nothing else matters.
**Review:** approved

## D-02: Every user interaction is visually cohesive and uses shared components
**Statement:** All cards (declarations, milestones, actions) use the same component patterns. Approve, Edit, Delete actions look and behave identically at every level. Batch operations work uniformly. There are no special-case styles or one-off UI patterns.
**Why:** v1's UX is an amalgamation of iterations — the approve flow for declarations differs from milestones, batch buttons appear inconsistently. Cohesion requires shared components from the start.
**Review:** approved

## D-03: The meta-prompts are readable, educational, and capture best practices from GSD
**Statement:** All workflow prompts (research, vision, declarations, milestones, actions, execution, verification) live as standalone markdown files in `src/agents/prompts/`. Each is self-contained and doubles as a learning resource. They encode GSD's best practices: research-before-plan, precise task specs with verification, stub detection, and E2E-first thinking.
**Why:** Declare's core value is its prompting methodology. The prompts must capture everything that made GSD effective — parallel research, must-haves in plans, deep verification — in a cleaner, more discoverable format.
**Review:** approved

## D-04: The system is accessible via MCP, CLI, and web dashboard with identical capability
**Statement:** Every operation (add declaration, derive milestones, execute action, verify) is available through three interfaces: MCP tools/resources (for agents), CLI commands (for Claude Code TUI), and the web dashboard (for visual users). No interface is a second-class citizen.
**Why:** Dual-use (CLI + web) was always the goal. Adding MCP as a first-class interface means any MCP-compatible agent can drive the full lifecycle.
**Review:** approved

## D-05: Agent spawning, monitoring, and output streaming work reliably
**Statement:** Users can spawn derivation/execution/verification agents from the dashboard, see which agents are running with their prompts, watch streaming output in real-time, and get notified when agents complete. Agents within the same wave run concurrently. Agent state persists across page refreshes.
**Why:** Agent visibility is the most valuable dashboard feature. Seeing what the AI is doing, with what prompt, and being able to course-correct is essential to trust.
**Review:** approved

## D-06: The codebase is under 10,000 lines and navigable in an afternoon
**Statement:** The total source code (core engine, server, dashboard, CLI, MCP server, prompts) is under 10,000 lines of TypeScript. The folder structure maps 1:1 to concepts (core/, server/, app/, mcp/, agents/, cli/). A developer can read and understand the entire system in a single sitting.
**Why:** v1 grew to ~25k lines through accretion. v2 has a 10k budget — enough for GSD-grade prompts and research capability without losing navigability.
**Review:** approved

## D-07: E2E tests cover the full lifecycle and the system promotes testability
**Statement:** A Playwright test suite runs the complete declaration lifecycle against the actual dashboard. The system also actively promotes E2E testing in projects it manages — execution prompts suggest tests, verification checks for test coverage, and research identifies testing infrastructure early.
**Why:** You can't develop something you can't test. Having E2E is crucial — both for dcl itself and as a practice dcl instills in every project it manages.
**Review:** approved
