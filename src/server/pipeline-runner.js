// @ts-check
'use strict';

/**
 * Pipeline runner -- manifest-driven execution engine.
 *
 * Reads .planning/execution-manifest.json and executes all milestones/actions
 * in declared wave order. Waves execute sequentially; actions within a wave
 * execute concurrently. Streams SSE events for live progress tracking.
 *
 * Zero runtime dependencies. CJS module.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

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
 * @typedef {{
 *   actionId: string,
 *   milestoneId: string,
 *   exitCode: number,
 *   durationMs: number,
 *   startedAt: string,
 *   completedAt: string
 * }} ActionResult
 */

/**
 * Create a manifest-driven pipeline runner.
 *
 * @param {Set<import('http').ServerResponse>} sseClients
 * @param {string} cwd
 * @returns {{
 *   start: () => { ok?: boolean, error?: string, waves?: number },
 *   stop: () => { ok?: boolean, error?: string },
 *   running: () => boolean,
 *   status: () => object | null
 * }}
 */
function createPipelineRunner(sseClients, cwd) {
  /** @type {boolean} */
  let isRunning = false;
  /** @type {boolean} */
  let stopRequested = false;
  /** @type {Map<string, import('child_process').ChildProcess>} */
  const activeProcesses = new Map();
  /** @type {ActionResult[]} */
  let results = [];
  /** @type {{ currentWave: number, totalWaves: number, completedActions: string[], failedActions: string[], stoppedActions: string[] } | null} */
  let pipelineState = null;

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
   * Load and validate the execution manifest.
   * @returns {{ waves: Array<{ milestones: Array<{ id: string, actions: string[] }> }> } | { error: string }}
   */
  function loadManifest() {
    const manifestPath = path.join(cwd, '.planning', 'execution-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { error: 'Execution manifest not found at .planning/execution-manifest.json' };
    }

    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const data = JSON.parse(raw);

      if (!data || !Array.isArray(data.waves) || data.waves.length === 0) {
        return { error: 'Execution manifest is malformed: waves must be a non-empty array' };
      }

      // Validate each wave
      for (let i = 0; i < data.waves.length; i++) {
        const wave = data.waves[i];
        if (!Array.isArray(wave.milestones)) {
          return { error: `Execution manifest malformed: waves[${i}].milestones must be an array` };
        }
        for (let j = 0; j < wave.milestones.length; j++) {
          const m = wave.milestones[j];
          if (typeof m.id !== 'string' || !m.id) {
            return { error: `Execution manifest malformed: waves[${i}].milestones[${j}].id must be a non-empty string` };
          }
          if (!Array.isArray(m.actions)) {
            return { error: `Execution manifest malformed: waves[${i}].milestones[${j}].actions must be an array` };
          }
        }
      }

      return { waves: data.waves };
    } catch (err) {
      return { error: `Failed to parse execution manifest: ${String(err)}` };
    }
  }

  /**
   * Execute a single action and return a promise that resolves when done.
   * @param {string} actionId
   * @param {string} milestoneId
   * @returns {Promise<ActionResult>}
   */
  function executeAction(actionId, milestoneId) {
    return new Promise((resolve) => {
      const startedAt = new Date().toISOString();
      const startTime = Date.now();

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
      appendLog(logPath, `\n=== START ${actionId} (pipeline) @ ${startedAt} ===`);

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
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - startTime;
        appendLog(logPath, `=== END ${actionId} (pipeline) @ ${completedAt} exit=${code} duration=${durationMs}ms ===\n`);
        activeProcesses.delete(actionId);
        broadcast('action-complete', { actionId, exitCode: code, durationMs });
        resolve({ actionId, milestoneId, exitCode: code, durationMs, startedAt, completedAt });
      });

      proc.on('error', (_err) => {
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - startTime;
        appendLog(logPath, `=== ERROR ${actionId} (pipeline) @ ${completedAt} ===\n`);
        activeProcesses.delete(actionId);
        broadcast('action-complete', { actionId, exitCode: -1, durationMs });
        resolve({ actionId, milestoneId, exitCode: -1, durationMs, startedAt, completedAt });
      });
    });
  }

  /**
   * Start the pipeline execution.
   * @returns {{ ok?: boolean, error?: string, waves?: number }}
   */
  function start() {
    if (isRunning) {
      return { error: 'Pipeline is already running' };
    }

    const manifest = loadManifest();
    if ('error' in manifest) {
      return { error: manifest.error };
    }

    const waves = manifest.waves;

    isRunning = true;
    stopRequested = false;
    results = [];
    pipelineState = {
      currentWave: 0,
      totalWaves: waves.length,
      completedActions: [],
      failedActions: [],
      stoppedActions: [],
    };

    // Count total actions for summary
    let totalActions = 0;
    for (const wave of waves) {
      for (const m of wave.milestones) {
        totalActions += m.actions.length;
      }
    }

    broadcast('pipeline-start', {
      totalWaves: waves.length,
      totalActions,
      waves: waves.map((w, i) => ({
        wave: i + 1,
        milestones: w.milestones.map(m => ({ id: m.id, actions: m.actions })),
      })),
    });

    // Run waves sequentially (async, non-blocking)
    (async () => {
      for (let wi = 0; wi < waves.length; wi++) {
        if (stopRequested) break;

        const wave = waves[wi];
        pipelineState.currentWave = wi + 1;

        broadcast('pipeline-wave-start', {
          wave: wi + 1,
          totalWaves: waves.length,
          milestones: wave.milestones.map(m => ({ id: m.id, actions: m.actions })),
        });

        // Execute all actions in this wave concurrently
        const promises = [];
        for (const milestone of wave.milestones) {
          for (const actionId of milestone.actions) {
            if (stopRequested) break;
            promises.push(executeAction(actionId, milestone.id));
          }
          if (stopRequested) break;
        }

        const waveResults = await Promise.all(promises);
        results.push(...waveResults);

        for (const r of waveResults) {
          if (r.exitCode === 0) {
            pipelineState.completedActions.push(r.actionId);
          } else {
            pipelineState.failedActions.push(r.actionId);
          }
        }

        broadcast('pipeline-wave-complete', {
          wave: wi + 1,
          totalWaves: waves.length,
          completed: waveResults.filter(r => r.exitCode === 0).map(r => r.actionId),
          failed: waveResults.filter(r => r.exitCode !== 0).map(r => r.actionId),
        });
      }

      const finalState = { ...pipelineState };
      const finalResults = [...results];
      isRunning = false;

      // Mark any remaining active as stopped
      if (stopRequested) {
        for (const actionId of activeProcesses.keys()) {
          finalState.stoppedActions.push(actionId);
        }
      }

      broadcast('pipeline-complete', {
        completed: finalState.completedActions,
        failed: finalState.failedActions,
        stopped: stopRequested ? finalState.stoppedActions : [],
        results: finalResults,
      });

      stopRequested = false;
      pipelineState = null;
    })().catch((_err) => {
      isRunning = false;
      pipelineState = null;
      broadcast('pipeline-complete', {
        completed: [],
        failed: [],
        stopped: [],
        error: String(_err),
        results,
      });
    });

    return { ok: true, waves: waves.length };
  }

  /**
   * Stop the pipeline execution. Kills all active processes.
   * @returns {{ ok?: boolean, error?: string }}
   */
  function stop() {
    if (!isRunning) {
      return { error: 'Pipeline is not running' };
    }

    stopRequested = true;
    for (const [, proc] of activeProcesses) {
      try { proc.kill('SIGTERM'); } catch (_) {}
    }

    return { ok: true };
  }

  /**
   * Check if pipeline is currently running.
   * @returns {boolean}
   */
  function running() {
    return isRunning;
  }

  /**
   * Get current pipeline status.
   * @returns {object | null}
   */
  function status() {
    if (!pipelineState) return null;
    return {
      running: isRunning,
      currentWave: pipelineState.currentWave,
      totalWaves: pipelineState.totalWaves,
      activeActions: [...activeProcesses.keys()],
      completedActions: pipelineState.completedActions,
      failedActions: pipelineState.failedActions,
      results,
    };
  }

  return { start, stop, running, status };
}

module.exports = { createPipelineRunner };
