<div align="center">

# DECLARE

**A future-driven meta-prompting engine for agentic development.**

[![npm](https://img.shields.io/npm/v/declare-cc?style=for-the-badge&color=7c3aed)](https://www.npmjs.com/package/declare-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

```bash
npm install -g declare-cc
dcl
```

*Declare what's true when this succeeds. The system derives the rest backward.*

</div>

---

## What This Is

Most planning tools start from the present and work forward — "what should we do first?" Declare starts from the future and works backward — "what must be true for this to succeed?"

You declare present-tense statements of fact about your project's future. The system derives milestones ("what must be true?") and actions ("what must be done?") through causal structure, then spawns Claude Code agents to execute them — visible in real time through a browser dashboard.

Built on the Erhard/Jensen/Zaffron ontological model:
- **Integrity** as wholeness and completeness (not morality)
- **Alignment** as shared future (not agreement)
- **Performance** as the product of both

Originally forked from [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done). See [Fork Boundary](#fork-boundary) for details.

---

## Getting Started

### Install

```bash
npm install -g declare-cc
```

### Run

```bash
dcl
```

That's it. If the current directory doesn't have a `.planning/` folder, Declare auto-initializes. It starts the server and opens the dashboard in your browser.

You can also point it at a specific project:

```bash
dcl /path/to/project
```

Requires Node.js 18+.

---

## How It Works

Everything happens through the dashboard. `dcl` opens it, and you drive the workflow with keyboard shortcuts and card-based UI.

### 1. Declare Futures

Create declarations directly in the dashboard — present-tense statements of fact about your project's future. Not goals, not wishes.

Or use the CLI slash command in Claude Code: `/declare:future`

### 2. Derive Milestones

Press **P** on a declaration card. The AI works backward: "What must be true for this to hold?" and proposes milestones. They appear as cards immediately.

### 3. Plan Actions

Press **P** on a milestone card. The AI derives 2-5 concrete actions by asking "What work must be done?" Actions are auto-accepted and appear as cards — the action list IS the plan. No separate exec-plan files.

### 4. Review & Approve

Navigate cards with **Arrow keys**. Press **A** to approve, **E** to edit, **D** to delete. Milestones only move to "Ready to Execute" when all their actions are approved.

### 5. Execute

Press **E** on an approved action. Declare spawns a Claude Code agent with the full context chain: declaration statement → milestone description → action details + sibling actions. The agent reads your codebase, implements changes, and commits.

### 6. Verify & Complete

Use `/declare:verify M-01` to validate deliverables through conversational UAT, or `/declare:audit M-01` to cross-reference against declarations.

---

## The Three-Layer DAG

```
Declarations (D-XX)     "What is true when this succeeds"
    │
    ▼
Milestones (M-XX)       "What must be true" (derived backward)
    │
    ▼
Actions (A-XX)          "What must be done" (derived backward)
```

Each layer connects to the one above through causal edges. Every action traces back to a declaration. Orphan nodes are detected and flagged.

---

## Dashboard

The dashboard is the primary interface. `dcl` opens it automatically.

### Lifecycle Column Browser

Drill into the three-layer DAG: Declarations → Milestones → Actions. Each level groups cards into lifecycle stages:

| Stage | Meaning |
|-------|---------|
| **Needs Planning** | Approved but no actions derived yet |
| **Needs Approval** | Has unapproved items (milestones or actions) |
| **Ready to Execute** | All items approved, ready to run |
| **In Execution** | Currently being executed by an agent |
| **Done** | Completed (collapsible) |

### Keyboard Shortcuts

Single keys act on the focused card:

| Key | Action |
|-----|--------|
| **P** | Plan — derive milestones or actions |
| **A** | Approve |
| **E** | Edit / Execute (context-dependent) |
| **D** | Delete |
| **Arrow Up/Down** | Navigate between cards |
| **Arrow Right/Enter** | Drill into card |
| **Arrow Left** | Go back one level |
| **Ctrl+Shift+A** | Approve all visible |
| **Ctrl+Shift+P** | Global plan |
| **C** | Open command bar |

### Activity Panel

Right-side panel showing real-time agent activity. Every agent spawn — planning, execution, revision — appears as a card with type, target, elapsed time, and status. Completed agents show "View Result".

### Mesh UI Integration

The server writes `.planning/server.port` on startup (deleted on shutdown) so external tools like the Mesh UI Declare plugin can embed the dashboard.

---

## CLI Commands

While the dashboard is the primary interface, all operations are also available as slash commands in Claude Code:

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/declare:init` | Scaffold project structure |
| `/declare:future` | Guided conversation to capture declared futures |
| `/declare:milestones` | Derive milestones backward from declarations |
| `/declare:actions [M-XX]` | Derive actions for a milestone |
| `/declare:execute [M-XX]` | Execute actions with full context |
| `/declare:dashboard` | Open the dashboard (same as `dcl`) |

### Planning Support

| Command | What it does |
|---------|--------------|
| `/declare:discuss [M-XX]` | Gather milestone context through adaptive questioning |
| `/declare:research [M-XX]` | Spawn 4 parallel researchers, synthesize into RESEARCH.md |
| `/declare:map-codebase` | Parallel codebase analysis → `.planning/codebase/` docs |

### Quality Loop

| Command | What it does |
|---------|--------------|
| `/declare:verify [M-XX]` | Conversational UAT — validates deliverables |
| `/declare:audit [M-XX]` | Cross-reference actions against declarations |
| `/declare:debug` | Systematic debugging with checkpoint persistence |

### Navigation

| Command | What it does |
|---------|--------------|
| `/declare:trace <node>` | Walk the why-chain from any node to its declaration |
| `/declare:visualize` | ASCII tree of the full DAG |
| `/declare:prioritize [M-XX]` | Rank actions by unblocking power |
| `/declare:status` | Graph health, layer counts |

### Session & Lifecycle

| Command | What it does |
|---------|--------------|
| `/declare:progress` | Current position, route to next action |
| `/declare:pause` | Snapshot state for safe handoff |
| `/declare:resume` | Restore context from previous session |
| `/declare:complete-milestone` | Archive, tag release, prepare next cycle |
| `/declare:new-cycle` | Archive declarations, reset for next cycle |

### Maintenance

| Command | What it does |
|---------|--------------|
| `/declare:health` | Diagnose `.planning/` health, repair issues |
| `/declare:settings` | Configure workflow toggles |
| `/declare:update` | Update to latest npm version |
| `/declare:help` | Show all commands |

---

## Architecture

### Concurrent Planning

Multiple milestones can be planned simultaneously. Each planning session broadcasts independently via SSE — no singleton locks, no blocking.

### Rich Execution Context

When an action executes, the spawned Claude Code agent receives the full why-chain:

```
Declaration: D-01 — "The system handles all edge cases gracefully"
    ↓
Milestone: M-03 — Error Recovery and Resilience
    ↓
Action: A-07 — Implement retry logic with exponential backoff
    Produces: Retry wrapper for all external API calls

Other actions (context only):
- A-06: Add circuit breaker pattern [DONE]
- A-08: Build error reporting dashboard
```

The agent reads the codebase, implements changes, verifies them, and commits — autonomously.

### Status Propagation

```
Actions DONE → Milestones DONE → Declarations DONE
```

Bottom-up. Automatic.

### Zero Runtime Dependencies

The entire CLI bundles to a single `dist/declare-tools.cjs` via esbuild. No `node_modules` at runtime.

---

## Integrity & Alignment

Declare tracks whether commitments are being honored, not just whether tasks are complete.

| Status | Meaning |
|--------|---------|
| `KEPT` | Commitment fulfilled as declared |
| `HONORED` | Couldn't keep it, but followed the honor protocol |
| `BROKEN` | Not fulfilled, no acknowledgment |
| `RENEGOTIATED` | Explicitly changed through renegotiation |

The **honor protocol**: acknowledge the break, inform affected parties, clean up, renegotiate.

---

## Project Structure

```
.planning/
├── PROJECT.md                         # Project context
├── STATE.md                           # Current work state
├── config.json                        # Settings
├── agent-state.json                   # Agent lifecycle state
├── server.port                        # Active server port (auto-managed)
├── milestones/
│   └── M-XX-slug/
│       ├── PLAN.md                    # Actions for this milestone
│       └── execution.log             # Execution output
└── codebase/                          # Codebase analysis docs

FUTURE.md                              # Active declared futures
MILESTONES.md                          # Active milestones
```

---

## Fork Boundary

Forked from [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done).

| GSD | Declare | Why |
|-----|---------|-----|
| Linear phases | Three-layer DAG (D → M → A) | DAGs represent causal structure |
| `ROADMAP.md` | `FUTURE.md` + `MILESTONES.md` | Present given by the future you're living into |
| Separate EXEC-PLAN files | Action list IS the plan | Executor gets full context automatically |
| Claude Code slash commands first | Dashboard first (`dcl`) | Visual workflow, agents spawned from UI |
| Sequential execution | Concurrent planning + execution | Multiple milestones in parallel |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Declare the future. Derive backward. Execute with integrity.**

</div>
