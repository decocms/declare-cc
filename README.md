# Declare

**Future-driven development for AI agents.**

Declare flips the script on project planning. Instead of task lists, you write **declarations** — verifiable statements about what will be true when your project succeeds. AI agents then derive milestones, plan actions, execute code, and verify results — all traceable back to the future you declared.

```
npx dcl
```

## Why Declare

**You don't manage tasks. You declare futures.**

Most planning tools track what you're *doing*. Declare tracks what must be *true*. This distinction matters because:

- **Declarations are verifiable.** "Users can log in via OAuth" is either true or false. "Implement auth" is vague forever.
- **Milestones are states, not tasks.** "The database supports multi-tenancy" vs "design the schema." States can be checked; tasks just get checked off.
- **Actions have causal context.** Every action knows *why* it exists — which milestone it advances, which declaration it ultimately serves. Agents never lose the plot.
- **Verification is honest.** The verifier checks if the *outcome* holds, not if actions were completed. Stub implementations get flagged. Empty files get caught.

## How it works

```
Declaration (what must be true)
  └── Milestone (what state must hold)
       └── Action (what to do, with verify command)
```

1. **Declare** — Write present-tense statements about your project's future
2. **Derive** — AI breaks each declaration into verifiable milestones
3. **Plan** — AI plans concrete actions with files, verify commands, and wave assignments
4. **Execute** — Agents write code, wave by wave (parallel within each wave)
5. **Verify** — Deep verification: artifacts exist, aren't stubs, are properly wired

Everything lives in `.planning/` as markdown files you can read, edit, and version control.

## Getting started

### Start the dashboard

```bash
npx dcl
```

Opens a web dashboard at `http://localhost:3847`. If no `.planning/` folder exists, it scaffolds one and starts the onboarding flow.

### Onboarding

The dashboard guides you through:

1. **Vision** — Describe what success looks like (not *how* to build it)
2. **Questions** — AI asks clarifying questions to sharpen your vision
3. **Declarations** — AI generates declaration candidates, you approve

### CLI commands

```bash
dcl              # Start server + open dashboard
dcl init         # Scaffold .planning/ in current directory
dcl status       # Print graph health (declarations, milestones, actions)
dcl mcp          # Start MCP server on stdio
```

## Three interfaces, same capability

Every operation works through all three interfaces:

| Interface | For | How |
|-----------|-----|-----|
| **Web dashboard** | Visual users | `npx dcl` — full lifecycle UI |
| **MCP server** | AI agents | `dcl mcp` — tools, resources, prompts over stdio |
| **CLI** | Terminal users | `dcl status`, `dcl init` |

### MCP integration

Add to your Claude Code settings (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "declare": {
      "command": "bun",
      "args": ["run", "/path/to/dcl/src/mcp/index.ts"],
      "env": {
        "DCL_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

**MCP tools:** `get-graph`, `add-declaration`, `update-declaration`, `delete-declaration`, `approve-batch`, `get-status`

**MCP resources:** `declare://graph`, `declare://project`, `declare://prompt/{name}`

**MCP prompts:** `onboard`, `derive-milestones`, `plan-actions`

## The meta-prompts

Declare's core value is its prompting methodology. Seven standalone markdown files in `src/agents/prompts/` encode the full workflow:

| Prompt | Purpose |
|--------|---------|
| `00-research.md` | Codebase mapping before planning — stack, conventions, tests, pitfalls |
| `01-vision.md` | Extract vivid future state (what, not how) |
| `02-declarations.md` | Transform vision into falsifiable present-tense statements |
| `03-milestones.md` | Derive verifiable states backward from declarations |
| `04-actions.md` | Plan actions with must-haves, verify commands, wave assignments |
| `05-execution.md` | Execute with causal context + write tests alongside code |
| `06-verification.md` | 3-level check: exists, substantive (not stub), wired (actually used) |

Each prompt is self-contained and doubles as documentation. They're exposed as MCP resources so any agent can read them.

## Key concepts

### Declarations

Present-tense statements about the future. Not goals or tasks — *truths that will hold*.

```markdown
## D-01: Users can search the full product catalog in under 200ms

**Statement:** Any search query against the product catalog returns relevant results
within 200ms at the 95th percentile, with zero downtime during index rebuilds.
**Why:** Search is the primary discovery mechanism. If it's slow, users browse Amazon instead.
```

### Milestones

States that must independently hold. Derived backward from declarations.

```
M-01: Full-text search index covers all product fields
M-02: Search API responds within 200ms p95 under load
M-03: Index rebuilds happen without search downtime
```

### Actions with must-haves

Each plan declares what must be true (truths), what files must exist (artifacts), and how components connect (key links). Actions include runnable verify commands.

```markdown
**Truths:**
- Search returns results for partial matches
- Index rebuilds don't drop existing results

**Artifacts:**
- `src/search/index.ts` — Search index builder
- `src/search/query.ts` — Query parser and executor

**Key Links:**
- from: `src/search/index.ts` -> to: `src/api/search.ts` -> via: searchIndex.query()
```

### Wave execution

Actions are assigned to waves. Wave 1 runs first, Wave 2 after Wave 1 completes. Actions within the same wave run concurrently.

### Deep verification

The verifier doesn't just check if files exist. Three levels:

1. **Exists** — Is the artifact at the expected path?
2. **Substantive** — Is it real code, not a stub? (`return null`, `// TODO`, empty bodies get flagged)
3. **Wired** — Is it actually used? (imports that are never called, components that are never rendered)

## Project structure

```
src/
  agents/           # Claude agent spawning + prompts
    prompts/        # 7 standalone meta-prompt markdown files
    claude.ts       # AI runner (SDK integration)
    runner.ts       # Agent registry + lifecycle
  server/           # Hono API server
    routes/         # graph.ts, agents.ts, onboard.ts
    sse.ts          # Real-time event streaming
  core/             # Planning engine
    dag.ts          # Three-layer DAG (declarations → milestones → actions)
    graph.ts        # Graph builder from disk artifacts
    artifacts/      # Markdown parsers/writers (FUTURE.md, MILESTONES.md, PLAN.md)
  app/              # React 19 dashboard
  cli/              # CLI entry point
  mcp/              # MCP server (tools, resources, prompts)
```

~5,000 lines of TypeScript. The folder structure maps 1:1 to concepts.

## Planning files

All state lives in `.planning/` as human-readable markdown:

```
.planning/
  FUTURE.md              # Declarations (D-01, D-02, ...)
  MILESTONES.md          # Milestone table (M-01, M-02, ...)
  PROJECT.md             # Project context
  config.json            # Settings
  agent-state.json       # Persisted agent registry
  milestones/
    M-01-search-index/
      PLAN.md            # Actions for this milestone (A-01, A-02, ...)
```

## Development

```bash
bun install
bun dev           # Start server + client with hot reload
bun test          # Unit tests (vitest)
bun run test:e2e  # E2E tests (playwright)
bun run lint      # Type check (tsc --noEmit)
bun run build     # Production build
```

## Tech stack

- **Runtime:** Bun
- **Server:** Hono
- **Frontend:** React 19 + TanStack Router/Query + Tailwind 4
- **AI:** Claude Agent SDK (local auth, no API key needed)
- **MCP:** @modelcontextprotocol/sdk
- **Tests:** Vitest (unit) + Playwright (E2E)

## License

MIT
