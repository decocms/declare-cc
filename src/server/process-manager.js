// @ts-check
'use strict';

/**
 * Process manager for Declare action execution.
 *
 * Uses the AI runner (Claude Agent SDK) to execute actions with full tool
 * access. One-at-a-time execution cap. Streams output to SSE clients.
 */

const { runAI } = require('./ai-runner');
const fs = require('node:fs');
const path = require('node:path');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

/**
 * @typedef {{ abortController: AbortController, milestoneId: string, logPath?: string, agentId?: string }} ProcessEntry
 */

/**
 * @typedef {{ id: string, title: string, produces: string, status: string }} ActionInfo
 * @typedef {{ id: string, title: string, description: string }} MilestoneInfo
 * @typedef {{ id: string, statement: string }} DeclarationInfo
 * @typedef {{ action: ActionInfo, milestone: MilestoneInfo|null, declaration: DeclarationInfo|null, siblingActions: ActionInfo[] }} ActionContext
 */

/**
 * Append a line to the execution log file. Never throws — write failures
 * are swallowed so they cannot crash the server.
 * @param {string | undefined} logPath
 * @param {string} line
 */
function appendLog(logPath, line) {
  if (!logPath) return;
  try {
    fs.appendFileSync(logPath, line + '\n', 'utf-8');
  } catch (_) {
    // Intentionally swallowed — log writing must never crash the server
  }
}

/**
 * Build a rich execution prompt with full context from the graph.
 *
 * @param {string} actionId
 * @param {string} milestoneId
 * @param {ActionContext} [ctx]
 * @returns {string}
 */
function buildExecutionPrompt(actionId, milestoneId, ctx) {
  if (!ctx) {
    return `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;
  }

  const lines = [
    `Execute action ${actionId} for milestone ${milestoneId}. Work autonomously — do not ask questions.`,
    '',
  ];

  // Why-chain: declaration → milestone → action
  if (ctx.declaration) {
    lines.push(`## Declaration: ${ctx.declaration.id}`);
    lines.push(ctx.declaration.statement);
    lines.push('');
  }

  if (ctx.milestone) {
    lines.push(`## Milestone: ${ctx.milestone.id} — ${ctx.milestone.title}`);
    if (ctx.milestone.description) {
      lines.push(ctx.milestone.description);
    }
    lines.push('');
  }

  lines.push(`## Action: ${ctx.action.id} — ${ctx.action.title}`);
  if (ctx.action.produces) {
    lines.push(`**Produces:** ${ctx.action.produces}`);
  }
  lines.push('');

  // Sibling actions for awareness of what else is planned
  if (ctx.siblingActions.length > 0) {
    lines.push('## Other actions for this milestone (do NOT do these, just for context):');
    for (const s of ctx.siblingActions) {
      const statusMark = s.status === 'DONE' ? ' [DONE]' : '';
      lines.push(`- ${s.id}: ${s.title}${s.produces ? ' (produces: ' + s.produces + ')' : ''}${statusMark}`);
    }
    lines.push('');
  }

  lines.push('## Instructions');
  lines.push('1. Read the project context files: .planning/FUTURE.md, .planning/MILESTONES.md, .planning/STATE.md');
  lines.push('2. Understand what this action needs to deliver based on the "Produces" field above');
  lines.push('3. Explore the codebase to find the right files to modify');
  lines.push('4. Implement the changes — write real, working code');
  lines.push('5. Verify your changes work (run relevant tests, check for errors)');
  lines.push('6. Commit your changes with a descriptive message');

  return lines.join('\n');
}

/**
 * Create a process manager that uses the AI runner SDK to execute actions.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @returns {{ execute: (actionId: string, milestoneId: string) => { ok?: boolean, error?: string, status?: number }, stop: (actionId: string) => { ok?: boolean, error?: string, status?: number }, running: () => string[] }}
 */
function createProcessManager(sseClients, cwd, registry) {
  /** @type {Map<string, ProcessEntry>} */
  const processes = new Map();

  /**
   * Broadcast an SSE event to all connected clients.
   * @param {string} event - SSE event name
   * @param {object} data - JSON-serializable data
   */
  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }

  /**
   * Execute an action using the AI runner SDK.
   *
   * @param {string} actionId - e.g. 'A-87'
   * @param {string} milestoneId - e.g. 'M-41'
   * @param {ActionContext} [ctx] - Rich context from the graph
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function execute(actionId, milestoneId, ctx) {
    if (processes.size > 0) {
      return { error: 'busy', status: 409 };
    }

    if (processes.has(actionId)) {
      return { error: 'already_running', status: 409 };
    }

    const prompt = buildExecutionPrompt(actionId, milestoneId, ctx);

    // Resolve milestone folder for execution log
    const planningDir = path.join(cwd, '.planning');
    const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
    /** @type {string | undefined} */
    let logPath;
    if (milestoneFolder) {
      logPath = path.join(milestoneFolder, 'execution.log');
    } else {
      process.stderr.write(`[declare] Warning: milestone folder not found for ${milestoneId}, skipping execution log\n`);
    }

    const abortController = new AbortController();

    /** @type {string|undefined} */
    let agentId;
    if (registry) {
      const agent = registry.spawn('execution', actionId, milestoneId);
      agentId = agent.id;
    }

    processes.set(actionId, { abortController, milestoneId, logPath, agentId });

    // Write start marker to execution log
    appendLog(logPath, `\n=== START ${actionId} @ ${new Date().toISOString()} ===`);

    // Fire and forget — results stream via SSE
    runAI(prompt, {
      cwd,
      model: 'sonnet',
      withTools: true,
      maxTurns: 10,
      abortController,
      onText: (chunk) => {
        broadcast('action-output', { actionId, text: chunk, stream: 'stdout' });
        appendLog(logPath, `[${new Date().toISOString()}] [${actionId}] [stdout] ${chunk}`);
      },
    }).then(({ text, error }) => {
      const entry = processes.get(actionId);
      const entryAgentId = entry?.agentId;
      const exitCode = error ? 1 : 0;
      appendLog(entry?.logPath, `=== END ${actionId} @ ${new Date().toISOString()} exit=${exitCode} ===\n`);
      processes.delete(actionId);
      broadcast('action-complete', { actionId, exitCode });
      if (registry && entryAgentId) {
        if (exitCode === 0) {
          const mFolder = entry?.logPath ? path.dirname(entry.logPath) : null;
          registry.complete(entryAgentId, {
            actionId,
            milestoneId: entry?.milestoneId || milestoneId,
            summaryPath: mFolder ? path.join(mFolder, actionId + '-SUMMARY.md') : null,
            logPath: entry?.logPath || null,
          });
        } else {
          registry.fail(entryAgentId, exitCode, error || 'execution failed');
        }
      }
    }).catch((err) => {
      const entry = processes.get(actionId);
      const entryAgentId = entry?.agentId;
      appendLog(entry?.logPath, `=== ERROR ${actionId} @ ${new Date().toISOString()} ===\n`);
      processes.delete(actionId);
      broadcast('action-complete', { actionId, exitCode: -1 });
      if (registry && entryAgentId) {
        registry.fail(entryAgentId, -1, String(err.message || err));
      }
    });

    return { ok: true };
  }

  /**
   * Stop a running action by aborting it.
   *
   * @param {string} actionId
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function stop(actionId) {
    const entry = processes.get(actionId);
    if (!entry) {
      return { error: 'not_running', status: 404 };
    }

    entry.abortController.abort();
    return { ok: true };
  }

  /**
   * Return array of currently running action IDs.
   * @returns {string[]}
   */
  function running() {
    return [...processes.keys()];
  }

  return { execute, stop, running };
}

module.exports = { createProcessManager };
