# Milestone Derivation

## Purpose
Derive milestones backward from declarations. Each milestone is a condition that must be true for one or more declarations to hold.

## What Is a Milestone?
A milestone is a **verifiable state of the world** — not a task, not a deliverable:
- "The database schema supports multi-tenancy" (verifiable state)
- NOT "Design the database schema" (that's a task/action)
- "Load tests confirm 10K RPS at p99 < 50ms" (verifiable state)
- NOT "Run load tests" (that's an action)

## Backward Derivation Process

For each declaration, ask:
> "What must be independently true for this declaration to hold?"

Then decompose recursively until each milestone is achievable in 1-3 days of work.

### Example
**Declaration**: "Users can export any report as PDF with one click"

**Milestones derived backward**:
1. "PDF export button exists on every report page" (UI)
2. "PDF rendering engine produces pixel-accurate output" (backend)
3. "Export completes within 5 seconds for reports under 100 pages" (performance)

Each milestone **realizes** one or more declarations (the upward edge in the DAG).

## Rules
1. **Milestones are verifiable** — you can check true/false
2. **No circular dependencies** between milestones
3. **3-5 milestones per declaration** is typical
4. **A milestone can realize multiple declarations** (shared infrastructure)
5. **Order doesn't matter** — the DAG determines execution order

## Output Format
Markdown table:
```
| ID | Title | Description | Realizes |
|----|-------|-------------|----------|
| M-01 | ... | ... | D-01, D-03 |
```
