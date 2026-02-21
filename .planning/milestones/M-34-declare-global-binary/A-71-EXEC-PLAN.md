---
milestone: M-34-declare-global-binary
action: A-71
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
autonomous: true
declarations:
  - D-11

must_haves:
  truths:
    - "Running `npm install -g .` (or `npm link`) produces a globally available `declare` command"
    - "The `declare` binary entry points to `bin/declare.js`"
    - "`declare-cc` binary entry still exists and still points to `bin/install.js`"
  artifacts:
    - path: "package.json"
      provides: "bin field with both declare-cc and declare entries"
      contains: "\"declare\": \"bin/declare.js\""
  key_links:
    - from: "package.json bin.declare"
      to: "bin/declare.js"
      via: "npm bin resolution"
      pattern: "\"declare\".*bin/declare\\.js"
---

<objective>
Add `declare` as a named binary in package.json's `bin` field, pointing to `bin/declare.js` (the new entry script built in A-72).

Purpose: npm's binary linking mechanism requires the bin entry to exist before the script. A-71 is a single-line package.json edit; A-72 creates the actual script. Both run in wave 1 — neither depends on the other, the global install (npm link / npm install -g) that wires them happens after both are done.

Output: package.json with `bin.declare` set to `bin/declare.js`, alongside the existing `bin.declare-cc` entry.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add declare bin entry to package.json</name>
  <files>package.json</files>
  <action>
Edit the `bin` field in package.json to add the `declare` entry alongside the existing `declare-cc` entry. The result must be:

```json
"bin": {
  "declare-cc": "bin/install.js",
  "declare": "bin/declare.js"
}
```

Do NOT remove or rename `declare-cc` — it is the existing installer binary and must remain unchanged. Do NOT add `declare.js` to the `files` array — `bin/` is already included via the `"bin"` directory entry. Do NOT change any other field in package.json.
  </action>
  <verify>
Run: `node -e "const p = require('./package.json'); console.log(JSON.stringify(p.bin, null, 2))"`

Expected output:
```json
{
  "declare-cc": "bin/install.js",
  "declare": "bin/declare.js"
}
```
  </verify>
  <done>package.json has both `bin.declare-cc` pointing to `bin/install.js` and `bin.declare` pointing to `bin/declare.js`. JSON is valid. No other fields changed.</done>
</task>

</tasks>

<verification>
- `node -e "require('./package.json')"` exits 0 (valid JSON)
- `node -e "const p = require('./package.json'); process.exit(p.bin.declare === 'bin/declare.js' ? 0 : 1)"`
- `node -e "const p = require('./package.json'); process.exit(p.bin['declare-cc'] === 'bin/install.js' ? 0 : 1)"`
</verification>

<success_criteria>
package.json is valid JSON with `bin.declare = "bin/declare.js"` added. The `declare-cc` entry is unchanged. All other fields are unchanged.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-34-declare-global-binary/A-71-SUMMARY.md`
</output>
