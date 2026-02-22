# Plan: M-52 -- Pipeline progress and failure handling

**Milestone:** M-52
**Realizes:** D-15
**Status:** PENDING
**Derived:** 2026-02-22

## Actions

### A-114: Build wave-by-wave progress display
**Status:** PENDING
**Produces:** Execution view shows current wave number (Wave 2/5), per-action status indicators (queued/running/done/failed) with live transitions, overall progress bar with percentage — all driven by SSE events

### A-115: Implement pause-on-failure with skip and stop options
**Status:** PENDING
**Produces:** On critical action failure (after retry exhausted) pipeline pauses and shows modal: Action failed with View Output, Skip and Continue, Stop Pipeline options

### A-116: Persist execution state across browser refresh
**Status:** PENDING
**Produces:** Execution progress state (current wave, action statuses, output buffer) persisted server-side and restored on page reload — SSE reconnect picks up from current state
