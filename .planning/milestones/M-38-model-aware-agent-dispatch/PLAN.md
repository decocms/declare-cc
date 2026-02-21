# Plan: M-38 -- Model-aware agent dispatch

**Milestone:** M-38
**Realizes:** D-07
**Status:** DONE
**Derived:** 2026-02-21

## Actions

### A-79: Define model assignment table per agent role
**Status:** DONE
**Produces:** Config or constant mapping role→model: planner=opus, executor=opus, researcher=sonnet, synthesizer=sonnet, checker=haiku, verifier=sonnet, debugger=opus — committed to .planning/config.json

### A-80: Wire model selection into agent spawn calls
**Status:** DONE
**Produces:** All orchestrator commands (plan, execute, research, verify, audit, debug) pass the correct model to Task tool spawns instead of inheriting session default

### A-81: Surface model used per action in the dashboard
**Status:** DONE
**Produces:** Model badge on each action node in the dashboard showing which model ran it, sourced from execution metadata
