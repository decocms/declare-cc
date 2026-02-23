---
milestone: M-43-review-state-tracked-per-node
action: A-90
type: execute
wave: 2
depends_on:
  - A-89
files_modified:
  - src/server/index.js
autonomous: true
declarations:
  - D-13
user_setup: []

must_haves:
  truths:
    - "PUT /api/node/:id/review-state accepts a valid review state and persists it to the correct artifact file"
    - "PUT /api/node/:id/review-state rejects invalid review states with 400"
    - "PUT /api/node/:id/review-state returns 404 for unknown node IDs"
    - "GET /api/graph response includes reviewState in metadata for all nodes (automatic from A-89)"
    - "SSE change event is broadcast after successful review state update"
  artifacts:
    - path: "src/server/index.js"
      provides: "PUT /api/node/:id/review-state route handler"
      contains: "review-state"
  key_links:
    - from: "src/server/index.js"
      to: "src/artifacts/future.js"
      via: "Reads and writes FUTURE.md to update declaration review state"
      pattern: "parseFutureFile.*writeFutureFile"
    - from: "src/server/index.js"
      to: "src/artifacts/milestones.js"
      via: "Reads and writes MILESTONES.md to update milestone review state"
      pattern: "parseMilestonesFile.*writeMilestonesFile"
    - from: "src/server/index.js"
      to: "src/artifacts/plan.js"
      via: "Reads plan files to update action review state"
      pattern: "parsePlanFile"
    - from: "src/server/index.js"
      to: "src/graph/engine.js"
      via: "Imports VALID_REVIEW_STATES for validation"
      pattern: "VALID_REVIEW_STATES"
---

<objective>
Add a PUT /api/node/:id/review-state endpoint that updates the review state of any D, M, or A node by writing to the appropriate artifact file.

Purpose: Enables the UI (and any client) to transition nodes through review states. The /api/graph response already includes reviewState in metadata (from A-89), so no additional work needed there.
Output: Working PUT endpoint with validation, persistence, and SSE broadcast.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-43-review-state-tracked-per-node/A-89-SUMMARY.md
@src/server/index.js
@src/graph/engine.js
@src/artifacts/future.js
@src/artifacts/milestones.js
@src/artifacts/plan.js
@src/artifacts/milestone-folders.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add PUT /api/node/:id/review-state endpoint to server</name>
  <files>src/server/index.js</files>
  <action>
**Import additions** at the top of server/index.js:
- Import `VALID_REVIEW_STATES` from `'../graph/engine'` (add to existing destructured import from that module).
- Import `parseMilestonesFile, writeMilestonesFile` from `'../artifacts/milestones'` (may already be partially imported via require inside route handlers — add a top-level import).

**Add a `handleUpdateReviewState` function:**

```javascript
async function handleUpdateReviewState(req, res, cwd, nodeId) {
  try {
    const body = await readJsonBody(req);
    const reviewState = body.reviewState;

    if (!reviewState || !VALID_REVIEW_STATES.has(reviewState)) {
      sendJson(res, 400, { error: `Invalid reviewState. Must be one of: ${[...VALID_REVIEW_STATES].join(', ')}` });
      return;
    }

    const id = nodeId.toUpperCase();
    const prefix = id.split('-')[0];
    const planningDir = path.join(cwd, '.planning');

    if (prefix === 'D') {
      // Update declaration in FUTURE.md
      const futurePath = path.join(planningDir, 'FUTURE.md');
      if (!fs.existsSync(futurePath)) { sendJson(res, 404, { error: 'FUTURE.md not found' }); return; }
      const content = fs.readFileSync(futurePath, 'utf-8');
      const declarations = parseFutureFile(content);
      const decl = declarations.find(d => d.id === id);
      if (!decl) { sendJson(res, 404, { error: `Declaration ${id} not found` }); return; }
      decl.reviewState = reviewState;
      const headerMatch = content.match(/^# Future: (.+)/m);
      const projectName = headerMatch ? headerMatch[1].trim() : 'Project';
      fs.writeFileSync(futurePath, writeFutureFile(declarations, projectName), 'utf-8');

    } else if (prefix === 'M') {
      // Update milestone in MILESTONES.md
      const milestonesPath = path.join(planningDir, 'MILESTONES.md');
      if (!fs.existsSync(milestonesPath)) { sendJson(res, 404, { error: 'MILESTONES.md not found' }); return; }
      const content = fs.readFileSync(milestonesPath, 'utf-8');
      const { milestones } = parseMilestonesFile(content);
      const mile = milestones.find(m => m.id === id);
      if (!mile) { sendJson(res, 404, { error: `Milestone ${id} not found` }); return; }
      mile.reviewState = reviewState;
      const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
      const pName = nameMatch ? nameMatch[1].trim() : 'Project';
      fs.writeFileSync(milestonesPath, writeMilestonesFile(milestones, pName), 'utf-8');

    } else if (prefix === 'A') {
      // Update action in its milestone's PLAN.md
      // Find which milestone folder contains this action
      const milestonesDir = path.join(planningDir, 'milestones');
      if (!fs.existsSync(milestonesDir)) { sendJson(res, 404, { error: 'No milestones directory' }); return; }
      let found = false;
      const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
        const planPath = path.join(milestonesDir, entry.name, 'PLAN.md');
        if (!fs.existsSync(planPath)) continue;
        const content = fs.readFileSync(planPath, 'utf-8');
        const parsed = parsePlanFile(content);
        const action = parsed.actions.find(a => a.id === id);
        if (!action) continue;
        // Found the action — update its reviewState and rewrite the file
        // Use a line-level patch approach similar to updateActionStatus:
        // Find the ### A-XX section, then find or insert **Review:** line after **Status:**
        const lines = content.split('\n');
        let inSection = false;
        let patched = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('### ')) {
            inSection = lines[i].startsWith(`### ${id}:`);
          }
          if (inSection && !patched && /^\*\*Review:\*\*/i.test(lines[i].trim())) {
            lines[i] = `**Review:** ${reviewState}`;
            patched = true;
            break;
          }
          // If we hit the next field or section without finding Review, insert after Status
          if (inSection && !patched && /^\*\*Status:\*\*/i.test(lines[i].trim())) {
            // Check if next line is **Review:**
            if (i + 1 < lines.length && /^\*\*Review:\*\*/i.test(lines[i + 1].trim())) {
              lines[i + 1] = `**Review:** ${reviewState}`;
              patched = true;
            } else {
              // Insert Review line after Status
              lines.splice(i + 1, 0, `**Review:** ${reviewState}`);
              patched = true;
            }
            break;
          }
        }
        if (patched) {
          fs.writeFileSync(planPath, lines.join('\n'), 'utf-8');
          found = true;
        }
        break;
      }
      if (!found) { sendJson(res, 404, { error: `Action ${id} not found in any PLAN.md` }); return; }

    } else {
      sendJson(res, 400, { error: `Unknown node type prefix: ${prefix}` });
      return;
    }

    sendJson(res, 200, { ok: true, id, reviewState });
    broadcastChange();
  } catch (err) {
    sendJson(res, 500, { error: String(err) });
  }
}
```

**Wire the route** in the `route()` function. Add a PUT route match BEFORE the existing `declPutMatch` block (around line 897). Place it in the PUT handling section:

```javascript
const reviewStateMatch = method === 'PUT' && urlPath.match(/^\/api\/node\/([^/]+)\/review-state$/);
if (reviewStateMatch) {
  handleUpdateReviewState(req, res, cwd, reviewStateMatch[1]);
  return;
}
```

Note: The action update uses a line-level patch (similar to `updateActionStatus` in plan.js) rather than full rewrite to avoid reformatting the entire PLAN.md. This is important because PLAN.md files may have hand-edited content.
  </action>
  <verify>
After building (`npm run build`), start the server and test:

1. `curl -X PUT http://localhost:3847/api/node/D-06/review-state -H 'Content-Type: application/json' -d '{"reviewState":"in_review"}'` — should return `{"ok":true,"id":"D-06","reviewState":"in_review"}`.
2. `curl -X PUT http://localhost:3847/api/node/D-06/review-state -H 'Content-Type: application/json' -d '{"reviewState":"invalid"}'` — should return 400.
3. `curl -X PUT http://localhost:3847/api/node/D-99/review-state -H 'Content-Type: application/json' -d '{"reviewState":"draft"}'` — should return 404.
4. `curl http://localhost:3847/api/graph | node -e "process.stdin.on('data',d=>{const g=JSON.parse(d);const d6=g.declarations.find(x=>x.id==='D-06');console.log('D-06 reviewState via metadata:',d6)})"` — should show review state in the response.

Alternatively, verify without server: `node -e "const fs=require('fs'); const {parseFutureFile}=require('./src/artifacts/future'); const c=fs.readFileSync('.planning/FUTURE.md','utf-8'); const d=parseFutureFile(c); console.log(d.map(x=>x.id+': '+x.reviewState));"` — after the PUT, D-06 should show 'in_review'.

**Reset D-06 back to draft** after testing: `curl -X PUT http://localhost:3847/api/node/D-06/review-state -H 'Content-Type: application/json' -d '{"reviewState":"draft"}'`
  </verify>
  <done>
PUT /api/node/:id/review-state endpoint works for D-, M-, and A- prefixed nodes. Validates review state against VALID_REVIEW_STATES. Persists to the correct artifact file. Returns 400 for invalid states, 404 for unknown nodes. Broadcasts SSE change event on success. GET /api/graph includes reviewState in node metadata automatically.
  </done>
</task>

</tasks>

<verification>
1. PUT endpoint returns 200 with `{ok, id, reviewState}` for valid requests to D, M, and A nodes
2. PUT endpoint returns 400 for invalid reviewState values
3. PUT endpoint returns 404 for non-existent node IDs
4. After PUT, the artifact file on disk contains the updated review state
5. After PUT, GET /api/graph returns the updated reviewState in node metadata
6. SSE 'change' event fires after successful update
</verification>

<success_criteria>
- PUT /api/node/:id/review-state accepts {reviewState: "draft"|"in_review"|"revision_needed"|"approved"}
- Updates persist to FUTURE.md (declarations), MILESTONES.md (milestones), or PLAN.md (actions)
- Invalid states rejected with 400, unknown nodes with 404
- SSE broadcast triggers after update
- GET /api/graph response includes reviewState on all nodes (via metadata, automatic from A-89)
</success_criteria>

<output>
After completion, create `.planning/milestones/M-43-review-state-tracked-per-node/A-90-SUMMARY.md`
</output>
