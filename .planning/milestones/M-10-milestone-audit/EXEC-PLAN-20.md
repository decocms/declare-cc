---
phase: M-10
plan: A-20
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Add audit-milestone CJS command

Purpose: This action causes M-10 ("Milestone audit") which realizes D-03: Post-Execution Quality Loops
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add audit-milestone CJS command</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Add audit-milestone CJS command

Context: This action causes M-10 ("Milestone audit") which realizes D-03: Post-Execution Quality Loops
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Add audit-milestone CJS command is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Add audit-milestone CJS command is complete, verified, and advances milestone M-10
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
