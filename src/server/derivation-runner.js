// @ts-check
'use strict';

/**
 * Derivation runner for browser-based milestone derivation.
 *
 * Spawns a Claude CLI subprocess with a scoped derivation prompt,
 * streams output line-by-line to SSE clients, and parses structured
 * JSON results (proposed milestones) on completion.
 *
 * Session-based tracking (one derivation at a time).
 * Zero runtime dependencies — uses Node's built-in child_process only.
 */

const { spawn } = require('node:child_process');

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
    // Include all declarations that have no milestones yet
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
    'Output ONLY a JSON array with no markdown fencing: ' +
    '[{"title": "milestone title", "realizes": "D-XX", "reason": "why this must be true"}]. ' +
    'Declarations:\n\n' +
    formatted
  );
}

/**
 * Create a derivation runner that spawns and tracks Claude CLI derivation processes.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @returns {{ derive: (declarationId: string|null, declarations: Declaration[]) => { ok?: boolean, error?: string, status?: number, sessionId?: string }, stop: () => { ok?: boolean, error?: string, status?: number }, running: () => string|null }}
 */
function createDerivationRunner(sseClients, cwd) {
  /** @type {{ sessionId: string, proc: import('child_process').ChildProcess } | null} */
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
   * Accumulates chunks, splits on newlines, emits complete lines via SSE.
   *
   * @param {string} sessionId
   * @param {string} streamName - 'stdout' or 'stderr'
   * @param {{ text: string }} accumulator - Object to accumulate full text for stdout
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
      // Keep the last element as remainder (incomplete line)
      buffer = lines.pop() || '';
      for (const line of lines) {
        broadcast('derivation-output', {
          sessionId,
          text: line,
          stream: streamName,
        });
      }
    };
  }

  /**
   * Spawn a Claude CLI process to derive milestones.
   *
   * @param {string|null} declarationId - Specific declaration ID, or null for all unmatched
   * @param {Declaration[]} declarations - Array of declaration objects
   * @returns {{ ok?: boolean, error?: string, status?: number, sessionId?: string }}
   */
  function derive(declarationId, declarations) {
    if (current) {
      return { error: 'busy', status: 409 };
    }

    const sessionId = `deriv-${Date.now()}`;
    const prompt = buildPrompt(declarationId, declarations);

    const env = { ...process.env, FORCE_COLOR: '0' };
    delete env.CLAUDECODE;

    const proc = spawn('claude', ['-p', prompt, '--output-format', 'text'], {
      cwd,
      env,
    });

    current = { sessionId, proc };

    // Accumulator for full stdout text (for JSON parsing on completion)
    const stdout = { text: '' };

    // Pipe stdout line-by-line
    if (proc.stdout) {
      proc.stdout.on('data', createLineHandler(sessionId, 'stdout', stdout));
    }

    // Pipe stderr line-by-line
    if (proc.stderr) {
      proc.stderr.on('data', createLineHandler(sessionId, 'stderr', stdout));
    }

    // Process exited
    proc.on('close', (exitCode) => {
      let milestones = null;
      if (exitCode === 0) {
        try {
          milestones = JSON.parse(stdout.text.trim());
        } catch (_) {
          // Parse failure — milestones stays null, UI can show raw output
        }
      }
      current = null;
      broadcast('derivation-complete', {
        sessionId,
        exitCode: exitCode ?? -1,
        milestones,
      });
    });

    // Process failed to spawn (e.g. claude not found)
    proc.on('error', (_err) => {
      current = null;
      broadcast('derivation-complete', {
        sessionId,
        exitCode: -1,
        milestones: null,
      });
    });

    return { ok: true, sessionId };
  }

  /**
   * Stop the currently running derivation process with SIGTERM.
   *
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
   * Return the session ID of the currently running derivation, or null.
   * @returns {string|null}
   */
  function running() {
    return current ? current.sessionId : null;
  }

  return { derive, stop, running };
}

// Self-test when run directly
if (require.main === module) {
  const runner = createDerivationRunner(new Set(), '.');
  console.log('derive:', typeof runner.derive);
  console.log('stop:', typeof runner.stop);
  console.log('running:', typeof runner.running);
  console.log('OK');
}

module.exports = { createDerivationRunner };
