---
phase: M-04
plan: A-09
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Fork gsd-codebase-mapper as agents/declare-codebase-mapper.md

Purpose: This action causes M-04 ("Codebase mapper") which realizes D-02: Complete Project Lifecycle
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fork gsd-codebase-mapper as agents/declare-codebase-mapper.md</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Fork gsd-codebase-mapper as agents/declare-codebase-mapper.md

Context: This action causes M-04 ("Codebase mapper") which realizes D-02: Complete Project Lifecycle
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Fork gsd-codebase-mapper as agents/declare-codebase-mapper.md is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Fork gsd-codebase-mapper as agents/declare-codebase-mapper.md is complete, verified, and advances milestone M-04
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
