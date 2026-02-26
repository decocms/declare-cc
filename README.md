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

This auto-initializes a `.planning/` directory if one doesn't exist, starts the Declare server, writes the port to `.planning/server.port`, and opens the dashboard in your browser.

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

Everything happens through the dashboard. `dcl` opens it, and you drive the workflow with keyboard shortcuts and card-based UI.

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

### Server Discovery

On startup, the server writes the port number to `.planning/server.port` (plain text, e.g. `3847`). On shutdown, it deletes this file. External tools can read this file to embed the dashboard in an iframe.

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
| `/declare:dashboard` | Open the dashboard |
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
