<div align="center">

# DECLARE

**A future-driven meta-prompting engine for agentic development.**

[![npm](https://img.shields.io/npm/v/declare-cc?style=for-the-badge&color=7c3aed)](https://www.npmjs.com/package/declare-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

*Declare what's true when this succeeds. The system derives the rest backward.*

</div>

---

## Setup

Add to your project:

```bash
npm install --save-dev declare-cc
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "plan": "dcl"
  }
}
```

Run it:

```bash
npm run plan
```

This auto-initializes a `.planning/` directory if one doesn't exist, starts the Declare server on a random free port, writes the port to `.planning/server.port`, and prints the dashboard URL.

Or run directly:

```bash
npx dcl
```

Requires Node.js 18+.

---

## What This Is

Most planning tools start from the present and work forward — "what should we do first?" Declare starts from the future and works backward — "what must be true for this to succeed?"

You declare present-tense statements of fact about your project's future. The system derives milestones ("what must be true?") and actions ("what must be done?") through causal structure, then spawns Claude Code agents to execute them — visible in real time through a browser dashboard.

---

## How It Works

Everything happens through the dashboard. `dcl` starts the server and prints the URL — click it to open.

### 1. Declare Futures

Create declarations directly in the dashboard — present-tense statements about your project's future. Not goals, not wishes.

### 2. Derive Milestones

Press **P** on a declaration card. The AI works backward: "What must be true for this to hold?" Milestones appear as cards immediately.

### 3. Plan Actions

Press **P** on a milestone card. The AI derives 2-5 concrete actions. Actions auto-accept and appear as cards — the action list IS the plan.

### 4. Review & Approve

Navigate with **Arrow keys**. Press **A** to approve, **E** to edit, **D** to delete. Milestones only move to "Ready to Execute" when all their actions are approved.

### 5. Execute

Press **E** on an approved action. A Claude Code agent spawns with full context: declaration → milestone → action + sibling actions. It reads your codebase, implements changes, and commits.

---

## The DAG

```
Declarations (D-XX)     "What is true when this succeeds"
    │
    ▼
Milestones (M-XX)       "What must be true" (derived backward)
    │
    ▼
Actions (A-XX)          "What must be done" (derived backward)
```

Every action traces back to a declaration through causal edges.

---

## Dashboard

### Lifecycle Stages

Cards are grouped into stages at each level:

| Stage | Meaning |
|-------|---------|
| **Needs Planning** | Approved, no actions yet |
| **Needs Approval** | Has unapproved items |
| **Ready to Execute** | All approved, ready to run |
| **In Execution** | Agent running |
| **Done** | Completed |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **P** | Plan (derive milestones/actions) |
| **A** | Approve |
| **E** | Edit / Execute |
| **D** | Delete |
| **Arrow keys** | Navigate cards, drill in/out |
| **Ctrl+Shift+A** | Approve all visible |
| **C** | Command bar |

---

## Server & Port Discovery

The Declare server uses OS-assigned ports so multiple projects can run simultaneously without collisions.

### How it works

1. `dcl` (or `dcl serve`) starts the server on **port 0** — the OS assigns a random free port
2. After the server is listening, it writes the port number to `.planning/server.port` (plain text, e.g. `62964`)
3. On shutdown (SIGINT, SIGTERM, process exit), the file is deleted
4. Next time `dcl` runs, it reads the port file. If the server is still alive, it reuses it. If the file is stale (server crashed), it cleans up and starts fresh.

### For external tools

To discover a running Declare server for a project:

```js
const port = fs.readFileSync('<project>/.planning/server.port', 'utf8').trim();
// Verify it's alive:
// GET http://localhost:<port>/api/graph → 200 = running
// Embed dashboard:
// <iframe src="http://localhost:<port>/" />
```

If the file doesn't exist, the server isn't running. Start it:

```bash
cd <project> && npx dcl serve
```

Then poll for `.planning/server.port` to appear (~1 second).

### Explicit port

If you need a specific port:

```bash
dcl serve --port 4000
```

---

## For Agents

If you're an AI agent (Claude Code, Cursor, etc.) working in a project that uses Declare, here's what you need to know:

### Project state lives in `.planning/`

- **`FUTURE.md`** — Declared futures (present-tense statements about what's true when the project succeeds)
- **`MILESTONES.md`** — Milestones derived backward from futures
- **`.planning/milestones/M-XX-slug/PLAN.md`** — Actions for each milestone (title, produces, causes)
- **`.planning/STATE.md`** — Current project state and decisions
- **`.planning/PROJECT.md`** — Project context and background

### The DAG structure

Declarations (D-XX) → Milestones (M-XX) → Actions (A-XX). Each layer links to the one above via `realizes` (milestones → declarations) and `causes` (actions → milestones). Read the graph with:

```bash
node_modules/.bin/declare-cc load-graph
```

Returns JSON with `declarations`, `milestones`, `actions` arrays.

### Slash commands available to you

If you're running inside Claude Code with declare-cc installed, these slash commands are available:

- `/declare:status` — See where the project stands
- `/declare:execute M-XX` — Execute actions for a milestone
- `/declare:verify M-XX` — Validate deliverables
- `/declare:trace A-XX` — Understand why an action exists (walk the why-chain)
- `/declare:progress` — Find the next thing to work on
- `/declare:help` — See all commands

### Dashboard API

If the server is running (check `.planning/server.port`), you can use the HTTP API:

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/graph` | Full DAG (declarations, milestones, actions) |
| GET | `/api/status` | Integrity/alignment metrics |
| GET | `/api/agents` | Running/completed agents |
| GET | `/api/events` | SSE stream (real-time updates) |
| POST | `/api/review` | Approve/reject a node |
| POST | `/api/action/:id/execute` | Execute an action |

---

## CLI Commands

The dashboard is the primary interface. All operations are also available as slash commands in Claude Code:

| Command | What it does |
|---------|--------------|
| `/declare:future` | Guided conversation to capture futures |
| `/declare:milestones` | Derive milestones from declarations |
| `/declare:actions M-XX` | Derive actions for a milestone |
| `/declare:execute M-XX` | Execute actions |
| `/declare:verify M-XX` | Conversational UAT |
| `/declare:audit M-XX` | Cross-reference against declarations |
| `/declare:trace A-XX` | Walk the why-chain to its declaration |
| `/declare:status` | Graph health and layer counts |
| `/declare:dashboard` | Start server and print URL |
| `/declare:help` | Show all commands |

---

## Project Structure

```
.planning/
├── server.port          # Active server port (auto-managed)
├── config.json          # Settings
├── agent-state.json     # Agent lifecycle state
├── milestones/
│   └── M-XX-slug/
│       └── PLAN.md      # Actions for this milestone
FUTURE.md                # Declared futures
MILESTONES.md            # Derived milestones
```

---

## License

MIT — See [LICENSE](LICENSE).

<div align="center">

**Declare the future. Derive backward. Execute with integrity.**

</div>
