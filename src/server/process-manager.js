// @ts-check
'use strict';

/**
 * Process manager for Declare action execution.
 *
 * Manages Claude CLI child processes — spawn, track, stop, and stream output
 * to SSE clients in real time. One-at-a-time execution cap.
 *
 * Zero runtime dependencies. Uses Node's built-in child_process only.
 */

const { spawn } = require('node:child_process');

/**
 * @typedef {{ proc: import('child_process').ChildProcess, milestoneId: string }} ProcessEntry
 */

/**
 * Create a process manager that spawns and tracks Claude CLI processes.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @returns {{ execute: (actionId: string, milestoneId: string) => { ok?: boolean, error?: string, status?: number }, stop: (actionId: string) => { ok?: boolean, error?: string, status?: number }, running: () => string[] }}
 */
function createProcessManager(sseClients, cwd) {
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
   * Create a line-buffered handler for a stream.
   * Accumulates chunks, splits on newlines, emits complete lines, keeps remainder.
   *
   * @param {string} actionId
   * @param {string} streamName - 'stdout' or 'stderr'
   * @returns {(chunk: Buffer) => void}
   */
  function createLineHandler(actionId, streamName) {
    let buffer = '';
    return (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last element as remainder (incomplete line)
      buffer = lines.pop() || '';
      for (const line of lines) {
        broadcast('action-output', { actionId, text: line, stream: streamName });
      }
    };
  }

  /**
   * Spawn a Claude CLI process to execute an action.
   *
   * @param {string} actionId - e.g. 'A-87'
   * @param {string} milestoneId - e.g. 'M-41'
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function execute(actionId, milestoneId) {
    if (processes.size > 0) {
      return { error: 'busy', status: 409 };
    }

    if (processes.has(actionId)) {
      return { error: 'already_running', status: 409 };
    }

    const prompt = `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;

    const proc = spawn('claude', ['-p', prompt, '--no-input'], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    processes.set(actionId, { proc, milestoneId });

    // Pipe stdout line-by-line
    if (proc.stdout) {
      proc.stdout.on('data', createLineHandler(actionId, 'stdout'));
    }

    // Pipe stderr line-by-line
    if (proc.stderr) {
      proc.stderr.on('data', createLineHandler(actionId, 'stderr'));
    }

    // Process exited
    proc.on('close', (exitCode) => {
      processes.delete(actionId);
      broadcast('action-complete', { actionId, exitCode: exitCode ?? -1 });
    });

    // Process failed to spawn (e.g. claude not found)
    proc.on('error', (_err) => {
      processes.delete(actionId);
      broadcast('action-complete', { actionId, exitCode: -1 });
    });

    return { ok: true };
  }

  /**
   * Stop a running action process with SIGTERM.
   *
   * @param {string} actionId
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function stop(actionId) {
    const entry = processes.get(actionId);
    if (!entry) {
      return { error: 'not_running', status: 404 };
    }

    entry.proc.kill('SIGTERM');
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
