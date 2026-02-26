// @ts-check
'use strict';

/**
 * Derivation runner for browser-based milestone derivation.
 *
 * Uses the AI runner (Claude Agent SDK) to generate milestone proposals.
 * Streams output line-by-line to SSE clients and parses structured
 * JSON results (proposed milestones) on completion.
 *
 * Concurrent session tracking — multiple derivations can run simultaneously.
 */

const { runAI } = require('./ai-runner');

/**
 * @typedef {{ id: string, statement: string, milestones?: string[] }} Declaration
 */

/**
 * Build the derivation prompt from declarations.
 *
 * @param {string|null} declarationId - Specific declaration to derive for, or null for all without milestones
 * @param {Declaration[]} declarations - All declarations
 * @returns {string}
 */
function buildPrompt(declarationId, declarations) {
  /** @type {Declaration[]} */
  let targets;

  if (declarationId) {
    targets = declarations.filter((d) => d.id === declarationId);
  } else {
    targets = declarations.filter(
      (d) => !d.milestones || d.milestones.length === 0
    );
  }

  const formatted = targets
    .map((d) => `- ${d.id}: ${d.statement}`)
    .join('\n');

  return (
    'You are deriving milestones for a Declare project. ' +
    'Given these declarations, propose 2-4 milestones per declaration by asking ' +
    '"For this to be true, what must be true?" ' +
    'Each milestone needs a concise title AND a detailed description explaining what it delivers, ' +
    'its scope, and success criteria. ' +
    'Output ONLY a JSON array with no markdown fencing: ' +
    '[{"title": "short milestone title", "description": "Detailed description of what this milestone delivers, its scope and boundaries, and how to verify it is complete.", "realizes": "D-XX", "reason": "why this must be true"}]. ' +
    'Declarations:\n\n' +
    formatted
  );
}

/**
 * Create a derivation runner that uses the AI runner SDK for milestone derivation.
 * Supports concurrent sessions — multiple derivations can run at the same time.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @param {any} [registry] - Optional agent registry
 * @returns {{ derive: Function, stop: Function, stopAll: Function, running: Function }}
 */
function createDerivationRunner(sseClients, cwd, registry) {
  /** @type {Map<string, { abortController: AbortController, agentId?: string, declarationId: string|null, startTime: number }>} */
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
   * Spawn an AI agent to derive milestones.
   * No longer blocks on existing sessions — supports concurrent derivation.
   *
   * @param {string|null} declarationId - Specific declaration ID, or null for all unmatched
   * @param {Declaration[]} declarations - Array of declaration objects
   * @returns {{ ok?: boolean, error?: string, status?: number, sessionId?: string }}
   */
  function derive(declarationId, declarations) {
    const sessionId = `deriv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prompt = buildPrompt(declarationId, declarations);
    const abortController = new AbortController();

    /** @type {string|undefined} */
    let agentId;
    if (registry) {
      const agent = registry.spawn('derivation', declarationId || 'all', '');
      agentId = agent.id;
    }

    sessions.set(sessionId, { abortController, agentId, declarationId, startTime: Date.now() });

    // Broadcast initial status
    broadcast('derivation-output', {
      sessionId, declarationId,
      text: 'Spawning AI agent\u2026',
      stream: 'status',
    });

    // Fire and forget — results stream via SSE
    runAI(prompt, {
      cwd,
      model: 'sonnet',
      maxTurns: 1,
      abortController,
      onText: (chunk) => {
        broadcast('derivation-output', {
          sessionId, declarationId,
          text: chunk,
          stream: 'stdout',
        });
      },
    }).then(({ text, error }) => {
      const session = sessions.get(sessionId);
      const closingAgentId = session ? session.agentId : undefined;
      sessions.delete(sessionId);

      if (error) {
        broadcast('derivation-complete', {
          sessionId, declarationId,
          exitCode: 1,
          milestones: null,
          error,
        });
        if (registry && closingAgentId) {
          registry.fail(closingAgentId, 1, error);
        }
        return;
      }

      // Parse milestones from result
      let milestones = null;
      try {
        milestones = JSON.parse(text.trim());
      } catch (_) {
        // Try to find a JSON array within the text
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          try { milestones = JSON.parse(match[0]); } catch (__) {}
        }
      }

      broadcast('derivation-complete', {
        sessionId, declarationId,
        exitCode: 0,
        milestones,
      });

      if (registry && closingAgentId) {
        const milestoneIds = Array.isArray(milestones)
          ? milestones.map(m => m.id || m.title || 'unknown').filter(Boolean)
          : [];
        registry.complete(closingAgentId, { milestones: milestoneIds });
      }
    }).catch((err) => {
      const session = sessions.get(sessionId);
      const errorAgentId = session ? session.agentId : undefined;
      sessions.delete(sessionId);

      broadcast('derivation-complete', {
        sessionId, declarationId,
        exitCode: -1,
        milestones: null,
        error: String(err.message || err),
      });

      if (registry && errorAgentId) {
        registry.fail(errorAgentId, -1, 'error');
      }
    });

    return { ok: true, sessionId };
  }

  /**
   * Stop a specific derivation session or all sessions.
   *
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
   * Stop all running derivation sessions.
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
   * @returns {Array<{ sessionId: string, declarationId: string|null, startTime: number }>|null}
   */
  function running() {
    if (sessions.size === 0) return null;
    return Array.from(sessions.entries()).map(([id, s]) => ({
      sessionId: id,
      declarationId: s.declarationId,
      startTime: s.startTime,
    }));
  }

  return { derive, stop, stopAll, running };
}

module.exports = { createDerivationRunner };
