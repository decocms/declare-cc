---
milestone: M-51-single-go-pipeline-runner
action: A-113
type: execute
wave: 2
depends_on: ["A-111"]
files_modified:
  - src/server/pipeline-runner.js
autonomous: true
declarations: ["D-15"]
must_haves:
  truths:
    - "On pipeline completion, .planning/execution-report.md is auto-generated"
    - "Report contains per-action results table with pass/fail/skipped status"
    - "Report contains timing per action and total pipeline duration"
    - "Report contains commit SHAs if available"
    - "Report contains overall success/failure status"
  artifacts:
    - path: "src/server/pipeline-runner.js"
      provides: "Report generation on pipeline-complete"
      contains: "execution-report.md"
  key_links:
    - from: "src/server/pipeline-runner.js"
      to: ".planning/execution-report.md"
      via: "fs.writeFileSync on pipeline completion"
      pattern: "execution-report\\.md"
    - from: "src/server/pipeline-runner.js"
      to: "git log"
      via: "execSync git log to get latest commit SHA per action"
      pattern: "git.*log|execSync"
---

<objective>
Auto-generate an execution summary report when the pipeline completes, providing a CI-style results overview.

Purpose: D-15's "CI-pipeline-style display" needs a persistent artifact capturing what happened. This report is the pipeline's receipt.
Output: Updated pipeline-runner.js that writes .planning/execution-report.md on completion
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/server/pipeline-runner.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add execution report generation on pipeline complete</name>
  <files>src/server/pipeline-runner.js</files>
  <action>
In `src/server/pipeline-runner.js`, add report generation logic that fires after the pipeline completes (in the async IIFE, after the wave loop finishes, before broadcasting `pipeline-complete`):

1. Create `generateExecutionReport(cwd, results, pipelineStartTime, pipelineStopped)` function:
   - `results` is the array of per-action results: `{ actionId, milestoneId, exitCode, durationMs, startedAt, completedAt, retried, attempts }`
   - Compute overall status: "SUCCESS" if all exitCode === 0, "FAILED" if any !== 0, "STOPPED" if stopped early.
   - Compute total duration from pipelineStartTime to now.

2. For commit SHAs: use `require('node:child_process').execSync` to run `git log --oneline -1` in `cwd`. Wrap in try/catch (git may not be available). This gets the latest commit at pipeline end. For per-action SHAs, check if each action's SUMMARY.md mentions a commit -- but simpler: just capture the HEAD SHA at pipeline start and end. Store `startSha` and `endSha`.

3. Generate markdown report:
```markdown
# Execution Report

**Pipeline:** {manifest source info}
**Status:** {SUCCESS|FAILED|STOPPED}
**Started:** {ISO timestamp}
**Completed:** {ISO timestamp}
**Duration:** {Xm Ys}
**Commits:** {startSha}..{endSha}

## Results

| # | Action | Milestone | Status | Duration | Retried |
|---|--------|-----------|--------|----------|---------|
| 1 | A-111  | M-51      | PASS   | 2m 34s   | No      |
| 2 | A-112  | M-51      | FAIL   | 0m 12s   | Yes (2) |

## Summary

- **Passed:** {N}
- **Failed:** {N}
- **Skipped:** {N} (actions after stop)
- **Total:** {N}
```

4. Write to `path.join(cwd, '.planning', 'execution-report.md')` using `fs.writeFileSync`. Wrap in try/catch -- report generation must never crash the pipeline.

5. Broadcast SSE event `pipeline-report` with `{ path: '.planning/execution-report.md' }` after writing.

6. Record `pipelineStartTime = Date.now()` at the top of the async execution block. Also capture `startSha` via `execSync('git rev-parse --short HEAD', { cwd }).toString().trim()` (try/catch, default to 'unknown').
  </action>
  <verify>
`node -c src/server/pipeline-runner.js` -- syntax OK. Grep for `execution-report.md` confirms report path. Grep for `generateExecutionReport` confirms function exists.
  </verify>
  <done>Pipeline completion writes .planning/execution-report.md with per-action results table, timing, commit SHAs, and overall status. Report generation is fail-safe (never crashes pipeline).</done>
</task>

</tasks>

<verification>
- `node -c src/server/pipeline-runner.js` passes
- `generateExecutionReport` function produces valid markdown
- Report includes per-action results, timing, commit SHAs, overall status
- Report write is wrapped in try/catch
- SSE event `pipeline-report` is broadcast after report generation
</verification>

<success_criteria>
On pipeline completion (success, failure, or stop), .planning/execution-report.md is auto-generated with a markdown table of per-action results including status, timing, retry info, and commit range. The report is broadcast via SSE for UI consumption.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-51-single-go-pipeline-runner/A-113-SUMMARY.md`
</output>
