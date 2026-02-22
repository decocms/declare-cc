---
milestone: M-50-execution-order-configuration
action: A-110
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
  - src/commands/play.js
autonomous: true
declarations: ["D-15"]

must_haves:
  truths:
    - "POST /api/execution-manifest saves wave order as .planning/execution-manifest.json"
    - "GET /api/execution-manifest returns current manifest or 404 if none"
    - "Manifest contains waves array with milestone order and action order per milestone"
    - "Play runner reads manifest file when present instead of computing order dynamically"
  artifacts:
    - path: "src/server/index.js"
      provides: "POST /api/execution-manifest and GET /api/execution-manifest endpoints"
      contains: "execution-manifest"
    - path: "src/commands/play.js"
      provides: "Manifest-aware play order — reads execution-manifest.json if it exists"
      contains: "execution-manifest"
  key_links:
    - from: "POST /api/execution-manifest"
      to: ".planning/execution-manifest.json"
      via: "fs.writeFileSync"
      pattern: "execution-manifest\\.json"
    - from: "src/commands/play.js"
      to: ".planning/execution-manifest.json"
      via: "fs.readFileSync with fallback to computePlayOrder"
      pattern: "execution-manifest"
---

<objective>
Create the execution manifest persistence layer: a POST endpoint to save the confirmed execution order as .planning/execution-manifest.json, a GET endpoint to retrieve it, and update the play runner to use the manifest when available.

Purpose: D-15 requires confirmed execution order to be saved and reusable. The manifest decouples order confirmation from execution — the user confirms once, the runner reads the manifest, and re-runs use the same order.

Output: Two new API endpoints and manifest-aware play runner.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/FUTURE.md
@.planning/STATE.md
@src/server/index.js (API route handling pattern — POST routes at lines ~1540-1617, GET routes at lines ~1636-1710, sendJson helper)
@src/commands/play.js (computePlayOrder function lines 30-120, createPlayRunner start method using computePlayOrder at line ~249)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add execution manifest API endpoints</name>
  <files>src/server/index.js</files>
  <action>
Add two new API routes to the server, following the existing route pattern (manual URL matching, sendJson responses):

1. **POST /api/execution-manifest** — Save manifest
   - Parse JSON body with structure: `{ waves: Array<{ waveNumber: number, milestones: Array<{ id: string, actions: string[] }> }> }`
   - Validate: waves must be a non-empty array, each wave must have milestones array, each milestone must have id (string) and actions (string array)
   - Write to `path.join(cwd, '.planning', 'execution-manifest.json')` using `fs.writeFileSync` with `JSON.stringify(body, null, 2)`
   - Add `confirmedAt: new Date().toISOString()` to the saved object
   - Return 200 `{ ok: true }`
   - On validation error return 400 `{ error: "description" }`

2. **GET /api/execution-manifest** — Read manifest
   - Read from `path.join(cwd, '.planning', 'execution-manifest.json')`
   - If file exists, parse and return 200 with the JSON content
   - If file doesn't exist, return 404 `{ error: "No execution manifest found" }`

Add the POST route in the POST section (before the "Route not found" fallback at line ~1617):
```
if (urlPath === '/api/execution-manifest') {
  handleSaveManifest(req, res, cwd);
  return;
}
```

Add the GET route in the GET section (after /api/readiness around line ~1700):
```
if (urlPath === '/api/execution-manifest') {
  handleGetManifest(res, cwd);
  return;
}
```

Create handler functions `handleSaveManifest(req, res, cwd)` and `handleGetManifest(res, cwd)` following the same pattern as other handlers (readBody for POST, sendJson for responses).
  </action>
  <verify>
    1. Start server: `node src/server/index.js`
    2. POST test: `curl -X POST http://localhost:3847/api/execution-manifest -H 'Content-Type: application/json' -d '{"waves":[{"waveNumber":1,"milestones":[{"id":"M-50","actions":["A-108","A-110"]}]}]}'` — returns `{"ok":true}`
    3. Verify file exists: `cat .planning/execution-manifest.json` — shows saved JSON with confirmedAt timestamp
    4. GET test: `curl http://localhost:3847/api/execution-manifest` — returns the saved manifest
    5. Validation test: `curl -X POST http://localhost:3847/api/execution-manifest -H 'Content-Type: application/json' -d '{"waves":[]}'` — returns 400
  </verify>
  <done>POST /api/execution-manifest saves validated manifest to .planning/execution-manifest.json. GET /api/execution-manifest returns it or 404.</done>
</task>

<task type="auto">
  <name>Task 2: Make play runner manifest-aware</name>
  <files>src/commands/play.js</files>
  <action>
Modify the play runner to check for an execution manifest before computing order dynamically.

In `createPlayRunner` (or wherever `computePlayOrder` is called to start execution, around line 249):

1. Before calling `computePlayOrder(graph)`, check if `.planning/execution-manifest.json` exists:
   ```
   const manifestPath = path.join(cwd, '.planning', 'execution-manifest.json');
   let manifestOrder = null;
   try {
     const raw = fs.readFileSync(manifestPath, 'utf8');
     manifestOrder = JSON.parse(raw);
   } catch (_) {}
   ```

2. If `manifestOrder` exists and has a non-empty `waves` array, use it instead of `computePlayOrder`:
   - Convert manifest format `{ waves: [{ waveNumber, milestones: [{ id, actions }] }] }` to the same format that `computePlayOrder` returns: `{ waves: [[ { milestoneId, actions } ]] }`
   - Map each manifest wave's milestones to `{ milestoneId: m.id, actions: m.actions }`
   - Filter out actions that are already DONE (check against graph.actions status)
   - Filter out milestones where all actions are DONE (empty actions array after filtering)
   - Filter out empty waves

3. If manifest doesn't exist or has empty waves after filtering, fall back to `computePlayOrder(graph)` as before.

4. Export a helper `loadManifest(cwd)` for potential reuse, alongside existing exports.

This is a surgical change — the manifest just replaces the order computation, not the execution logic.
  </action>
  <verify>
    1. Create a test manifest: write a simple .planning/execution-manifest.json manually
    2. Run play and verify it uses manifest order (check logs or output)
    3. Delete the manifest and run play — falls back to computed order
    4. Run existing tests: `npm test` (if any play tests exist)
  </verify>
  <done>Play runner reads execution-manifest.json when present and uses its wave order. Falls back to computePlayOrder when no manifest exists. DONE actions filtered out from manifest before execution.</done>
</task>

</tasks>

<verification>
- POST endpoint saves valid manifest, rejects invalid input
- GET endpoint returns manifest or 404
- Manifest file written to .planning/execution-manifest.json with correct structure
- Play runner uses manifest order when file exists
- Play runner falls back to dynamic computation when manifest is absent
- Existing play behavior unaffected when no manifest present
</verification>

<success_criteria>
Execution manifest can be saved via API, persisted to disk, and consumed by the play runner. The confirmed order governs execution instead of dynamic computation.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-50-execution-order-configuration/A-110-SUMMARY.md`
</output>
