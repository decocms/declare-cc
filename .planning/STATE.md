# State

## Current Position
Starting v2.0 rewrite. All declarations and milestones defined. Ready to begin execution.

## Execution Order
Phase 1 — Foundation (M-01 → M-02 → M-03 → M-04 → M-05): scaffold, engine, parsers, API, E2E harness
Phase 2 — Dashboard (M-06 → M-07 → M-12 → M-14): lifecycle view, cards, onboarding, agent monitor
Phase 3 — Integration (M-08 → M-09 → M-10 → M-11): CLI, agent runner, meta-prompts, MCP
Phase 4 — Verification (M-13 → M-15): full lifecycle E2E, production build

## Decisions
- Stack: Bun + Vite + React 19 + Hono + Tailwind 4 + @deco/ui (matching Mesh)
- MCP-first: every operation is an MCP tool, dashboard and CLI are just clients
- Test-first: E2E harness in Phase 1, lifecycle test in Phase 4
- Copy @deco/ui components directly from mesh, adapt as needed
- Dark mode only (Track 2 — AI Platform palette)
