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

You declare present-tense statements of fact about your project's future. The system derives milestones ("what must be true?") and actions ("what must be done?") through causal structure, then executes them in topological order with wave-based parallelism — visible in real time through a browser-based dashboard.

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

### 4. Plan & Execute

```
/declare:actions M-01     # Derive actions for the milestone
/declare:plan M-01        # Research → plan → verify loop (planner + checker agents)
/declare:execute M-01     # Wave-based execution with parallel agents
```

The planner agent derives concrete actions, the checker agent validates them, and the executor runs them in topological waves. Each action gets its own atomic commit.

Or use the dashboard — review plans in the column browser, approve them, then hit Go in execution mode. The pipeline runner handles wave scheduling, progress tracking, and failure recovery.

**Creates:** `.planning/milestones/M-XX-*/PLAN.md` and `EXEC-PLAN-*.md` files

### 5. Verify & Complete

```
/declare:verify M-01              # Conversational UAT — validates deliverables
/declare:audit M-01               # Cross-reference actions against declarations
/declare:complete-milestone M-01  # Archive, tag release, prepare next cycle
```

### 6. Navigate

Understand your graph at any point:

```
/declare:trace A-03       # Why does this action exist? Walk the why-chain up to its declaration
/declare:visualize        # ASCII tree of the full DAG with status markers
/declare:prioritize M-01  # Rank actions by unblocking power (dependency weight)
/declare:status           # Layer counts, health indicators, integrity/alignment metrics
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

Starts a local server and opens an interactive browser view of your project. The dashboard is the primary interface for planning and execution.

### Column Browser (Planning Mode)

The three-layer DAG rendered as a navigable column browser — Declarations on the left, Milestones in the center, Actions on the right. Click any node to see its detail panel with full causal chain, context, and status. Chain nodes are clickable for navigation.

Declarations, milestones, and actions can be created, reviewed, and approved directly in the browser. The review/annotation panel supports iterative cycles: generate plan, annotate corrections, send back for revision, repeat until approved.

### Execution Mode

When all plans in scope are approved, transition to execution mode — a dedicated full-screen view showing the ordered execution pipeline. Features include:

- **Pre-execution wave order** — Review the execution sequence before starting, with drag-to-reorder within dependency constraints
- **Pipeline runner** — Manifest-driven execution with wave scheduling, transient retry, and execution reports
- **Live progress** — Progress bar, status dots per action, elapsed time
- **Failure handling** — Pause-on-failure with View Output, Skip, and Stop options
- **State persistence** — Execution state survives browser refresh

### Activity Panel

A right-side panel showing real-time agent activity. Every agent spawn — execution, revision, research — appears as a persistent activity card showing agent type, target node, elapsed time, and live status. Cards survive page refresh and navigation. Completed agents show a "View Result" button that navigates to the produced output.

### Status Colors

DONE nodes retain their type hue (dimmed blue for declarations, dimmed purple for milestones, dimmed green for actions) so the graph stays readable as a living document rather than collapsing to grey. Integrity state is visualized per-node with wholeness indicators.

---

## Integrity & Alignment

Declare doesn't just track what's done — it tracks whether commitments are being honored.

### Integrity States

Every node in the graph has an integrity status:

| Status | Meaning |
|--------|---------|
| `KEPT` | Commitment fulfilled as declared |
| `HONORED` | Commitment couldn't be kept, but the honor protocol was followed |
| `BROKEN` | Commitment not fulfilled, no acknowledgment |
| `RENEGOTIATED` | Commitment explicitly changed through renegotiation flow |

The **honor protocol** for a commitment you can't keep: acknowledge the break, inform affected parties, clean up the mess, renegotiate a new commitment. This matches the Erhard/Jensen model — integrity isn't about being perfect, it's about restoring wholeness when things break.

### Alignment Monitoring

- **Drift detection** — Are current actions still aligned with declared futures?
- **Occurrence checks** — AI verifies declarations still hold at milestone completion
- **Performance scoring** — Alignment x Integrity as qualitative HIGH/MEDIUM/LOW (never numeric scores)
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
| `/declare:plan [M-XX]` | Research → plan → verify loop (planner + checker agents) |
| `/declare:execute [M-XX]` | Wave-based execution with parallel agents |

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
├── agent-state.json                   # Agent lifecycle state (server-side tracking)
├── milestones/
│   ├── M-XX-slug/
│   │   ├── PLAN.md                    # Actions for this milestone
│   │   ├── EXEC-PLAN-*.md            # Per-action execution plans
│   │   └── VERIFICATION.md           # Integrity proof after execution
│   └── v1.0/                          # Archived milestone cycle
└── codebase/                          # Codebase analysis artifacts

agents/                                # Agent definitions (10 specialized agents)
├── declare-planner.md
├── declare-plan-checker.md
├── declare-executor.md
├── declare-researcher.md
├── declare-research-synthesizer.md
├── declare-codebase-mapper.md
├── declare-roadmapper.md
├── declare-verifier.md
├── declare-integration-checker.md
└── declare-debugger.md

workflows/                             # Conversational workflow definitions
├── actions.md
├── discuss.md
├── future.md
├── milestones.md
├── scope.md
└── verify.md

dist/declare-tools.cjs                 # Bundled CLI (zero runtime deps)
src/                                   # Source (~26K LOC)
├── graph/engine.js                    # DeclareDag — dual adjacency lists, Kahn's sort
├── artifacts/                         # Markdown parsers/writers
├── commands/                          # 40+ CLI command implementations
└── server/                            # HTTP API, SSE streaming, dashboard frontend
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

Or clone and install locally:

```bash
git clone https://github.com/decocms/declare-cc.git
cd declare-cc
node bin/install.js --claude --local
```

Requires Node.js 18+.

### Quick Start

```
/declare:init                  # Scaffold the project
/declare:future                # Declare 3-5 futures
/declare:milestones            # Derive milestones backward
/declare:plan M-01             # Research + plan first milestone
/declare:execute M-01          # Execute with wave scheduling
/declare:dashboard             # View the live DAG
```

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

### Wave-Based Execution

Actions are grouped into waves based on their dependencies in the DAG. Within each wave, independent actions run in parallel via spawned agents. Waves run sequentially.

```
WAVE 1 (parallel)        WAVE 2 (parallel)        WAVE 3
┌──────────┐ ┌──────────┐  ┌──────────┐ ┌──────────┐  ┌──────────┐
│ A-01     │ │ A-02     │  │ A-03     │ │ A-04     │  │ A-05     │
│ Schema   │ │ Auth     │→ │ API      │ │ Storage  │→ │ UI       │
└──────────┘ └──────────┘  └──────────┘ └──────────┘  └──────────┘
      │           │              ↑           ↑              ↑
      └───────────┴──────────────┴───────────┘              │
             A-03 needs A-01, A-04 needs A-02               │
                        A-05 needs A-03 + A-04              │
```

Each agent gets a fresh context window. Your main session stays light.

### Agent Lifecycle Tracking

Every spawned agent is tracked server-side with full lifecycle state: spawn, progress, completion. The `AgentRegistry` persists state to disk so agents survive server restarts and browser refreshes. The HTTP API exposes agent state for the dashboard's activity panel.

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
| `STATE.md` tracking | Graph node statuses | Status lives in the graph, not a separate file |
| Sequential execution | Topology-aware wave scheduling | Actions execute in causal order, not linear sequence |
| Phase numbers | Milestone IDs (M-XX) | Milestones derive from declarations, not arbitrary ordering |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Declare the future. Derive backward. Execute with integrity.**

</div>
