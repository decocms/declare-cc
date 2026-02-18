---
phase: M-08
plan: A-16
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Fork gsd-debugger as agents/declare-debugger.md

Purpose: This action causes M-08 ("Conversational UAT") which realizes D-03: Post-Execution Quality Loops
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fork gsd-debugger as agents/declare-debugger.md</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Fork gsd-debugger as agents/declare-debugger.md

Context: This action causes M-08 ("Conversational UAT") which realizes D-03: Post-Execution Quality Loops
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Fork gsd-debugger as agents/declare-debugger.md is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Fork gsd-debugger as agents/declare-debugger.md is complete, verified, and advances milestone M-08
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
