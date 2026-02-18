#!/usr/bin/env node
// Declare activity hook — PreToolUse + PostToolUse
// Writes interesting tool events to .planning/activity.jsonl
// Server watches .planning/ via fs.watch and pushes SSE events to dashboard.
//
// Installed for PreToolUse and PostToolUse hook events.
// Runs fast: read stdin → decide → append one line → exit.

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const cwd          = process.cwd();
const planningDir  = path.join(cwd, '.planning');
const activityFile = path.join(planningDir, 'activity.jsonl');

// Only write if .planning/ exists (i.e. this is a Declare project)
if (!fs.existsSync(planningDir)) process.exit(0);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => raw += c);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw);
    const event = buildEvent(data);
    if (!event) process.exit(0);

    // Ensure file exists
    if (!fs.existsSync(activityFile)) fs.writeFileSync(activityFile, '');

    // Append event + trim to last 200 lines
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(activityFile, line);

    // Trim to last 200 lines to avoid unbounded growth
    const content = fs.readFileSync(activityFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > 200) {
      fs.writeFileSync(activityFile, lines.slice(-200).join('\n') + '\n');
    }
  } catch (_) {
    // Silent fail — never block Claude
  }
  process.exit(0);
});

/**
 * Build an activity event from a hook payload, or return null to skip.
 * @param {any} data
 * @returns {object|null}
 */
function buildEvent(data) {
  const tool      = data.tool_name || '';
  const input     = data.tool_input || {};
  const response  = data.tool_response;
  const hookEvent = data.hook_event_name || ''; // PreToolUse or PostToolUse
  const ts        = Date.now();
  const phase     = hookEvent === 'PostToolUse' ? 'done' : 'start';

  // Task spawns — most important for agent visibility
  if (tool === 'Task') {
    return {
      ts, phase, tool: 'Task',
      desc:  input.description || '',
      agent: input.subagent_type || '',
      // truncate prompt to avoid massive payloads
      prompt: (input.prompt || '').slice(0, 200),
      bg: hookEvent === 'PostToolUse',
    };
  }

  // Bash commands that involve declare-tools (execution steps)
  if (tool === 'Bash') {
    const cmd = input.command || '';
    if (cmd.includes('declare-tools') || cmd.includes('/declare:')) {
      return { ts, phase, tool: 'Bash', cmd: cmd.slice(0, 200) };
    }
    return null; // skip noisy general bash
  }

  // Write tool — track planning file changes
  if (tool === 'Write' && hookEvent === 'PostToolUse') {
    const fp = input.file_path || '';
    if (fp.includes('.planning/')) {
      return { ts, phase: 'done', tool: 'Write', file: fp.replace(cwd, '.') };
    }
    return null;
  }

  return null;
}
