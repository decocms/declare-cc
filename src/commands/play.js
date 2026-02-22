// @ts-check
'use strict';

/**
 * Play command — execute all ready agent-time milestones in dependency order.
 *
 * Computes a topological wave ordering of agent milestones and their
 * non-DONE actions, then executes each wave concurrently. Emits SSE
 * events for live progress tracking.
 *
 * Zero runtime dependencies. CJS module.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { runLoadGraph } = require('./load-graph');
const { runGetExecPlan } = require('./get-exec-plan');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

/** Statuses that mean "done" */
const DONE_STATUSES = new Set(['DONE', 'KEPT', 'HONORED', 'RENEGOTIATED']);

/**
 * Compute play order: group agent milestones into dependency-ordered waves.
 *
 * @param {{ milestones: Array<{id: string, status: string, classification?: string, dependsOn?: string[]}>, actions: Array<{id: string, status: string, causes?: string[]}> }} graph
 * @returns {{ waves: Array<Array<{ milestoneId: string, actions: string[] }>> }}
 */
function computePlayOrder(graph) {
  const milestones = graph.milestones || [];
  const actions = graph.actions || [];

  // Filter: agent milestones that are not DONE
  const candidates = milestones.filter(m =>
    (m.classification || 'agent') === 'agent' &&
    !DONE_STATUSES.has((m.status || '').toUpperCase())
  );

  if (candidates.length === 0) {
    return { waves: [] };
  }

  const candidateIds = new Set(candidates.map(m => m.id.toUpperCase()));

  // Build adjacency: for each candidate, which other candidates does it depend on?
  /** @type {Map<string, string[]>} */
  const deps = new Map();
  for (const m of candidates) {
    const mId = m.id.toUpperCase();
    const mDeps = (m.dependsOn || [])
      .map(d => d.toUpperCase())
      .filter(d => candidateIds.has(d));
    deps.set(mId, mDeps);
  }

  // Group into waves using Kahn's algorithm style
  /** @type {Array<Array<{ milestoneId: string, actions: string[] }>>} */
  const waves = [];
  const placed = new Set();

  while (placed.size < candidates.length) {
    const wave = [];
    for (const m of candidates) {
      const mId = m.id.toUpperCase();
      if (placed.has(mId)) continue;

      const mDeps = deps.get(mId) || [];
      const allDepsMet = mDeps.every(d =>
        placed.has(d) || !candidateIds.has(d)
      );
      if (!allDepsMet) continue;

      // Get non-DONE actions for this milestone
      const milestoneActions = actions
        .filter(a =>
          (a.causes || []).some(c => c.toUpperCase() === mId) &&
          !DONE_STATUSES.has((a.status || '').toUpperCase())
        )
        .map(a => a.id);

      if (milestoneActions.length > 0) {
        wave.push({ milestoneId: m.id, actions: milestoneActions });
      }

      // Mark as placed even if no actions (deps are satisfied)
      // We skip adding to wave if no actions, but still mark placed
    }

    if (wave.length === 0) {
      // All remaining candidates have unsatisfied deps or no actions
      // Mark any remaining without actions as placed
      let progress = false;
      for (const m of candidates) {
        const mId = m.id.toUpperCase();
        if (placed.has(mId)) continue;
        const mDeps = deps.get(mId) || [];
        const allDepsMet = mDeps.every(d =>
          placed.has(d) || !candidateIds.has(d)
        );
        if (allDepsMet) {
          placed.add(mId);
          progress = true;
        }
      }
      if (!progress) break; // Cycle or truly stuck
      continue;
    }

    waves.push(wave);
    for (const entry of wave) {
      placed.add(entry.milestoneId.toUpperCase());
    }
    // Also mark no-action milestones whose deps are now met
    for (const m of candidates) {
      const mId = m.id.toUpperCase();
      if (placed.has(mId)) continue;
      const mDeps = deps.get(mId) || [];
      if (mDeps.every(d => placed.has(d) || !candidateIds.has(d))) {
        placed.add(mId);
      }
    }
  }

  return { waves };
}

/**
 * Append a line to the execution log. Never throws.
 * @param {string | undefined} logPath
 * @param {string} line
 */
function appendLog(logPath, line) {
  if (!logPath) return;
  try {
    fs.appendFileSync(logPath, line + '\n', 'utf-8');
  } catch (_) {}
}

/**
 * Create a play runner that executes waves of actions.
 *
 * @param {Set<import('http').ServerResponse>} sseClients
 * @param {string} cwd
 * @returns {{ start: () => { ok?: boolean, error?: string, waves?: number }, stop: () => { ok?: boolean, error?: string }, running: () => boolean, status: () => object | null }}
 */
function createPlayRunner(sseClients, cwd) {
  /** @type {boolean} */
  let isRunning = false;
  /** @type {boolean} */
  let stopRequested = false;
  /** @type {Map<string, import('child_process').ChildProcess>} */
  const activeProcesses = new Map();
  /** @type {{ currentWave: number, totalWaves: number, waveItems: Array<{milestoneId: string, actions: string[]}>, completedActions: string[], failedActions: string[] } | null} */
  let playState = null;

  /**
   * Broadcast SSE event.
   * @param {string} event
   * @param {object} data
   */
  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try { client.write(payload); } catch (_) { sseClients.delete(client); }
    }
  }

  /**
   * Execute a single action and return a promise that resolves when done.
   * @param {string} actionId
   * @param {string} milestoneId
   * @returns {Promise<{ actionId: string, exitCode: number }>}
   */
  function executeAction(actionId, milestoneId) {
    return new Promise((resolve) => {
      const prompt = `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;
      const proc = spawn('claude', ['-p', prompt, '--no-input'], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      activeProcesses.set(actionId, proc);

      // Log path
      const planningDir = path.join(cwd, '.planning');
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      const logPath = milestoneFolder ? path.join(milestoneFolder, 'execution.log') : undefined;
      appendLog(logPath, `\n=== START ${actionId} (play) @ ${new Date().toISOString()} ===`);

      // Line-buffered output
      let stdoutBuf = '';
      let stderrBuf = '';

      if (proc.stdout) {
        proc.stdout.on('data', (chunk) => {
          stdoutBuf += chunk.toString();
          const lines = stdoutBuf.split('\n');
          stdoutBuf = lines.pop() || '';
          for (const line of lines) {
            broadcast('action-output', { actionId, text: line, stream: 'stdout' });
            appendLog(logPath, `[${new Date().toISOString()}] [${actionId}] [stdout] ${line}`);
          }
        });
      }
      if (proc.stderr) {
        proc.stderr.on('data', (chunk) => {
          stderrBuf += chunk.toString();
          const lines = stderrBuf.split('\n');
          stderrBuf = lines.pop() || '';
          for (const line of lines) {
            broadcast('action-output', { actionId, text: line, stream: 'stderr' });
            appendLog(logPath, `[${new Date().toISOString()}] [${actionId}] [stderr] ${line}`);
          }
        });
      }

      proc.on('close', (exitCode) => {
        const code = exitCode ?? -1;
        appendLog(logPath, `=== END ${actionId} (play) @ ${new Date().toISOString()} exit=${code} ===\n`);
        activeProcesses.delete(actionId);
        broadcast('action-complete', { actionId, exitCode: code });
        resolve({ actionId, exitCode: code });
      });

      proc.on('error', (_err) => {
        appendLog(logPath, `=== ERROR ${actionId} (play) @ ${new Date().toISOString()} ===\n`);
        activeProcesses.delete(actionId);
        broadcast('action-complete', { actionId, exitCode: -1 });
        resolve({ actionId, exitCode: -1 });
      });
    });
  }

  /**
   * Start the play sequence.
   * @returns {{ ok?: boolean, error?: string, waves?: number }}
   */
  function start() {
    if (isRunning) {
      return { error: 'Play is already running' };
    }

    const graph = runLoadGraph(cwd);
    if ('error' in graph) {
      return { error: graph.error };
    }

    const { waves } = computePlayOrder(graph);
    if (waves.length === 0) {
      return { error: 'No ready agent milestones with pending actions' };
    }

    isRunning = true;
    stopRequested = false;
    playState = {
      currentWave: 0,
      totalWaves: waves.length,
      waveItems: [],
      completedActions: [],
      failedActions: [],
    };

    broadcast('play-start', {
      totalWaves: waves.length,
      waves: waves.map((w, i) => ({
        wave: i + 1,
        milestones: w.map(e => ({ milestoneId: e.milestoneId, actions: e.actions })),
      })),
    });

    // Run waves sequentially (async, non-blocking)
    (async () => {
      for (let wi = 0; wi < waves.length; wi++) {
        if (stopRequested) break;

        const wave = waves[wi];
        playState.currentWave = wi + 1;
        playState.waveItems = wave;

        broadcast('play-wave-start', {
          wave: wi + 1,
          totalWaves: waves.length,
          milestones: wave.map(e => ({ milestoneId: e.milestoneId, actions: e.actions })),
        });

        // Execute all actions in this wave concurrently
        const promises = [];
        for (const entry of wave) {
          for (const actionId of entry.actions) {
            if (stopRequested) break;
            promises.push(executeAction(actionId, entry.milestoneId));
          }
          if (stopRequested) break;
        }

        const results = await Promise.all(promises);

        for (const r of results) {
          if (r.exitCode === 0) {
            playState.completedActions.push(r.actionId);
          } else {
            playState.failedActions.push(r.actionId);
          }
        }

        broadcast('play-wave-complete', {
          wave: wi + 1,
          totalWaves: waves.length,
          completed: results.filter(r => r.exitCode === 0).map(r => r.actionId),
          failed: results.filter(r => r.exitCode !== 0).map(r => r.actionId),
        });
      }

      const finalState = { ...playState };
      isRunning = false;
      playState = null;

      broadcast('play-complete', {
        completed: finalState.completedActions,
        failed: finalState.failedActions,
        stopped: stopRequested,
      });
      stopRequested = false;
    })().catch((_err) => {
      isRunning = false;
      playState = null;
      broadcast('play-complete', { completed: [], failed: [], stopped: false, error: String(_err) });
    });

    return { ok: true, waves: waves.length };
  }

  /**
   * Stop the play sequence. Kills all active processes.
   * @returns {{ ok?: boolean, error?: string }}
   */
  function stop() {
    if (!isRunning) {
      return { error: 'Play is not running' };
    }

    stopRequested = true;
    for (const [, proc] of activeProcesses) {
      try { proc.kill('SIGTERM'); } catch (_) {}
    }

    return { ok: true };
  }

  /**
   * Check if play is currently running.
   * @returns {boolean}
   */
  function running() {
    return isRunning;
  }

  /**
   * Get current play status.
   * @returns {object | null}
   */
  function status() {
    if (!playState) return null;
    return {
      running: isRunning,
      currentWave: playState.currentWave,
      totalWaves: playState.totalWaves,
      activeActions: [...activeProcesses.keys()],
      completedActions: playState.completedActions,
      failedActions: playState.failedActions,
    };
  }

  return { start, stop, running, status };
}

module.exports = { computePlayOrder, createPlayRunner };
