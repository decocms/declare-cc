# Plan: M-39 -- Tri-part column browser for D→M→A navigation

**Milestone:** M-39
**Realizes:** D-06
**Status:** DONE
**Derived:** 2026-02-21

## Actions

### A-82: Build tri-part column browser layout
**Status:** DONE
**Produces:** Three-column panel (Declaration | Milestone | Action) that fills the main viewport — each column shows the active node in detail, parent columns compress when a child is focused, expanding back on up-navigation

### A-83: Implement keyboard navigation
**Status:** DONE
**Produces:** Arrow key bindings: left/right move between D→M→A levels, up/down move within a level — focus ring always visible, URL or state reflects current position for deep-linking

### A-84: Add DAG/tree view toggle
**Status:** DONE
**Produces:** Toggle control (e.g. top-right button) that switches between the column browser and the existing graph/tree view — both views remain fully functional
