# A-112 Summary: Add auto-retry on transient failures

**Milestone:** M-51 — Single Go pipeline runner
**Status:** DONE
**Completed:** 2026-02-22

## What was done

Added automatic retry-once logic for transient failures in the pipeline runner:

1. **`isTransientFailure(exitCode, stderrOutput)`** — detects transient errors:
   - Exit codes 124 (timeout), 137 (OOM kill), -1 (spawn error)
   - Stderr patterns: ETIMEDOUT, ECONNRESET, ECONNREFUSED, ENOMEM, SIGKILL, SIGTERM, socket hang up, network timeout

2. **Stderr accumulation** — `executeAction` now accumulates full stderr output alongside line-buffered broadcasting, returning `stderrOutput` in the result.

3. **Retry loop** — After each wave completes, failed actions with transient error signatures are retried once:
   - Broadcasts `action-retry` SSE event before retry
   - Appends retry marker to execution log
   - Uses retry result as final result
   - Skips retry if stop was requested

4. **Result tracking** — `ActionResult` now includes `retried: boolean` and `attempts: number` fields.

## Files modified

- `src/server/pipeline-runner.js` — added `isTransientFailure`, stderr accumulation, retry loop, extended ActionResult typedef
