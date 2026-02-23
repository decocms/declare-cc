# Plan: M-45 -- Agent completion with result navigation

**Milestone:** M-45
**Realizes:** D-16
**Status:** PENDING
**Derived:** 2026-02-23

## Actions

### A-127: Capture result metadata on agent completion
**Status:** PENDING
**Produces:** Server-side logic in agent registry that records what artifact an agent produced (PLAN.md path, milestone IDs, action ID, execution log path) as structured result data

### A-128: Build done-state card with navigation action
**Status:** PENDING
**Produces:** Card variant showing completion summary, elapsed time, and a View Result button that navigates to the appropriate dashboard view

### A-129: Implement result routing logic
**Status:** PENDING
**Produces:** navigateToResult(agent) function that maps agent type + result metadata to the correct dashboard navigation action
