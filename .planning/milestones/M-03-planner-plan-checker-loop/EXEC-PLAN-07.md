---
phase: M-03
plan: A-07
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

<objective>
Fork gsd-plan-checker as agents/declare-plan-checker.md

Purpose: This action causes M-03 ("Planner + plan-checker loop") which realizes D-01: Full Planning Pipeline
Output: See action description
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fork gsd-plan-checker as agents/declare-plan-checker.md</name>
  <files>TBD - executor determines from action scope</files>
  <action>
Fork gsd-plan-checker as agents/declare-plan-checker.md

Context: This action causes M-03 ("Planner + plan-checker loop") which realizes D-01: Full Planning Pipeline
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>Fork gsd-plan-checker as agents/declare-plan-checker.md is complete and verified</done>
</task>

</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
Fork gsd-plan-checker as agents/declare-plan-checker.md is complete, verified, and advances milestone M-03
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
