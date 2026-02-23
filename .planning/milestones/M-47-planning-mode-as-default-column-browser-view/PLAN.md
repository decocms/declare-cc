# Plan: M-47 -- Planning mode as default column browser view

**Milestone:** M-47
**Realizes:** D-14
**Status:** DONE
**Derived:** 2026-02-22

## Actions

### A-100: Make column browser the default view on dashboard load
**Status:** DONE
**Produces:** Dashboard opens in column browser mode by default (not DAG view), DAG available as secondary toggle, user preference persisted in localStorage

### A-101: Add global readiness indicator to planning view
**Status:** DONE
**Produces:** Persistent banner showing N/M plans approved, X need review with clickable links to unapproved nodes — updates live via SSE

### A-102: Integrate review and annotation panel into column browser right pane
**Status:** DONE
**Produces:** Selected item in any column shows artifact content with review state controls (approve/request revision) and annotation interface from M-44 — primary planning work surface
