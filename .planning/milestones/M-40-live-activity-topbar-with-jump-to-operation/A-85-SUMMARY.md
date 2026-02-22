# Milestone M-40 Action A-85: Build persistent activity topbar

Fixed 28px topbar strip at page top showing current running operation with spinner, or last completed operation with relative time.

## Changes

### src/server/public/index.html
- Added `#activity-topbar` div at very top of body, above status bar
- Added `--topbar-height: 28px` CSS variable
- Updated `#side-panel` top/height to account for topbar height
- Styled `.topbar-spinner`, `.topbar-label`, `.topbar-idle-label`, `.topbar-detail`

### src/server/public/app.js
- Added topbar state: `topbarActiveOp`, `topbarLastOp`
- `updateTopbar()` renders spinner+label when active, idle message when not
- `syncTopbarFromRunning()` initializes from `/api/running` on page load
- `topbarOnActionComplete(actionId)` handles SSE action-complete events
- `topbarOnActivity()` detects action starts from activity.jsonl via SSE
- Wired into `connectSSE()` event listeners and `loadData()` flow
- Auto-refreshes relative times every 30 seconds

## Commit
- `ce9ef35`: feat(M-40-A-85): build persistent activity topbar
