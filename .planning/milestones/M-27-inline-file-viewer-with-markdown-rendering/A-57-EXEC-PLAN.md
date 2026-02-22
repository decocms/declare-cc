---
milestone: M-27-inline-file-viewer-with-markdown-rendering
action: A-57
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
autonomous: true
declarations:
  - D-08
user_setup: []

must_haves:
  truths:
    - "GET /api/files?path=relative/path returns raw file content with correct Content-Type"
    - "Path traversal attacks are blocked (cannot read files outside project root)"
    - "Non-existent files return 404 with JSON error"
    - "Markdown files return text/plain content (rendering is client-side)"
  artifacts:
    - path: "src/server/index.js"
      provides: "handleFileContent route handler + route wiring"
      contains: "handleFileContent"
  key_links:
    - from: "route() in src/server/index.js"
      to: "handleFileContent()"
      via: "URL match on /api/files"
      pattern: "urlPath.*===.*api/files"
---

<objective>
Add a GET /api/files?path=... endpoint to the Declare server that serves raw file content for produced artifacts.

Purpose: Enables the frontend file viewer (A-58) to fetch file contents from the project. This is the data layer for inline file viewing.
Output: Working API endpoint in the existing server.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GET /api/files endpoint with path traversal guard</name>
  <files>src/server/index.js</files>
  <action>
Add a `handleFileContent` function to src/server/index.js that:

1. Reads the `path` query parameter from the URL (parse req.url for ?path=...).
2. If `path` is missing or empty, returns 400 JSON: `{ error: "Missing 'path' query parameter" }`.
3. Resolves the path relative to `cwd` using `path.resolve(cwd, requestedPath)`.
4. Applies a path traversal guard: the resolved path MUST start with `cwd + path.sep` or equal `cwd`. If not, return 403 JSON: `{ error: "Forbidden" }`. This matches the existing pattern used for `/public/*` static file serving.
5. Checks if the file exists with `fs.existsSync`. If not, returns 404 JSON: `{ error: "File not found" }`.
6. Checks if the path is a directory with `fs.statSync`. If directory, returns 400 JSON: `{ error: "Path is a directory" }`.
7. Reads the file content with `fs.readFileSync(resolvedPath, 'utf-8')`.
8. Returns 200 JSON: `{ path: requestedPath, content: fileContent }`. Use `sendJson` for the response so CORS headers are included automatically.

Wire the route into the `route()` function's GET section. Add it after the `/api/activity` route and before the `/api/action/:id` route:

```js
if (urlPath === '/api/files') {
  handleFileContent(req, res, cwd);
  return;
}
```

Note: Return content as JSON (not raw text) so the frontend can handle rendering. The `sendJson` helper already sets CORS headers. Do NOT add any external dependencies -- use only node:fs, node:path which are already imported.
  </action>
  <verify>
Build the bundle: `npm run build`

Then test with curl (start server first if not running):
- `curl "http://localhost:3847/api/files?path=.planning/MILESTONES.md"` should return JSON with `path` and `content` fields
- `curl "http://localhost:3847/api/files?path=../../etc/passwd"` should return 403 Forbidden
- `curl "http://localhost:3847/api/files?path=nonexistent.txt"` should return 404
- `curl "http://localhost:3847/api/files"` should return 400 missing path
  </verify>
  <done>GET /api/files?path=... returns file content as JSON, path traversal is blocked, missing/invalid paths return appropriate error codes, bundle builds cleanly</done>
</task>

</tasks>

<verification>
- `npm run build` succeeds
- The endpoint serves .md, .js, .json, and other text files from the project
- Path traversal attempts (../) are blocked with 403
- Response includes CORS headers (via sendJson)
</verification>

<success_criteria>
GET /api/files?path=.planning/MILESTONES.md returns 200 with file content in JSON. Traversal paths return 403. Non-existent paths return 404.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-27-inline-file-viewer-with-markdown-rendering/A-57-SUMMARY.md`
</output>
