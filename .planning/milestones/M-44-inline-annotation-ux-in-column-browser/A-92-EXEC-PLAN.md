---
milestone: M-44-inline-annotation-ux-in-column-browser
action: A-92
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
autonomous: true
declarations:
  - D-13
user_setup: []

must_haves:
  truths:
    - "POST /api/node/:id/annotations with {line, text} creates an annotation and returns it with a generated id and timestamp"
    - "GET /api/node/:id/annotations returns all annotations for that node as a JSON array"
    - "DELETE /api/node/:id/annotations/:annotationId removes that annotation"
    - "Annotations persist as JSON files in .planning/annotations/{nodeId}.json"
    - "Each annotation has: id (uuid-like), line (number), text (string), timestamp (ISO), resolved (boolean)"
  artifacts:
    - path: "src/server/index.js"
      provides: "Annotation CRUD API endpoints"
      contains: "/api/node/.*annotations"
  key_links:
    - from: "POST /api/node/:id/annotations"
      to: ".planning/annotations/{nodeId}.json"
      via: "fs.readFileSync + fs.writeFileSync"
      pattern: "annotations.*\\.json"
    - from: "GET /api/node/:id/annotations"
      to: ".planning/annotations/{nodeId}.json"
      via: "fs.readFileSync"
      pattern: "readFileSync.*annotations"
---

<objective>
Add annotation storage and CRUD API endpoints to the Declare server.

Purpose: Provide the data layer for inline plan annotations — comments attached to specific line numbers in node artifacts. This enables the iterative review cycle described in D-13.
Output: Three new API endpoints (POST/GET/DELETE) and file-based JSON storage in .planning/annotations/
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
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add annotation CRUD handlers and routes to server</name>
  <files>src/server/index.js</files>
  <action>
Add three new handler functions and wire them into the route() function in src/server/index.js:

**Storage format:** Annotations stored at `.planning/annotations/{nodeId}.json` where nodeId is uppercased (e.g., `D-13.json`, `M-44.json`, `A-92.json`). Each file contains:
```json
{
  "nodeId": "A-92",
  "annotations": [
    { "id": "ann-1708...", "line": 12, "text": "This needs revision", "timestamp": "2026-02-22T...", "resolved": false }
  ]
}
```

**Helper: annotation file I/O**
- `getAnnotationsPath(cwd, nodeId)` — returns `.planning/annotations/{nodeId.toUpperCase()}.json`
- `readAnnotations(cwd, nodeId)` — reads and parses the file, returns `{ nodeId, annotations: [] }` if file missing
- `writeAnnotations(cwd, nodeId, data)` — ensures `.planning/annotations/` dir exists via `fs.mkdirSync({recursive:true})`, writes JSON with 2-space indent

**Handler: handleGetAnnotations(res, cwd, nodeId)**
- Read annotations file for nodeId
- Return 200 with the annotations array

**Handler: handleAddAnnotation(req, res, cwd, nodeId)**
- Read JSON body expecting `{ line: number, text: string }`
- Validate: line must be a number >= 1, text must be a non-empty string
- Generate id: `"ann-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)`
- Create annotation object: `{ id, line, text, timestamp: new Date().toISOString(), resolved: false }`
- Read existing annotations, push new one, write back
- Call `broadcastChange()` after write
- Return 201 with the new annotation object

**Handler: handleDeleteAnnotation(res, cwd, nodeId, annotationId)**
- Read existing annotations
- Filter out the annotation with matching id
- If not found, return 404 `{ error: "Annotation not found" }`
- Write back filtered list
- Call `broadcastChange()` after write
- Return 200 `{ ok: true, id: annotationId }`

**Route wiring in route() function:**
Add BEFORE the existing PUT /api/node/:id/review-state match (around line 1007):

```javascript
// GET /api/node/:id/annotations
const getAnnotationsMatch = method === 'GET' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations$/);
if (getAnnotationsMatch) {
  handleGetAnnotations(res, cwd, getAnnotationsMatch[1]);
  return;
}

// POST /api/node/:id/annotations
const postAnnotationsMatch = method === 'POST' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations$/);
if (postAnnotationsMatch) {
  handleAddAnnotation(req, res, cwd, postAnnotationsMatch[1]);
  return;
}

// DELETE /api/node/:id/annotations/:annotationId
const deleteAnnotationMatch = method === 'DELETE' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations\/([^/]+)$/);
if (deleteAnnotationMatch) {
  handleDeleteAnnotation(res, cwd, deleteAnnotationMatch[1], deleteAnnotationMatch[2]);
  return;
}
```

Note: The GET route must be placed BEFORE the existing GET routes section (after line 1218 where SSE ends and API routes begin) so it doesn't conflict. The POST route goes in the POST section. The DELETE route goes after the existing declaration DELETE match. Follow the existing pattern of the server: sendJson for responses, readJsonBody for POST parsing, path traversal not needed since nodeId is just used as a filename component (uppercased, no path separators).
  </action>
  <verify>
Run: `node -e "require('./src/server/index.js')"` to verify no syntax errors.
Then start the server and test with curl:
- `curl -s http://localhost:3847/api/node/A-92/annotations` should return `{"nodeId":"A-92","annotations":[]}`
- `curl -s -X POST http://localhost:3847/api/node/A-92/annotations -H 'Content-Type: application/json' -d '{"line":5,"text":"test note"}'` should return 201 with annotation object containing id, line, text, timestamp, resolved
- `curl -s http://localhost:3847/api/node/A-92/annotations` should now return the annotation
- `curl -s -X DELETE http://localhost:3847/api/node/A-92/annotations/{id}` should return 200
- Verify `.planning/annotations/A-92.json` file was created and cleaned up
  </verify>
  <done>All three annotation endpoints (GET, POST, DELETE) work correctly. Annotations persist as JSON files in .planning/annotations/. Invalid inputs return 400. Missing annotations return 404 on delete.</done>
</task>

</tasks>

<verification>
- `curl -s http://localhost:3847/api/node/D-13/annotations` returns empty annotations array
- `curl -s -X POST http://localhost:3847/api/node/D-13/annotations -H 'Content-Type: application/json' -d '{"line":1,"text":"review comment"}'` returns 201
- `curl -s http://localhost:3847/api/node/D-13/annotations` returns array with the annotation
- `curl -s -X DELETE http://localhost:3847/api/node/D-13/annotations/{annotationId}` returns 200
- `.planning/annotations/D-13.json` exists on disk with correct structure
- Server starts without errors after changes
</verification>

<success_criteria>
Annotation CRUD endpoints fully functional: create, read, delete. File-based persistence in .planning/annotations/. broadcastChange() called on mutations so SSE clients refresh.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-92-SUMMARY.md`
</output>
