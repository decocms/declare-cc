---
milestone: M-38-model-aware-agent-dispatch
action: A-79
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/config.json
autonomous: true
declarations:
  - D-07

must_haves:
  truths:
    - "config.json contains a modelAssignment key mapping every agent role to a model string"
    - "All eight roles are present: planner, executor, debugger, researcher, synthesizer, verifier, checker, status"
    - "Model strings are valid Task tool values: opus, sonnet, or haiku"
    - "Existing config fields (mode, depth, parallelization, commit_docs, model_profile, workflow) are unchanged"
  artifacts:
    - path: ".planning/config.json"
      provides: "modelAssignment mapping for all agent roles"
      contains: "modelAssignment"
  key_links:
    - from: ".planning/config.json modelAssignment"
      to: "orchestrator commands"
      via: "A-80 reads this config to apply model per spawn"
      pattern: "\"modelAssignment\""
---

<objective>
Write the canonical role-to-model assignment table into `.planning/config.json` under the key `modelAssignment`.

Purpose: Establishes the single source of truth for which model each agent role uses. A-80 will read this config when wiring Task spawns; A-81 will reference the same mapping when surfacing model badges. Having it in config.json makes changes to model assignments a one-file edit with no orchestrator code changes needed.

Output: `.planning/config.json` updated with `modelAssignment` object alongside existing config fields.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/config.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add modelAssignment to config.json</name>
  <files>.planning/config.json</files>
  <action>
Read the current contents of `.planning/config.json`. It contains:
```json
{
  "mode": "yolo",
  "depth": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true
  }
}
```

Add a `modelAssignment` key with the following mapping. Do NOT remove or modify any existing fields:

```json
"modelAssignment": {
  "planner": "opus",
  "executor": "opus",
  "debugger": "opus",
  "researcher": "sonnet",
  "synthesizer": "sonnet",
  "verifier": "sonnet",
  "checker": "haiku",
  "status": "haiku"
}
```

The model strings must be exactly `"opus"`, `"sonnet"`, or `"haiku"` — these are the values the Task tool `model` parameter accepts. Do NOT use full model IDs like `"claude-opus-4-6"`.

Write the merged JSON back to `.planning/config.json` with 2-space indentation.
  </action>
  <verify>
Run: `node -e "const c = require('./.planning/config.json'); const ma = c.modelAssignment; const roles = ['planner','executor','debugger','researcher','synthesizer','verifier','checker','status']; const missing = roles.filter(r => !ma[r]); console.log(missing.length ? 'MISSING: ' + missing.join(',') : 'OK'); console.log(JSON.stringify(ma, null, 2))"`

Expected: prints `OK` followed by the full modelAssignment object with 8 entries. Existing keys (mode, depth, parallelization, commit_docs, model_profile, workflow) must still be present: `node -e "const c = require('./.planning/config.json'); ['mode','depth','parallelization','commit_docs','model_profile','workflow'].forEach(k => { if (!(k in c)) throw new Error('missing: '+k) }); console.log('existing keys intact')"`
  </verify>
  <done>`.planning/config.json` is valid JSON containing `modelAssignment` with all 8 roles mapped. All pre-existing config keys are unchanged. Model strings are exactly "opus", "sonnet", or "haiku".</done>
</task>

</tasks>

<verification>
- `node -e "require('./.planning/config.json')"` exits 0 (valid JSON)
- `node -e "const c = require('./.planning/config.json'); const required = ['planner','executor','debugger','researcher','synthesizer','verifier','checker','status']; required.forEach(r => { if (!c.modelAssignment[r]) throw new Error('missing role: '+r) }); console.log('all roles present')"` exits 0
- `node -e "const c = require('./.planning/config.json'); const valid = ['opus','sonnet','haiku']; Object.entries(c.modelAssignment).forEach(([r,m]) => { if (!valid.includes(m)) throw new Error(r+' has invalid model: '+m) }); console.log('all models valid')"` exits 0
- `node -e "const c = require('./.planning/config.json'); if (!c.workflow || !c.model_profile) throw new Error('existing keys missing'); console.log('existing keys intact')"` exits 0
</verification>

<success_criteria>
`.planning/config.json` contains `modelAssignment` with all 8 roles (planner, executor, debugger, researcher, synthesizer, verifier, checker, status) mapped to valid model strings. All original config keys are intact. JSON is valid and parseable by Node.js `require()`.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-38-model-aware-agent-dispatch/A-79-SUMMARY.md`
</output>
