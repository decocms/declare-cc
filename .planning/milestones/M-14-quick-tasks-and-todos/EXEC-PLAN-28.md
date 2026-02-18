---
phase: M-14
plan: A-28
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Write commands/declare/quick.md, add-todo.md, check-todos.md

Purpose: This action causes M-14 ("Quick tasks and todos") which realizes D-05: Full Declare Namespace
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write commands/declare/quick.md, add-todo.md, check-todos.md</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Write commands/declare/quick.md, add-todo.md, check-todos.md

Context: This action causes M-14 ("Quick tasks and todos") which realizes D-05: Full Declare Namespace
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Write commands/declare/quick.md, add-todo.md, check-todos.md is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Write commands/declare/quick.md, add-todo.md, check-todos.md is complete, verified, and advances milestone M-14
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
