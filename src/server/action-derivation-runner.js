// @ts-check
'use strict';

/**
 * Action derivation runner for browser-based per-milestone action derivation.
 *
 * Uses @anthropic-ai/claude-agent-sdk to run AI queries directly,
 * streams output via SSE to connected clients, and parses structured
 * JSON results (proposed actions) on completion.
 *
 * Concurrent session tracking — multiple action derivations can run simultaneously.
 */

const { runAI } = require('./ai-runner');

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
 * Create an action derivation runner using the Claude Agent SDK.
 * Supports concurrent sessions — multiple action derivations can run at the same time.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @param {object} [registry] - Agent registry for tracking
 * @returns {{ derive: Function, stop: Function, stopAll: Function, running: Function }}
 */
function createActionDerivationRunner(sseClients, cwd, registry) {
  /** @type {Map<string, { milestoneId: string, agentId?: string, abortController: AbortController, startTime: number }>} */
  const sessions = new Map();

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
   * Derive actions for a milestone using the Claude Agent SDK.
   *
   * @param {{ id: string, title: string, status: string, realizes: string[] }} milestone
   * @param {Array<{ id: string, title: string, status: string, produces: string }>} existingActions
   * @returns {{ ok?: boolean, error?: string, status?: number, sessionId?: string }}
   */
  function derive(milestone, existingActions) {
    const sessionId = `action-deriv-${Date.now()}`;
    const prompt = buildActionPrompt(milestone, existingActions);
    const abortController = new AbortController();

    /** @type {string|undefined} */
    let agentId;
    if (registry) {
      const agent = registry.spawn('action-derivation', milestone.id, milestone.id);
      agentId = agent.id;
    }

    sessions.set(sessionId, { milestoneId: milestone.id, agentId, abortController, startTime: Date.now() });

    // Run AI asynchronously
    runAI(prompt, {
      cwd,
      model: 'opus',
      maxTurns: 1,
      abortController,
      onText: (text) => {
        broadcast('action-derivation-output', {
          sessionId,
          milestoneId: milestone.id,
          text,
          stream: 'stdout',
        });
      },
    }).then(({ text, error }) => {
      const session = sessions.get(sessionId);
      const closingAgentId = session ? session.agentId : undefined;
      sessions.delete(sessionId);

      let actions = null;
      const exitCode = error ? 1 : 0;
      if (!error && text) {
        try {
          actions = JSON.parse(text.trim());
        } catch (_) {
          // Try to extract JSON from the text (model may include extra text)
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try { actions = JSON.parse(jsonMatch[0]); } catch (_2) {}
          }
        }
      }

      broadcast('action-derivation-complete', {
        sessionId,
        milestoneId: milestone.id,
        exitCode,
        actions,
      });

      if (registry && closingAgentId) {
        if (exitCode === 0) {
          registry.complete(closingAgentId, {
            milestoneId: milestone.id,
            actionCount: Array.isArray(actions) ? actions.length : null,
          });
        } else {
          registry.fail(closingAgentId, 1, error || 'action derivation failed');
        }
      }
    }).catch((err) => {
      // Safety net: always clear session even on unexpected errors
      const session = sessions.get(sessionId);
      const closingAgentId = session ? session.agentId : undefined;
      sessions.delete(sessionId);
      broadcast('action-derivation-complete', { sessionId, milestoneId: milestone.id, exitCode: 1, actions: null });
      if (registry && closingAgentId) {
        registry.fail(closingAgentId, 1, String(err));
      }
    });

    return { ok: true, sessionId };
  }

  /**
   * Stop a specific session or all sessions.
   * @param {string} [sessionId] - If provided, stop that session. Otherwise stop all.
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function stop(sessionId) {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return { error: 'not_running', status: 404 };
      }
      session.abortController.abort();
      return { ok: true };
    }
    return stopAll();
  }

  /**
   * Stop all running action derivation sessions.
   * @returns {{ ok: boolean }}
   */
  function stopAll() {
    for (const [, session] of sessions) {
      session.abortController.abort();
    }
    return { ok: true };
  }

  /**
   * Return info about active sessions, or null if none running.
   * @returns {Array<{ sessionId: string, milestoneId: string, startTime: number }>|null}
   */
  function running() {
    if (sessions.size === 0) return null;
    return Array.from(sessions.entries()).map(([id, s]) => ({
      sessionId: id,
      milestoneId: s.milestoneId,
      startTime: s.startTime,
    }));
  }

  return { derive, stop, stopAll, running };
}

// Self-test when run directly
if (require.main === module) {
  const runner = createActionDerivationRunner(new Set(), '.');
  console.log('derive:', typeof runner.derive);
  console.log('stop:', typeof runner.stop);
  console.log('stopAll:', typeof runner.stopAll);
  console.log('running:', typeof runner.running);
  console.log('OK');
}

module.exports = { createActionDerivationRunner };
