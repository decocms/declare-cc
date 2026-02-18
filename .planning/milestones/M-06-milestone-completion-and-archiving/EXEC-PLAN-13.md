---
phase: M-06
plan: A-13
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Add complete-milestone CJS command

Purpose: This action causes M-06 ("Milestone completion and archiving") which realizes D-02: Complete Project Lifecycle
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add complete-milestone CJS command</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Add complete-milestone CJS command

Context: This action causes M-06 ("Milestone completion and archiving") which realizes D-02: Complete Project Lifecycle
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Add complete-milestone CJS command is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Add complete-milestone CJS command is complete, verified, and advances milestone M-06
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
