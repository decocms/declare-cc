---
milestone: M-28-commit-and-output-linking-per-action
action: A-59
type: execute
wave: 1
depends_on: []
files_modified:
  - src/commands/get-exec-plan.js
  - src/server/index.js
  - dist/declare-tools.cjs
autonomous: true
declarations:
  - D-08

must_haves:
  truths:
    - "GET /api/action/:id returns a commits array with SHA, message, and date for each commit matching that action"
    - "Commits are extracted from git log by matching the M-XX-A-YY pattern in commit messages"
    - "Actions with no matching commits return an empty commits array"
  artifacts:
    - path: "src/commands/get-exec-plan.js"
      provides: "getActionCommits() function and commits field in API response"
    - path: "src/server/index.js"
      provides: "Passes cwd to runGetExecPlan so git log can run"
  key_links:
    - from: "src/commands/get-exec-plan.js"
      to: "git log"
      via: "execSync child_process call"
      pattern: "execSync.*git.*log"
    - from: "src/server/index.js"
      to: "src/commands/get-exec-plan.js"
      via: "runGetExecPlan call with cwd"
      pattern: "runGetExecPlan"
---

<objective>
Add commit metadata extraction to the action detail API so that each action's associated git commits (matched by M-XX-A-YY pattern in commit messages) are returned as structured data.

Purpose: Enable the frontend (A-60) to display clickable commit hashes per action, fulfilling D-08's "commit outputs are linked" requirement.
Output: Enhanced /api/action/:id response with a `commits` array containing SHA, message, and date fields.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@src/commands/get-exec-plan.js
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add getActionCommits() to get-exec-plan.js</name>
  <files>src/commands/get-exec-plan.js</files>
  <action>
Add a `getActionCommits(cwd, actionId, milestoneId)` function that:

1. Uses `require('node:child_process').execSync` to run:
   `git log --all --oneline --format="%H|%s|%ai" --grep="M-XX-A-YY"` where M-XX is derived from milestoneId (extract the M-XX prefix, e.g. "M-28" from "M-28-commit-and-output-linking-per-action") and A-YY is the actionId.

2. Parses each line into `{ sha, shortSha, message, date }` where shortSha is first 7 chars of sha.

3. Returns an array sorted newest-first. Returns empty array on any error (no git, no matches, etc).

4. In `runGetExecPlan()`, call `getActionCommits(cwd, actionId, milestone.id)` and include the result as a `commits` field in the returned object — both in the exec-plan-found path and the no-exec-plan path.

Note: The function already receives `cwd` as first param. Use `execSync` with `{ cwd, encoding: 'utf-8', timeout: 5000 }` options. Wrap in try/catch returning `[]` on failure.

The grep pattern should match commits like `feat(M-28-A-59):` or `docs(M-28-A-59):` — use `--grep="(${milestonePrefix}-${actionId})"` with `--extended-regexp` flag. The milestonePrefix is extracted via `milestoneId.match(/^(M-\d+)/)[1]`.
  </action>
  <verify>
Run `node -e "const { runGetExecPlan } = require('./src/commands/get-exec-plan'); console.log(JSON.stringify(runGetExecPlan(process.cwd(), ['--action', 'A-79']), null, 2))"` and confirm the response includes a `commits` array with at least one entry containing `sha`, `shortSha`, `message`, and `date` fields.

Also test an action with no commits: `node -e "const { runGetExecPlan } = require('./src/commands/get-exec-plan'); const r = runGetExecPlan(process.cwd(), ['--action', 'A-59']); console.log('commits:', r.commits)"` — should return `commits: []`.
  </verify>
  <done>runGetExecPlan returns a `commits` array for every action. Actions with matching git commits get populated arrays; actions without get empty arrays. No errors thrown for missing git or zero matches.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild CJS bundle</name>
  <files>dist/declare-tools.cjs</files>
  <action>
Run `npm run build` (or the project's build command) to rebuild the dist/declare-tools.cjs bundle so the server serves the updated get-exec-plan logic.

Verify the bundle includes the new getActionCommits function by grepping the output file.
  </action>
  <verify>
`grep -q "getActionCommits" dist/declare-tools.cjs && echo "OK" || echo "MISSING"` outputs OK.

Start the server and test: `curl -s http://localhost:3847/api/action/A-79 | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('commits count:',j.commits?.length)})"` returns a count > 0.
  </verify>
  <done>dist/declare-tools.cjs contains the updated get-exec-plan code. The /api/action/:id endpoint returns commits data when accessed via the built bundle.</done>
</task>

</tasks>

<verification>
- `node -e "const { runGetExecPlan } = require('./src/commands/get-exec-plan'); const r = runGetExecPlan(process.cwd(), ['--action', 'A-79']); console.log(r.commits.length, 'commits for A-79')"` shows >= 1
- `node -e "const { runGetExecPlan } = require('./src/commands/get-exec-plan'); const r = runGetExecPlan(process.cwd(), ['--action', 'A-34']); console.log(r.commits.length, 'commits for A-34')"` shows 0 (pending action, no commits)
- API endpoint returns commits field in response
</verification>

<success_criteria>
Every /api/action/:id response includes a `commits` array. Actions with git commits matching the M-XX-A-YY pattern in their message have populated arrays with sha, shortSha, message, and date. Actions without matching commits return empty arrays. No performance regression — git log call completes within 5 seconds timeout.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-28-commit-and-output-linking-per-action/A-59-SUMMARY.md`
</output>
