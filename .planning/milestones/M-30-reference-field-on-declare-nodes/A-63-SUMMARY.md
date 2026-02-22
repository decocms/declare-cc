# Milestone M-30 Action A-63: Add ref field to declaration schema

Optional ref: { url?, path? } field on declarations, parsed from/written to FUTURE.md, passed to DAG metadata, with PUT API endpoint for updates.

## Changes

### src/artifacts/future.js
- Parse optional `**Ref:** url=X path=Y` field from FUTURE.md sections
- Write ref field back to canonical format when present
- Updated JSDoc types to include `ref?: {url?: string, path?: string}`

### src/commands/build-dag.js
- Pass `ref` from declaration data into DAG node metadata object

### src/server/index.js
- Added `parseFutureFile` and `writeFutureFile` imports
- Added `PUT /api/declarations/:id/ref` route that reads FUTURE.md, updates the ref field on the matched declaration, and writes back

## Commit
- `1217898`: feat(M-30-A-63): add ref field to declaration schema
