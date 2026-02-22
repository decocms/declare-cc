---
milestone: M-18-browser-based-declaration-capture
action: A-35
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
  - src/commands/update-declaration.js
  - src/commands/delete-declaration.js
  - src/declare-tools.js
autonomous: true
declarations: ["D-06"]

must_haves:
  truths:
    - "POST /api/declarations with title+statement creates a new declaration in FUTURE.md and returns the created object with auto-incremented ID"
    - "PUT /api/declarations/:id with title and/or statement updates an existing declaration in FUTURE.md"
    - "DELETE /api/declarations/:id removes a declaration from FUTURE.md (or marks RENEGOTIATED)"
    - "All write endpoints commit to git automatically when config.commit_docs is true"
    - "SSE change event fires after each mutation so the dashboard live-updates"
  artifacts:
    - path: "src/commands/update-declaration.js"
      provides: "Declaration update logic"
      exports: ["runUpdateDeclaration"]
    - path: "src/commands/delete-declaration.js"
      provides: "Declaration delete logic"
      exports: ["runDeleteDeclaration"]
    - path: "src/server/index.js"
      provides: "CRUD API routes for declarations"
      contains: "/api/declarations"
  key_links:
    - from: "src/server/index.js"
      to: "src/commands/add-declaration.js"
      via: "require and call runAddDeclaration"
      pattern: "runAddDeclaration"
    - from: "src/server/index.js"
      to: "src/commands/update-declaration.js"
      via: "require and call runUpdateDeclaration"
      pattern: "runUpdateDeclaration"
    - from: "src/server/index.js"
      to: "src/commands/delete-declaration.js"
      via: "require and call runDeleteDeclaration"
      pattern: "runDeleteDeclaration"
---

<objective>
Add declaration CRUD API endpoints to the Declare server.

Purpose: Enable the dashboard frontend to create, update, and delete declarations via HTTP, removing the need to use the CLI for declaration management. This is the backend foundation for M-18's browser-based declaration capture.

Output: Three API endpoints (POST/PUT/DELETE /api/declarations) wired to FUTURE.md parser/writer with git commit on each mutation.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/server/index.js
@src/artifacts/future.js
@src/commands/add-declaration.js
@src/commands/renegotiate.js
@src/git/commit.js
@src/declare-tools.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create update-declaration and delete-declaration CJS commands</name>
  <files>
    src/commands/update-declaration.js
    src/commands/delete-declaration.js
  </files>
  <action>
Create two new CJS command modules following the exact pattern of src/commands/add-declaration.js:

**src/commands/update-declaration.js:**
- Export `runUpdateDeclaration(cwd, args)` accepting `--id`, `--title` (optional), `--statement` (optional), `--status` (optional)
- At least one of title/statement/status must be provided
- Read FUTURE.md via `parseFutureFile`, find declaration by ID, update provided fields, write back via `writeFutureFile`
- Extract projectName from the FUTURE.md header line (`# Future: ...`) like renegotiate.js does (not basename — existing declarations may have been written with a different name)
- Commit via `commitPlanningDocs` with message `declare: update {id} "{title}"`
- Return `{ id, title, statement, status, committed, hash }` on success, `{ error }` on failure

**src/commands/delete-declaration.js:**
- Export `runDeleteDeclaration(cwd, args)` accepting `--id`
- Read FUTURE.md via `parseFutureFile`, filter out the declaration with matching ID, write back via `writeFutureFile`
- If declaration has milestones linked (milestones array non-empty), return error: "Cannot delete declaration with linked milestones. Renegotiate instead."
- Extract projectName from FUTURE.md header
- Commit via `commitPlanningDocs` with message `declare: delete {id} "{title}"`
- Return `{ id, title, deleted: true, committed, hash }` on success, `{ error }` on failure

Both modules: zero runtime deps, use node:fs and node:path, follow JSDoc style from existing commands.
  </action>
  <verify>
Run `node -e "require('./src/commands/update-declaration.js')"` and `node -e "require('./src/commands/delete-declaration.js')"` — both should load without errors.
  </verify>
  <done>Both modules export their run functions and follow the established CJS command pattern.</done>
</task>

<task type="auto">
  <name>Task 2: Add declaration CRUD routes to the server and wire CLI commands</name>
  <files>
    src/server/index.js
    src/declare-tools.js
  </files>
  <action>
**In src/server/index.js:**

1. Add a `readJsonBody(req)` helper at the top (after sendJson) that returns a Promise resolving to the parsed JSON body. Collect chunks via `req.on('data')`, join, `JSON.parse`. Reject on parse error. Cap at 64KB to prevent abuse.

2. Add requires at the top:
   ```js
   const { runAddDeclaration } = require('../commands/add-declaration');
   const { runUpdateDeclaration } = require('../commands/update-declaration');
   const { runDeleteDeclaration } = require('../commands/delete-declaration');
   ```

3. Update CORS preflight to allow PUT and DELETE methods: `'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'`. Also update the method guard to allow PUT and DELETE.

4. Add three route handlers (async, using readJsonBody):

   **POST /api/declarations** — Read JSON body `{ title, statement }`. Call `runAddDeclaration(cwd, ['--title', body.title, '--statement', body.statement])`. Return 201 with result or 400 with error. After success, call `broadcastChange()`.

   **PUT /api/declarations/:id** — Read JSON body `{ title?, statement?, status? }`. Build args array from provided fields. Call `runUpdateDeclaration(cwd, args)`. Return 200 with result or 400/404 with error. After success, call `broadcastChange()`.

   **DELETE /api/declarations/:id** — Call `runDeleteDeclaration(cwd, ['--id', id])`. Return 200 with result or 400/404 with error. After success, call `broadcastChange()`.

5. Wire the routes in the `route()` function's POST section (and add PUT/DELETE handling). Use url pattern matching like existing routes: `/api/declarations` for POST, `/api/declarations/([^/]+)` for PUT and DELETE.

6. Make the `route()` function async-aware: wrap handler calls that are async in `.catch(err => sendJson(res, 500, { error: String(err) }))`.

**In src/declare-tools.js:**

Add `update-declaration` and `delete-declaration` cases in the switch statement, following the exact pattern of `add-declaration`. Import the run functions at the top with the other requires.

After all changes, rebuild the CJS bundle: `npm run build` (or whatever the build command is — check package.json).
  </action>
  <verify>
Start the server with `node dist/declare-tools.cjs serve` and test:
- `curl -X POST http://localhost:3847/api/declarations -H 'Content-Type: application/json' -d '{"title":"Test","statement":"Test statement"}'` returns 201 with `id: "D-XX"`
- `curl -X PUT http://localhost:3847/api/declarations/D-XX -H 'Content-Type: application/json' -d '{"title":"Updated"}'` returns 200
- `curl -X DELETE http://localhost:3847/api/declarations/D-XX` returns 200
- Verify FUTURE.md was modified and git log shows commits
  </verify>
  <done>All three declaration CRUD endpoints respond correctly, persist to FUTURE.md, commit to git, and broadcast SSE change events.</done>
</task>

</tasks>

<verification>
- POST /api/declarations creates declaration, returns 201, commits to git
- PUT /api/declarations/:id updates declaration, returns 200, commits to git
- DELETE /api/declarations/:id removes declaration, returns 200, commits to git
- Invalid requests (missing fields, non-existent ID) return appropriate 400/404 errors
- SSE change event broadcasts after each mutation
- `node dist/declare-tools.cjs update-declaration --id D-XX --title "New"` works from CLI
- `node dist/declare-tools.cjs delete-declaration --id D-XX` works from CLI
</verification>

<success_criteria>
Declaration CRUD is fully functional via both HTTP API and CLI. FUTURE.md stays in canonical format after mutations. Git commits are created for each change. Dashboard receives SSE notifications for live refresh.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-18-browser-based-declaration-capture/A-35-SUMMARY.md`
</output>
