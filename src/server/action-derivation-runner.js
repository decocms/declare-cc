// @ts-check
'use strict';

/**
 * Action derivation runner for browser-based per-milestone action derivation.
 *
 * Spawns a Claude CLI subprocess with a prompt scoped to a single milestone,
 * streams output line-by-line to SSE clients, and parses structured
 * JSON results (proposed actions) on completion.
 *
 * Session-based tracking (one action derivation at a time).
 * Zero runtime dependencies — uses Node's built-in child_process only.
 */

const { spawn } = require('node:child_process');

/**
 * Build the action derivation prompt for a specific milestone.
 *
 * @param {{ id: string, title: string, status: string, realizes: string[] }} milestone
 * @param {Array<{ id: string, title: string, status: string, produces: string }>} existingActions
 * @returns {string}
 */
function buildActionPrompt(milestone, existingActions) {
  let prompt =
    'You are deriving actions for a Declare project milestone. ' +
    'An action is a concrete piece of work that causes (moves toward) a milestone. ' +
    'Given this milestone, propose 2-5 actions by asking "What work must be done to achieve this?" ' +
    'Output ONLY a JSON array with no markdown fencing: ' +
    '[{"title": "action title", "produces": "what this action delivers", "reason": "why this is needed"}]. ' +
    '\n\nMilestone:\n' +
    `- ${milestone.id}: ${milestone.title} (realizes: ${milestone.realizes.join(', ')})`;

  if (existingActions.length > 0) {
    prompt += '\n\nExisting actions for this milestone (do NOT duplicate these):\n';
    for (const a of existingActions) {
      prompt += `- ${a.id}: ${a.title}`;
      if (a.produces) prompt += ` (produces: ${a.produces})`;
      prompt += '\n';
    }
  }

  return prompt;
}

/**
 * Create an action derivation runner that spawns and tracks Claude CLI action derivation processes.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @returns {{ derive: (milestone: object, existingActions: Array) => { ok?: boolean, error?: string, status?: number, sessionId?: string }, stop: () => { ok?: boolean, error?: string, status?: number }, running: () => string|null }}
 */
function createActionDerivationRunner(sseClients, cwd) {
  /** @type {{ sessionId: string, milestoneId: string, proc: import('child_process').ChildProcess } | null} */
  let current = null;

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
   * Create a line-buffered handler for a stream.
   * @param {string} sessionId
   * @param {string} streamName
   * @param {{ text: string }} accumulator
   * @returns {(chunk: Buffer) => void}
   */
  function createLineHandler(sessionId, streamName, accumulator) {
    let buffer = '';
    return (chunk) => {
      const text = chunk.toString();
      if (streamName === 'stdout') {
        accumulator.text += text;
      }
      buffer += text;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        broadcast('action-derivation-output', {
          sessionId,
          text: line,
          stream: streamName,
        });
      }
    };
  }

  /**
   * Spawn a Claude CLI process to derive actions for a milestone.
   *
   * @param {{ id: string, title: string, status: string, realizes: string[] }} milestone
   * @param {Array<{ id: string, title: string, status: string, produces: string }>} existingActions
   * @returns {{ ok?: boolean, error?: string, status?: number, sessionId?: string }}
   */
  function derive(milestone, existingActions) {
    if (current) {
      return { error: 'busy', status: 409 };
    }

    const sessionId = `action-deriv-${Date.now()}`;
    const prompt = buildActionPrompt(milestone, existingActions);

    const proc = spawn('claude', ['-p', prompt, '--output-format', 'text', '--no-input'], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    current = { sessionId, milestoneId: milestone.id, proc };

    const stdout = { text: '' };

    if (proc.stdout) {
      proc.stdout.on('data', createLineHandler(sessionId, 'stdout', stdout));
    }

    if (proc.stderr) {
      proc.stderr.on('data', createLineHandler(sessionId, 'stderr', stdout));
    }

    proc.on('close', (exitCode) => {
      let actions = null;
      if (exitCode === 0) {
        try {
          actions = JSON.parse(stdout.text.trim());
        } catch (_) {
          // Parse failure — actions stays null, UI can show raw output
        }
      }
      current = null;
      broadcast('action-derivation-complete', {
        sessionId,
        exitCode: exitCode ?? -1,
        actions,
      });
    });

    proc.on('error', (_err) => {
      current = null;
      broadcast('action-derivation-complete', {
        sessionId,
        exitCode: -1,
        actions: null,
      });
    });

    return { ok: true, sessionId };
  }

  /**
   * Stop the currently running action derivation process.
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function stop() {
    if (!current) {
      return { error: 'not_running', status: 404 };
    }
    current.proc.kill('SIGTERM');
    return { ok: true };
  }

  /**
   * Return the session ID of the currently running action derivation, or null.
   * @returns {string|null}
   */
  function running() {
    return current ? current.sessionId : null;
  }

  return { derive, stop, running };
}

// Self-test when run directly
if (require.main === module) {
  const runner = createActionDerivationRunner(new Set(), '.');
  console.log('derive:', typeof runner.derive);
  console.log('stop:', typeof runner.stop);
  console.log('running:', typeof runner.running);
  console.log('OK');
}

module.exports = { createActionDerivationRunner };
