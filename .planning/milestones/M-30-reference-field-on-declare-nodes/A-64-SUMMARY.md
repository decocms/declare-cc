# Milestone M-30 Action A-64: Build reference editor and link rendering in UI

Reference section in declaration detail panel with clickable URL links, path badges, and inline editor that saves via PUT API.

## Changes

### src/server/public/app.js
- Added `renderRefSection(item)` function generating Reference section HTML
- Shows clickable `ref-url-badge` links (open in new tab) and `ref-path-badge` spans
- Added `wireRefSection(item)` for edit toggle and save button event handlers
- Save sends PUT to `/api/declarations/:id/ref` and re-renders panel on success
- Integrated into `renderPanelChain` for declaration focus nodes

### src/server/public/index.html
- Added `.ref-link-badge`, `.ref-url-badge`, `.ref-path-badge` styles
- Added `.ref-input`, `.ref-save-btn` editor styles
- All styled consistently with existing dark theme

## Commit
- `65f466b`: feat(M-30-A-64): build reference editor and link rendering in UI
