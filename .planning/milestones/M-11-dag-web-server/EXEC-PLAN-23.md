---
phase: M-11
plan: A-23
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Add serve CJS command

Purpose: This action causes M-11 ("DAG web server") which realizes D-04: Web Dashboard
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add serve CJS command</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Add serve CJS command

Context: This action causes M-11 ("DAG web server") which realizes D-04: Web Dashboard
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Add serve CJS command is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Add serve CJS command is complete, verified, and advances milestone M-11
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
