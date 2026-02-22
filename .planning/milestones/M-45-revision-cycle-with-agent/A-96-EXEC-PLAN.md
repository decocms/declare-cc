---
milestone: M-45-revision-cycle-with-agent
action: A-96
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/index.js
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations:
  - D-13

must_haves:
  truths:
    - "Annotation JSON files include a revisionRound counter in metadata"
    - "Annotation panel header shows 'Round N' when revisionRound >= 1"
    - "revisionRound starts at 0 (no revisions yet) and is accessible via GET annotations API"
  artifacts:
    - path: "src/server/index.js"
      provides: "revisionRound metadata in annotation storage, exposed via GET API"
      contains: "revisionRound"
    - path: "src/server/public/app.js"
      provides: "Round counter display in annotation panel header"
      contains: "Round"
    - path: "src/server/public/index.html"
      provides: "CSS styles for revision round badge"
      contains: "revision-round"
  key_links:
    - from: "src/server/index.js"
      to: ".planning/annotations/{nodeId}.json"
      via: "readAnnotations returns revisionRound field"
      pattern: "revisionRound"
    - from: "src/server/public/app.js"
      to: "/api/node/:id/annotations"
      via: "fetch reads revisionRound from response"
      pattern: "revisionRound"
---

<objective>
Add revision round tracking to annotation metadata and display the round counter in the annotation panel header.

Purpose: Enable tracking of how many revision cycles a node has been through, providing visibility into the iterative review process. This is the data foundation that A-95 (revision request) will increment.
Output: revisionRound field in annotation JSON, round counter visible in annotation panel header.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/milestones/M-45-revision-cycle-with-agent/PLAN.md
@.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-93-SUMMARY.md
@.planning/milestones/M-44-inline-annotation-ux-in-column-browser/A-94-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add revisionRound to annotation storage and API</name>
  <files>src/server/index.js</files>
  <action>
Modify the annotation data layer in src/server/index.js:

1. In `readAnnotations()`: When returning the default empty structure, include `revisionRound: 0`. When reading from disk, default `revisionRound` to 0 if not present in the JSON (backwards compat): `const data = JSON.parse(...); data.revisionRound = data.revisionRound || 0; return data;`

2. In `handleGetAnnotations()`: No change needed — it already returns the full data object from readAnnotations, so revisionRound will be included automatically.

3. Add a new endpoint `POST /api/node/:id/annotations/increment-round`:
   - Handler: `handleIncrementRevisionRound(res, cwd, nodeId)`
   - Read annotations, increment `data.revisionRound` by 1, write back, broadcastChange()
   - Return 200 with `{ ok: true, revisionRound: data.revisionRound }`
   - Wire into the route function alongside other annotation routes (match pattern: `method === 'POST' && urlPath.match(/^\/api\/node\/([^/]+)\/annotations\/increment-round$/)`)

The revisionRound will be incremented by A-95's revision request flow when a revision completes.
  </action>
  <verify>
Start server and test:
- `curl -s http://localhost:3847/api/node/A-95/annotations | jq .revisionRound` returns 0
- `curl -s -X POST http://localhost:3847/api/node/A-95/annotations/increment-round | jq .revisionRound` returns 1
- `curl -s http://localhost:3847/api/node/A-95/annotations | jq .revisionRound` returns 1
  </verify>
  <done>Annotations JSON includes revisionRound field defaulting to 0, increment-round endpoint works, backwards compatible with existing annotation files that lack the field.</done>
</task>

<task type="auto">
  <name>Task 2: Display revision round counter in annotation panel header</name>
  <files>src/server/public/app.js, src/server/public/index.html</files>
  <action>
In src/server/public/app.js, modify `renderAnnotationPanel()`:

1. After fetching annotations (the `const annData = await annRes.json()` block around line 1305), extract the revision round: `const revisionRound = annData.revisionRound || 0;`

2. Modify the `headerHtml` (around line 1343) to include a round badge when revisionRound >= 1. Insert between "Annotations" text and the comment count span:
```
const roundBadge = revisionRound >= 1
  ? `<span class="revision-round-badge">Round ${revisionRound}</span>`
  : '';
```
Update headerHtml to include roundBadge after "Annotations" text.

In src/server/public/index.html, add CSS for the round badge:
- `.revision-round-badge`: background #e8e0ff (light purple), color #5b21b6, font-size 11px, padding 2px 8px, border-radius 10px, font-weight 600, margin-left 8px
  </action>
  <verify>
Open dashboard, select a node with annotations. If revisionRound is 0, no badge shows. Use curl to increment-round, refresh panel, see "Round 1" badge in the header.
  </verify>
  <done>Annotation panel header shows "Round N" badge when revisionRound >= 1, no badge when 0. Badge is styled with a distinct purple pill appearance.</done>
</task>

</tasks>

<verification>
- Server starts without errors after all changes
- GET /api/node/:id/annotations includes revisionRound field
- POST /api/node/:id/annotations/increment-round increments and returns new value
- Annotation panel header shows round badge conditionally
- Existing annotations without revisionRound field still load correctly (defaults to 0)
</verification>

<success_criteria>
Revision round counter is stored in annotation metadata, accessible via API, incrementable via dedicated endpoint, and visually displayed in the annotation panel header when >= 1.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-45-revision-cycle-with-agent/A-96-SUMMARY.md`
</output>
