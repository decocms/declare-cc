# Milestone M-40 Action A-86: Wire topbar items to in-context navigation

Clicking the topbar navigates the column browser to the referenced action/milestone, switching views if needed.

## Changes

### src/server/public/app.js
- Added click handler on `$activityTopbar` element
- Reads `data-actionId` and `data-milestoneId` from topbar dataset
- Auto-switches to column view via `switchView('columns')` if in DAG view
- Resolves full D->M->A chain: finds declaration from milestone's `realizes`, sets `colSelectedDecl` and `colSelectedMile`, then calls `selectNode()`
- Reuses existing `renderColumnBrowser()` and `selectNode()` functions

## Commit
- `e471ca3`: feat(M-40-A-86): wire topbar items to in-context navigation
