---
milestone: M-51-single-go-pipeline-runner
action: A-112
type: execute
wave: 2
depends_on: ["A-111"]
files_modified:
  - src/server/pipeline-runner.js
autonomous: true
declarations: ["D-15"]
must_haves:
  truths:
    - "When an action fails with a transient error pattern, it is retried once automatically"
    - "When retry also fails, the action is marked as failed with both attempts recorded"
    - "Non-transient failures are not retried"
    - "Retry attempts are visible in SSE events"
  artifacts:
    - path: "src/server/pipeline-runner.js"
      provides: "Retry logic in executeAction"
      contains: "isTransientFailure"
  key_links:
    - from: "src/server/pipeline-runner.js"
      to: "exit code + stderr"
      via: "pattern matching on error output"
      pattern: "ETIMEDOUT|ECONNRESET|ENOMEM|signal"
---

<objective>
Add automatic retry-once logic for transient failures in the pipeline runner, so flaky network or resource issues do not halt the entire pipeline.

Purpose: D-15 declares "the default path is uninterrupted completion" -- transient failures should self-heal before requiring human intervention.
Output: Updated pipeline-runner.js with retry logic
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
  <name>Task 1: Add transient failure detection and retry logic</name>
  <files>src/server/pipeline-runner.js</files>
  <action>
In `src/server/pipeline-runner.js`, add retry-once logic to the pipeline execution flow:

1. Create `isTransientFailure(exitCode, stderrOutput)` function that returns true if:
   - Exit code is 124 or 137 (timeout/OOM kill signals)
   - Exit code is -1 (spawn error / connection issue)
   - stderr contains any of: `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `ENOMEM`, `SIGKILL`, `SIGTERM`, `socket hang up`, `network timeout`
   - Case-insensitive matching on stderr patterns.

2. Modify `executeAction` to accumulate stderr into a buffer (in addition to broadcasting it). Return the stderr buffer alongside exitCode in the result: `{ actionId, exitCode, stderrOutput, durationMs, startedAt, completedAt }`.

3. In the wave execution loop (where Promise.all runs), after collecting results, check each failed result (exitCode !== 0). For each failure where `isTransientFailure(exitCode, stderrOutput)` returns true:
   - Broadcast SSE event `action-retry` with `{ actionId, milestoneId, attempt: 2, reason: 'transient failure detected' }`
   - Append to log: `=== RETRY ${actionId} (attempt 2) ===`
   - Re-execute the action (call executeAction again)
   - Use the retry result as the final result

4. Track retry state per action in results: add `retried: boolean, attempts: number` fields. The `pipeline-complete` event should include retry info.

5. Do NOT retry if `stopRequested` is true.

Keep it simple: max 1 retry. No exponential backoff. No delay between attempts (the transient issue is likely already resolved by the time the process exited).
  </action>
  <verify>
`node -c src/server/pipeline-runner.js` -- syntax OK. Grep for `isTransientFailure` in the file confirms function exists. Grep for `action-retry` confirms SSE event is broadcast.
  </verify>
  <done>Transient failures (timeout, connection reset, OOM) trigger one automatic retry. Non-transient failures fail immediately. Retry attempts are tracked and broadcast via SSE.</done>
</task>

</tasks>

<verification>
- `node -c src/server/pipeline-runner.js` passes
- `isTransientFailure` function handles all specified patterns
- Retry logic only fires for transient patterns, not for general exit code !== 0
- SSE event `action-retry` is broadcast before retry attempt
</verification>

<success_criteria>
On action failure with transient error signature, pipeline automatically retries once before marking as failed. Non-transient failures are not retried. Retry attempts are visible in SSE stream and execution log.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-51-single-go-pipeline-runner/A-112-SUMMARY.md`
</output>
