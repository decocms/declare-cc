---
phase: M-14
plan: A-27,A-28
subsystem: declare-tools-cjs,slash-commands
tags: [quick-tasks, todos, cjs, slash-commands, declare]
dependency_graph:
  requires: [declare-tools-cjs-core, git/commit.js, commands/parse-args.js]
  provides: [quick-task-command, add-todo-command, check-todos-command, complete-todo-command, declare/quick.md, declare/add-todo.md, declare/check-todos.md]
  affects: [dist/declare-tools.cjs, src/declare-tools.js]
tech_stack:
  added: []
  patterns: [auto-numbered-folders, sequential-id-files, frontmatter-parsing, move-on-complete]
key_files:
  created:
    - src/commands/quick-task.js
    - src/commands/todo.js
    - commands/declare/quick.md
    - commands/declare/add-todo.md
    - commands/declare/check-todos.md
  modified:
    - src/declare-tools.js
    - dist/declare-tools.cjs
decisions:
  - "Todos and quick tasks both use NNN-slug auto-numbering, scanning both pending and completed/ to avoid ID collisions"
  - "QUICK-PLAN.md template uses checkbox task list and notes section to leave space for execution tracking"
  - "check-todos slash command offers 4 actions: work now, add to milestone, mark complete, skip — matches GSD check-todos UX"
  - ".claude/commands/declare/ sync requires manual cp — Write tool blocked from .claude/ by permission system"
metrics:
  duration: 15min
  completed: 2026-02-17
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase M-14 Plan A-27,A-28: Quick Tasks and Todos Summary

Quick-task and todo CJS commands backed by auto-numbered folder/file creation with slugified names, plus three slash commands covering ad-hoc task execution, idea capture, and interactive todo review.

## What Was Built

### A-27: Quick-task and todo CJS commands

**`src/commands/quick-task.js`** exports `runQuickTask(cwd, args)`:
- Accepts `--description "..."` and optional `--slug "..."`
- Scans `.planning/quick/` for existing `NNN-*` directories to auto-increment
- Creates `.planning/quick/NNN-slug/QUICK-PLAN.md` with description, status, task checklist, and notes section
- Returns `{ id, folder, planPath, committed, hash? }`

**`src/commands/todo.js`** exports three functions:
- `runAddTodo(cwd, args)`: accepts `--description "..."`, creates `.planning/todos/NNN-slug.md` with YAML frontmatter (created date, status), returns `{ id, path, committed, hash? }`
- `runCheckTodos(cwd)`: reads all `.planning/todos/*.md` files (excluding `completed/`), parses frontmatter and H1 title, returns `{ todos: [{id, description, created, path}] }` sorted by ID
- `runCompleteTodo(cwd, args)`: accepts `--id NNN`, finds matching file by prefix, moves it to `.planning/todos/completed/` via `renameSync`, returns `{ id, from, to, committed, hash? }`

ID collision prevention: `nextTodoNumber()` scans both `todos/*.md` and `todos/completed/*.md` to find the global maximum before assigning the next number.

**`src/declare-tools.js`** wired four new subcommands: `quick-task`, `add-todo`, `check-todos`, `complete-todo`.

**`dist/declare-tools.cjs`** rebuilt via esbuild with all new commands bundled.

### A-28: Slash commands

**`commands/declare/quick.md`** (`/declare:quick`):
- Accepts task description from `$ARGUMENTS` or interactive prompt
- Creates quick task folder via `node dist/declare-tools.cjs quick-task`
- `--full` flag adds: plan-review step (read QUICK-PLAN.md, display assessment, ask yes/refine) and post-execution verification step
- Spawns Task agent to execute; displays agent report
- Reports completion with files, commits, folder path

**`commands/declare/add-todo.md`** (`/declare:add-todo`):
- Accepts description from `$ARGUMENTS` or infers from conversation context
- Single-step creation via `node dist/declare-tools.cjs add-todo`
- Confirms capture with id, path, and commit hash

**`commands/declare/check-todos.md`** (`/declare:check-todos`):
- Loads todos via CJS tool, displays numbered list
- User selects by number or ID
- Shows full file content for context
- Offers 4 actions: work now (Task agent spawn), add to milestone planning, mark complete, skip
- Loops to offer reviewing another todo after each action

All commands use repo-relative `dist/declare-tools.cjs` paths.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Deferred Items

**[Deviation - Permission Gate] `.claude/commands/declare/` sync blocked**

The Write tool and Bash `cp` were denied write access to `.claude/` directory. This is a Claude Code permission boundary.

The three slash commands exist at `commands/declare/` (the source-of-truth) but are NOT yet synced to `.claude/commands/declare/`.

**Manual step required:**
```bash
cp commands/declare/quick.md .claude/commands/declare/quick.md
cp commands/declare/add-todo.md .claude/commands/declare/add-todo.md
cp commands/declare/check-todos.md .claude/commands/declare/check-todos.md
```

Or re-run `node bin/install.js --claude --local` which copies `commands/declare/` to `.claude/commands/declare/` automatically.

## Self-Check: PASSED

Files created:
- [x] `src/commands/quick-task.js` — exists
- [x] `src/commands/todo.js` — exists
- [x] `commands/declare/quick.md` — exists
- [x] `commands/declare/add-todo.md` — exists
- [x] `commands/declare/check-todos.md` — exists

Files modified:
- [x] `src/declare-tools.js` — updated with 4 new cases + requires
- [x] `dist/declare-tools.cjs` — rebuilt via esbuild

Commits:
- [x] `3e7a944` — feat(M-14): add quick-task and todo CJS commands
- [x] `458637f` — feat(M-14): add quick, add-todo, check-todos slash commands (commands/declare/)

Pending (permission gate):
- [ ] `.claude/commands/declare/quick.md` — blocked by permission system
- [ ] `.claude/commands/declare/add-todo.md` — blocked by permission system
- [ ] `.claude/commands/declare/check-todos.md` — blocked by permission system
