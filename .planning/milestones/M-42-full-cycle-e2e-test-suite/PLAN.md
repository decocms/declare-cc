# Plan: M-42 -- Full-cycle E2E test suite

**Milestone:** M-42
**Realizes:** D-06
**Status:** PENDING
**Derived:** 2026-02-22

## Actions

### A-117: Write E2E test covering complete D-M-A lifecycle via HTTP API
**Status:** PENDING
**Produces:** Test file exercising create declaration, derive milestones, derive actions, execute action, verify status propagation — all through the server API asserting graph state at each step

### A-118: Add CI-compatible test runner configuration
**Status:** PENDING
**Produces:** npm test runs both unit and E2E tests with E2E suite spinning up temporary server on random port using temp .planning/ directory and cleaning up after
