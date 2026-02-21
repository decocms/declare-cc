---
action: A-81
milestone: M-38
status: DONE
model: opus
started: 2026-02-21
completed: 2026-02-21
---

# A-81: Surface model used per action in the dashboard

## What was done

Added model badge rendering to the dashboard action detail panel.

### Backend (get-exec-plan.js)
- Added `resolveActionModel()` function that reads model from SUMMARY.md frontmatter first, falls back to config.json `modelAssignment.executor`
- `model` field now included in all API response paths (both exec-plan-found and no-exec-plan cases)

### Frontend (app.js)
- Model badge renders in the exec-plan metadata bar alongside Wave, Autonomous, and Executed badges
- Color-coded by tier: OPUS (purple), SONNET (blue), HAIKU (green)
- Visually distinct: smaller font, monospace, letter-spaced, colored border

## Files modified
- `src/commands/get-exec-plan.js` — added `resolveActionModel()`, `model` field in response
- `src/server/public/app.js` — model badge rendering
- `dist/public/app.js` — built copy
- `dist/declare-tools.cjs` — rebuilt bundle
