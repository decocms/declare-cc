# Declare v2.0

## What This Is

A **future-driven meta-prompting engine** for agentic development. Instead of planning from past to future, you declare what's true when you succeed, then derive backward what must happen to make reality match.

**Dual use:**
1. **Claude Code plugin** — `/declare:*` slash commands in the TUI
2. **Web dashboard** — `npx dcl` launches a beautiful visual guide through the full lifecycle: onboard → vision → questions → declarations → milestones → actions → execute → verify

Both experiences are identical in capability; the dashboard just adds visual guidance.

## Philosophy

Rooted in **Integrity** (the ontological model): a system has integrity when it is whole and complete, nothing hidden. Declarations are your word about the future. Milestones realize declarations. Actions cause milestones. The graph computes **wholeness** bottom-up — are you on track to make your declared future real?

When you can't keep your word (a declaration changes), you **honor** it: acknowledge, inform, clean up.

## Architecture

### Core Data Model: Three-Layer DAG
```
Declarations (D-XX)  ←realizes─  Milestones (M-XX)  ←causes─  Actions (A-XX)
   "what's true"                  "what must be true"           "what to do"
```

Edges flow upward only. No cycles. Wholeness computes bottom-up.

### Stack (matching Mesh/Deco ecosystem)
- **Runtime**: Bun
- **Frontend**: React 19 + Vite + TanStack Router + TanStack Query
- **UI**: @deco/ui (Radix primitives + Tailwind 4) — copy components from mesh
- **Styling**: Tailwind CSS 4 with OKLCH design tokens (dual-track: light + dark with system auto-detect)
- **Backend**: Hono (lightweight HTTP) + SSE for real-time
- **AI**: Vercel AI SDK (@ai-sdk) for streaming agent output
- **MCP**: @modelcontextprotocol/sdk — expose prompts, resources, tools
- **Testing**: Playwright (E2E from day one) + Vitest (unit)
- **Build**: Vite for client, Bun for server, esbuild for CLI bundle

### Source of Truth
Markdown files in `.planning/` — git-tracked, human-editable:
- `FUTURE.md` — Declarations
- `MILESTONES.md` — Milestone table
- `milestones/M-XX-slug/PLAN.md` — Actions per milestone
- `PROJECT.md`, `STATE.md` — Context

### MCP Server
Exposes the full workflow engine:
- **Resources**: meta-prompts (workflows), project state, graph snapshot
- **Tools**: add-declaration, derive-milestones, execute-action, verify, etc.
- **Prompts**: onboarding, vision-to-declarations, milestone-derivation, action-planning

This lets Mesh's decopilot agent connect and drive the full declare lifecycle via MCP.

### Agent Architecture
- Spawn Claude subagents for derivation, execution, verification
- Dashboard shows running agents, their prompts, streaming output
- Agents can also be invoked by decopilot through MCP tools

## Folder Structure
```
dcl/
├── src/
│   ├── core/                    # The engine (zero-dep, reusable)
│   │   ├── dag.ts               # DeclareDag class (~500 lines)
│   │   ├── artifacts/           # Markdown parsers/writers
│   │   │   ├── future.ts
│   │   │   ├── milestones.ts
│   │   │   └── plan.ts
│   │   ├── graph.ts             # buildGraph() from disk
│   │   └── wholeness.ts         # Bottom-up integrity computation
│   │
│   ├── server/                  # Hono API + SSE
│   │   ├── index.ts             # Routes, middleware
│   │   ├── routes/              # Route handlers by domain
│   │   │   ├── graph.ts
│   │   │   ├── mutations.ts
│   │   │   └── agents.ts
│   │   └── sse.ts               # SSE broadcast
│   │
│   ├── app/                     # React dashboard
│   │   ├── routes/              # TanStack Router file-based routes
│   │   │   ├── __root.tsx
│   │   │   ├── index.tsx        # Main lifecycle view
│   │   │   └── agents.tsx       # Agent monitor
│   │   ├── components/          # Copied/adapted from @deco/ui
│   │   │   ├── declaration-card.tsx
│   │   │   ├── milestone-card.tsx
│   │   │   ├── action-card.tsx
│   │   │   ├── lifecycle-view.tsx
│   │   │   ├── agent-panel.tsx
│   │   │   └── onboarding/
│   │   ├── hooks/
│   │   │   ├── use-graph.ts     # React Query + SSE
│   │   │   └── use-agents.ts
│   │   └── styles/
│   │       └── tokens.css       # OKLCH design tokens
│   │
│   ├── mcp/                     # MCP server
│   │   ├── server.ts            # MCP server setup
│   │   ├── tools.ts             # Tool definitions
│   │   ├── resources.ts         # Resource providers
│   │   └── prompts.ts           # Prompt templates
│   │
│   ├── agents/                  # Agent definitions (markdown + runner)
│   │   ├── prompts/             # Meta-prompts (the learning resource)
│   │   │   ├── 01-vision.md
│   │   │   ├── 02-declarations.md
│   │   │   ├── 03-milestones.md
│   │   │   ├── 04-actions.md
│   │   │   ├── 05-execution.md
│   │   │   └── 06-verification.md
│   │   └── runner.ts            # Agent spawn + stream
│   │
│   └── cli/                     # CLI entry point
│       └── index.ts             # dcl command dispatcher
│
├── tests/
│   ├── e2e/                     # Playwright E2E (full lifecycle)
│   │   └── lifecycle.spec.ts
│   └── unit/                    # Vitest unit tests
│       ├── dag.test.ts
│       └── artifacts.test.ts
│
├── .planning/                   # Declare's own declarations
├── package.json
├── vite.config.ts
├── tsconfig.json
└── playwright.config.ts
```

## Design Principles
1. **Simple enough to read in an afternoon** — under 5k lines total
2. **Meta-prompts are first-class** — in `agents/prompts/`, readable, educational
3. **One component per concept** — declaration-card, milestone-card, action-card
4. **Cohesive UX** — same @deco/ui components everywhere, no special-case styles
5. **Test-first** — E2E lifecycle test before any feature code
6. **MCP-native** — every operation available as MCP tool/resource
