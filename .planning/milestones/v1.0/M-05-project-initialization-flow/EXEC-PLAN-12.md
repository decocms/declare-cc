---
phase: M-05
plan: A-12
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Write commands/declare/new-project.md

Purpose: This action causes M-05 ("Project initialization flow") which realizes D-02: Complete Project Lifecycle
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write commands/declare/new-project.md</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Write commands/declare/new-project.md

Context: This action causes M-05 ("Project initialization flow") which realizes D-02: Complete Project Lifecycle
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Write commands/declare/new-project.md is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Write commands/declare/new-project.md is complete, verified, and advances milestone M-05
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
