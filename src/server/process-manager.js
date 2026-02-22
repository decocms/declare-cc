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
const fs = require('node:fs');
const path = require('node:path');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

/**
 * @typedef {{ proc: import('child_process').ChildProcess, milestoneId: string, logPath?: string }} ProcessEntry
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
   * @param {string | undefined} logPath - Path to execution.log (undefined to skip file logging)
   * @returns {(chunk: Buffer) => void}
   */
  function createLineHandler(actionId, streamName, logPath) {
    let buffer = '';
    return (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last element as remainder (incomplete line)
      buffer = lines.pop() || '';
      for (const line of lines) {
        broadcast('action-output', { actionId, text: line, stream: streamName });
        appendLog(logPath, `[${new Date().toISOString()}] [${actionId}] [${streamName}] ${line}`);
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

    processes.set(actionId, { proc, milestoneId, logPath });

    // Write start marker to execution log
    appendLog(logPath, `\n=== START ${actionId} @ ${new Date().toISOString()} ===`);

    // Pipe stdout line-by-line
    if (proc.stdout) {
      proc.stdout.on('data', createLineHandler(actionId, 'stdout', logPath));
    }

    // Pipe stderr line-by-line
    if (proc.stderr) {
      proc.stderr.on('data', createLineHandler(actionId, 'stderr', logPath));
    }

    // Process exited
    proc.on('close', (exitCode) => {
      const entry = processes.get(actionId);
      appendLog(entry?.logPath, `=== END ${actionId} @ ${new Date().toISOString()} exit=${exitCode ?? -1} ===\n`);
      processes.delete(actionId);
      broadcast('action-complete', { actionId, exitCode: exitCode ?? -1 });
    });

    // Process failed to spawn (e.g. claude not found)
    proc.on('error', (_err) => {
      const entry = processes.get(actionId);
      appendLog(entry?.logPath, `=== ERROR ${actionId} @ ${new Date().toISOString()} ===\n`);
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
