<div align="center">

# DECLARE

**A future-driven meta-prompting engine for agentic development.**

[![npm](https://img.shields.io/npm/v/declare-cc?style=for-the-badge&color=7c3aed)](https://www.npmjs.com/package/declare-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

```bash
npx declare-cc@latest
```

*Declare what's true when this succeeds. The system derives the rest backward.*

</div>

---

## What This Is

Most planning tools start from the present and work forward — "what should we do first?" Declare starts from the future and works backward — "what must be true for this to succeed?"

You declare present-tense statements of fact about your project's future. The system derives milestones ("what must be true?") and actions ("what must be done?") through causal structure, then executes them — visible in real time through a browser dashboard.

Built on the Erhard/Jensen/Zaffron ontological model:
- **Integrity** as wholeness and completeness (not morality)
- **Alignment** as shared future (not agreement)
- **Performance** as the product of both

Originally forked from [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done). See [Fork Boundary](#fork-boundary) for details.

---

## How It Works

### 1. Initialize

```
/declare:init
```

Scaffolds the project structure: `FUTURE.md`, `MILESTONES.md`, `.planning/` directory, and the graph config.

### 2. Declare Futures

```
/declare:future
```

A guided conversation captures 3-5 declarations about your project's future. Each declaration is a present-tense statement of fact — not a goal, not a wish.

The system detects past-derived language ("I want to avoid...", "We need to fix...") and uses Socratic reframing to help you declare from the future rather than react to the past.

**Creates:** `FUTURE.md` with declarations (D-01, D-02, ...)

### 3. Derive Milestones

```
/declare:milestones
```

Works backward from declarations: "What must be true for D-01 to hold?" Each milestone maps to one or more declarations through causal edges in the DAG.

**Creates:** `MILESTONES.md` with milestones (M-01, M-02, ...)

### 4. Plan Actions

```
/declare:actions M-01
```

Or press **P** on any milestone card in the dashboard. The AI derives 2-5 concrete actions per milestone by asking "What work must be done to achieve this?" Actions are auto-accepted and appear as cards immediately — the action list IS the plan.

Each action has a title and a "produces" field describing its deliverable. No separate exec-plan files — the milestone's action list is the execution plan.

**Creates:** `.planning/milestones/M-XX-*/PLAN.md`

### 5. Review & Execute

In the dashboard, review each action card. Press **A** to approve, **E** to edit, **D** to delete. Once all actions for a milestone are approved, press **E** to execute.

The executor gets the full why-chain context: declaration statement → milestone description → action details + sibling actions. It reads your codebase, implements the changes, and commits.

### 6. Verify & Complete

```
/declare:verify M-01              # Conversational UAT — validates deliverables
/declare:audit M-01               # Cross-reference actions against declarations
/declare:complete-milestone M-01  # Archive, tag release, prepare next cycle
```

### 7. Navigate

```
/declare:trace A-03       # Why does this action exist? Walk the why-chain
/declare:visualize        # ASCII tree of the full DAG with status markers
/declare:prioritize M-01  # Rank actions by unblocking power
/declare:status           # Layer counts, health indicators
/declare:dashboard        # Live interactive DAG in the browser
```

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

Each layer connects to the one above through causal edges. Every action traces back to a declaration. Orphan nodes (actions without a milestone, milestones without a declaration) are detected and flagged.

The graph engine (`DeclareDag`) uses dual adjacency lists for O(1) bidirectional lookups — trace upward (why-chains) or traverse downward (what depends on this) with equal efficiency.

---

## Dashboard

```
/declare:dashboard
```

Starts a local server and opens an interactive browser view. The dashboard is the primary interface for planning, review, and execution.

### Lifecycle Column Browser

Drill into the three-layer DAG: Declarations → Milestones → Actions. Each level groups cards into lifecycle stages:

| Stage | Meaning |
|-------|---------|
| **Needs Planning** | Approved but no actions derived yet |
| **Needs Approval** | Has unapproved items (milestones or actions) |
| **Ready to Execute** | All items approved, ready to run |
| **In Execution** | Currently being executed by an agent |
| **Done** | Completed (collapsible) |

Cards show inline status: title, description, status badges, action counts, and review state. The action buttons row (Plan, Edit, Delete, Approve, Execute) is always visible — no hidden menus.

### Keyboard Shortcuts

Single keys act on the focused card (use arrow keys to navigate):

| Key | Action |
|-----|--------|
| **P** | Plan — derive actions/milestones |
| **A** | Approve the focused card |
| **E** | Edit (opens inline textarea) |
| **D** | Delete |
| **Arrow Up/Down** | Move focus between cards |
| **Arrow Right/Enter** | Drill into card |
| **Arrow Left** | Go back one level |
| **Ctrl+Shift+A** | Approve all visible |
| **Ctrl+Shift+P** | Global plan (top-right button) |

### Activity Panel

Right-side panel showing real-time agent activity. Every agent spawn — planning, execution, revision — appears as a persistent card with type, target, elapsed time, and status. Cards survive page refresh. Completed agents show "View Result".

### Command Bar

Press **C** to open the command input at the bottom. Type natural language or slash commands. The command bar dispatches to the server API.

### Mesh UI Integration

The server writes `.planning/server.port` on startup (deleted on shutdown) so external tools like the Mesh UI Declare plugin can discover and embed the dashboard.

---

## Integrity & Alignment

Declare doesn't just track what's done — it tracks whether commitments are being honored.

### Integrity States

| Status | Meaning |
|--------|---------|
| `KEPT` | Commitment fulfilled as declared |
| `HONORED` | Commitment couldn't be kept, but the honor protocol was followed |
| `BROKEN` | Commitment not fulfilled, no acknowledgment |
| `RENEGOTIATED` | Commitment explicitly changed through renegotiation flow |

The **honor protocol** for a commitment you can't keep: acknowledge the break, inform affected parties, clean up the mess, renegotiate a new commitment.

### Alignment Monitoring

- **Drift detection** — Are current actions still aligned with declared futures?
- **Occurrence checks** — AI verifies declarations still hold at milestone completion
- **Renegotiation flow** — When a declaration no longer fits, renegotiate it into `FUTURE-ARCHIVE.md`
- **Wholeness visualization** — Each node shows its computed wholeness state in the dashboard

---

## Commands

### Core Workflow

| Command | What it does |
|---------|--------------|
| `/declare:init` | Scaffold project structure and install commands |
| `/declare:future` | Guided conversation to capture declared futures |
| `/declare:milestones` | Derive milestones backward from declarations |
| `/declare:actions [M-XX]` | Derive actions for a milestone |
| `/declare:execute [M-XX]` | Execute actions with full context |

### Planning Support

| Command | What it does |
|---------|--------------|
| `/declare:discuss [M-XX]` | Gather milestone context through adaptive questioning |
| `/declare:research [M-XX]` | Spawn 4 parallel researchers, synthesize into RESEARCH.md |
| `/declare:map-codebase` | Parallel codebase analysis → `.planning/codebase/` docs |

### Quality Loop

| Command | What it does |
|---------|--------------|
| `/declare:verify [M-XX]` | Conversational UAT — validates deliverables, spawns debuggers on failure |
| `/declare:audit [M-XX]` | Cross-reference actions against declarations, identify gaps |
| `/declare:debug` | Systematic debugging with scientific method and checkpoint persistence |

### Navigation

| Command | What it does |
|---------|--------------|
| `/declare:trace <node>` | Walk the why-chain from any node up to its declaration |
| `/declare:visualize` | ASCII tree of the full DAG with status markers |
| `/declare:prioritize [M-XX]` | Rank actions by dependency weight (unblocking power) |
| `/declare:status` | Graph health, layer counts, integrity and alignment metrics |
| `/declare:dashboard` | Live interactive DAG in the browser |

### Productivity

| Command | What it does |
|---------|--------------|
| `/declare:quick` | Ad-hoc task with atomic commit, outside milestone structure |
| `/declare:add-todo` | Capture an idea or task for later |
| `/declare:check-todos` | List pending todos, route to milestone or quick task |

### Session Management

| Command | What it does |
|---------|--------------|
| `/declare:progress` | Current position, recent work summary, route to next action |
| `/declare:pause` | Snapshot work state to `.continue-here.md` for safe handoff |
| `/declare:resume` | Restore full context from previous session |

### Lifecycle

| Command | What it does |
|---------|--------------|
| `/declare:new-project` | Deep context gathering, PROJECT.md + STATE.md creation |
| `/declare:new-cycle` | Archive declarations, reset for next cycle |
| `/declare:complete-milestone` | Snapshot graph, tag release, prepare next cycle |

### Maintenance

| Command | What it does |
|---------|--------------|
| `/declare:health` | Diagnose `.planning/` directory health, repair issues |
| `/declare:settings` | Configure workflow toggles interactively |
| `/declare:set-profile` | Switch model profile (quality / balanced / budget) |
| `/declare:update` | Update to latest npm version with local-patch preservation |
| `/declare:reapply-patches` | Reapply local modifications after an update |
| `/declare:help` | Show all commands |

---

## Project Structure

```
FUTURE.md                              # Active declared futures
MILESTONES.md                          # Active milestones
FUTURE-ARCHIVE.md                      # Completed cycle declarations

.planning/
├── PROJECT.md                         # Project context and goals
├── STATE.md                           # Current work state
├── config.json                        # Project settings
├── agent-state.json                   # Agent lifecycle state
├── server.port                        # Active server port (auto-managed)
├── milestones/
│   ├── M-XX-slug/
│   │   ├── PLAN.md                    # Actions for this milestone
│   │   ├── execution.log             # Execution output log
│   │   └── VERIFICATION.md           # Integrity proof after execution
│   └── v1.0/                          # Archived milestone cycle
└── codebase/                          # Codebase analysis artifacts
```

---

## Getting Started

### Install

```bash
npx declare-cc@latest
```

Or install globally:

```bash
npm install -g declare-cc
declare                    # Opens dashboard for current directory
```

Requires Node.js 18+.

### Quick Start

```
/declare:init                  # Scaffold the project
/declare:future                # Declare 3-5 futures
/declare:milestones            # Derive milestones backward
/declare:dashboard             # Open the live dashboard
```

Then in the dashboard: press **P** to plan actions, **A** to approve, **E** to execute. Everything flows through the card-based UI.

### Recommended: Skip Permissions Mode

Declare spawns agents and runs CLI tools frequently. For frictionless operation:

```bash
claude --dangerously-skip-permissions
```

<details>
<summary><strong>Alternative: Granular Permissions</strong></summary>

Add to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(node:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)"
    ]
  }
}
```

</details>

---

## Architecture

### Concurrent Planning

Multiple milestones can be planned simultaneously. The action derivation runner uses a session Map — no singleton locks, no 409 errors. Each session broadcasts independently via SSE.

### Rich Execution Context

When an action executes, the AI agent receives the full why-chain:

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

The executor reads the codebase, implements changes, verifies them, and commits — all autonomously.

### Status Propagation

The DAG maintains status consistency bottom-up:

```
Actions → check produced files exist → mark DONE
    ↓
Milestones → all actions DONE → mark DONE
    ↓
Declarations → all milestones DONE → mark DONE
```

### Atomic Git Commits

Every action gets its own commit:

```
feat(M-01): create database schema
feat(M-01): implement auth service
feat(M-01): build API endpoints
```

Git bisect finds the exact failing action. Each action is independently revertable.

### Zero Runtime Dependencies

The entire CLI bundles to a single `dist/declare-tools.cjs` via esbuild. No `node_modules` at runtime.

---

## Fork Boundary

Declare is forked from [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done), a meta-prompting and context engineering system for Claude Code.

### What's Carried Forward

- **Agent orchestration** — Planner, executor, researcher, verifier agent patterns
- **Slash command interface** — `.claude/commands/` directory, markdown meta-prompts
- **esbuild bundling** — Single-file CJS distribution, zero runtime deps
- **Markdown artifacts** — `.planning/` directory as source of truth
- **Atomic git commits** — Every state change produces a traceable commit
- **Context engineering** — Fresh context per agent, structured XML plans

### What's Replaced

| GSD | Declare | Why |
|-----|---------|-----|
| Linear phases (1, 2, 3...) | Three-layer DAG (D → M → A) | Phases are past-derived sequencing; DAGs represent causal structure |
| `ROADMAP.md` | `FUTURE.md` + `MILESTONES.md` | The present is given by the future you're living into |
| Separate EXEC-PLAN files per action | Action list IS the plan | Actions define what to do; the executor gets full context automatically |
| Sequential execution | Concurrent planning + execution | Multiple milestones plan/execute in parallel |
| Phase numbers | Milestone IDs (M-XX) | Milestones derive from declarations, not arbitrary ordering |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Declare the future. Derive backward. Execute with integrity.**

</div>
