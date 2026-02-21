# Plan: M-19 -- Browser-based milestone derivation

**Milestone:** M-19
**Realizes:** D-06
**Status:** PENDING
**Derived:** 2026-02-21

## Actions

### A-37: Build scoped agent invocation for derivation
**Status:** PENDING
**Produces:** Server-side subprocess runner calling claude -p with tight context-minimal prompt (just declarations) and streaming output

### A-38: Add milestone derivation API endpoint
**Status:** PENDING
**Produces:** POST /api/milestones/derive wired to the subprocess runner

### A-39: Build derivation trigger and approval UI
**Status:** PENDING
**Produces:** Panel showing streaming derivation output + inline approve/adjust before committing
