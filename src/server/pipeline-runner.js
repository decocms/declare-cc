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

const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

const STATE_FILE = '.planning/pipeline-state.json';
const OUTPUT_BUFFER_MAX = 50000;

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
 *   stderrOutput: string,
 *   durationMs: number,
 *   startedAt: string,
 *   completedAt: string,
 *   retried: boolean,
 *   attempts: number
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
 *   skip: () => { ok?: boolean, error?: string },
 *   running: () => boolean,
 *   paused: () => { actionId: string, exitCode: number, waveIndex: number } | null,
 *   status: () => object | null
 * }}
 */
/**
 * Detect transient failures that warrant automatic retry.
 * @param {number} exitCode
 * @param {string} stderrOutput
 * @returns {boolean}
 */
function isTransientFailure(exitCode, stderrOutput) {
  // Timeout (124) or OOM kill (137)
  if (exitCode === 124 || exitCode === 137 || exitCode === -1) return true;
  const patterns = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOMEM|SIGKILL|SIGTERM|socket hang up|network timeout/i;
  return patterns.test(stderrOutput);
}

/**
 * Generate a markdown execution report.
 * @param {string} cwd
 * @param {ActionResult[]} results
 * @param {number} pipelineStartTime
 * @param {boolean} pipelineStopped
 * @param {string} startSha
 */
function generateExecutionReport(cwd, results, pipelineStartTime, pipelineStopped, startSha) {
  try {
    let endSha = 'unknown';
    try { endSha = execSync('git rev-parse --short HEAD', { cwd }).toString().trim(); } catch (_) {}

    const endTime = Date.now();
    const totalMs = endTime - pipelineStartTime;
    const totalMin = Math.floor(totalMs / 60000);
    const totalSec = Math.floor((totalMs % 60000) / 1000);

    const passed = results.filter(r => r.exitCode === 0).length;
    const failed = results.filter(r => r.exitCode !== 0).length;
    const overallStatus = pipelineStopped ? 'STOPPED' : failed > 0 ? 'FAILED' : 'SUCCESS';

    const startedAt = new Date(pipelineStartTime).toISOString();
    const completedAt = new Date(endTime).toISOString();

    let rows = '';
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const status = r.exitCode === 0 ? 'PASS' : 'FAIL';
      const durMin = Math.floor(r.durationMs / 60000);
      const durSec = Math.floor((r.durationMs % 60000) / 1000);
      const retried = r.retried ? `Yes (${r.attempts})` : 'No';
      rows += `| ${i + 1} | ${r.actionId} | ${r.milestoneId} | ${status} | ${durMin}m ${durSec}s | ${retried} |\n`;
    }

    const report = `# Execution Report

**Status:** ${overallStatus}
**Started:** ${startedAt}
**Completed:** ${completedAt}
**Duration:** ${totalMin}m ${totalSec}s
**Commits:** ${startSha}..${endSha}

## Results

| # | Action | Milestone | Status | Duration | Retried |
|---|--------|-----------|--------|----------|---------|
${rows}
## Summary

- **Passed:** ${passed}
- **Failed:** ${failed}
- **Total:** ${results.length}
`;

    const reportPath = path.join(cwd, '.planning', 'execution-report.md');
    fs.writeFileSync(reportPath, report, 'utf8');
    return reportPath;
  } catch (_) {
    return null;
  }
}

function createPipelineRunner(sseClients, cwd, registry) {
  /** @type {boolean} */
  let isRunning = false;
  /** @type {boolean} */
  let stopRequested = false;
  /** @type {Map<string, import('child_process').ChildProcess>} */
  const activeProcesses = new Map();
  /** @type {ActionResult[]} */
  let results = [];
  /** @type {{ currentWave: number, totalWaves: number, completedActions: string[], failedActions: string[], stoppedActions: string[], skippedActions: string[] } | null} */
  let pipelineState = null;
  /** @type {{ actionId: string, exitCode: number, waveIndex: number } | null} */
  let pausedOnFailure = null;
  /** @type {((decision: string) => void) | null} */
  let skipResolve = null;
  /** @type {Object<string, string>} Buffered output per action ID for restore on reconnect */
  const outputBuffers = {};
  /** @type {number} Total actions across all waves */
  let totalActionCount = 0;
  /** @type {string|undefined} Agent ID for the pipeline itself */
  let pipelineAgentId;
  /** @type {Map<string, string>} Action ID -> Agent ID for per-action tracking */
  const actionAgentIds = new Map();

  /**
   * Persist current pipeline state to disk for browser restore on refresh.
   * Called after every state mutation. Never throws.
   */
  function persistState() {
    if (!pipelineState) {
      // Pipeline not running -- delete state file
      try { fs.unlinkSync(path.join(cwd, STATE_FILE)); } catch (_) {}
      return;
    }
    const state = {
      running: isRunning,
      currentWave: pipelineState.currentWave,
      totalWaves: pipelineState.totalWaves,
      totalActions: totalActionCount,
      completedActions: pipelineState.completedActions,
      failedActions: pipelineState.failedActions,
      stoppedActions: pipelineState.stoppedActions,
      activeActions: [...activeProcesses.keys()],
      outputBuffers: outputBuffers,
      pausedOnFailure: pausedOnFailure,
      timestamp: Date.now(),
    };
    try { fs.writeFileSync(path.join(cwd, STATE_FILE), JSON.stringify(state, null, 2)); } catch (_) {}
  }

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

      // Register this action execution with the agent registry
      if (registry) {
        const agent = registry.spawn('execution', actionId, milestoneId);
        actionAgentIds.set(actionId, agent.id);
      }

      const prompt = `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;
      const spawnEnv = { ...process.env, FORCE_COLOR: '0' };
      delete spawnEnv.CLAUDECODE;
      const proc = spawn('claude', ['-p', prompt], {
        cwd,
        env: spawnEnv,
      });

      activeProcesses.set(actionId, proc);

      // Log path
      const planningDir = path.join(cwd, '.planning');
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      const logPath = milestoneFolder ? path.join(milestoneFolder, 'execution.log') : undefined;
      appendLog(logPath, `\n=== START ${actionId} (pipeline) @ ${startedAt} ===`);

      // Line-buffered output + full stderr accumulator for retry detection
      let stdoutBuf = '';
      let stderrBuf = '';
      let stderrFull = '';

      if (proc.stdout) {
        proc.stdout.on('data', (chunk) => {
          stdoutBuf += chunk.toString();
          const lines = stdoutBuf.split('\n');
          stdoutBuf = lines.pop() || '';
          for (const line of lines) {
            broadcast('action-output', { actionId, text: line, stream: 'stdout' });
            appendLog(logPath, `[${new Date().toISOString()}] [${actionId}] [stdout] ${line}`);
            // Buffer output for restore on page refresh
            if (!outputBuffers[actionId]) outputBuffers[actionId] = '';
            outputBuffers[actionId] += line + '\n';
            if (outputBuffers[actionId].length > OUTPUT_BUFFER_MAX) {
              outputBuffers[actionId] = outputBuffers[actionId].slice(-OUTPUT_BUFFER_MAX);
            }
          }
        });
      }
      if (proc.stderr) {
        proc.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          stderrFull += text;
          stderrBuf += text;
          const lines = stderrBuf.split('\n');
          stderrBuf = lines.pop() || '';
          for (const line of lines) {
            broadcast('action-output', { actionId, text: line, stream: 'stderr' });
            appendLog(logPath, `[${new Date().toISOString()}] [${actionId}] [stderr] ${line}`);
            // Buffer output for restore on page refresh
            if (!outputBuffers[actionId]) outputBuffers[actionId] = '';
            outputBuffers[actionId] += line + '\n';
            if (outputBuffers[actionId].length > OUTPUT_BUFFER_MAX) {
              outputBuffers[actionId] = outputBuffers[actionId].slice(-OUTPUT_BUFFER_MAX);
            }
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
        if (registry) {
          const aId = actionAgentIds.get(actionId);
          if (aId) {
            if (code === 0) {
              registry.complete(aId, { exitCode: 0, durationMs });
            } else {
              registry.fail(aId, code, 'process exited');
            }
            actionAgentIds.delete(actionId);
          }
        }
        resolve({ actionId, milestoneId, exitCode: code, stderrOutput: stderrFull, durationMs, startedAt, completedAt, retried: false, attempts: 1 });
      });

      proc.on('error', (_err) => {
        const completedAt = new Date().toISOString();
        const durationMs = Date.now() - startTime;
        appendLog(logPath, `=== ERROR ${actionId} (pipeline) @ ${completedAt} ===\n`);
        activeProcesses.delete(actionId);
        broadcast('action-complete', { actionId, exitCode: -1, durationMs });
        if (registry) {
          const aId = actionAgentIds.get(actionId);
          if (aId) {
            registry.fail(aId, -1, 'spawn error');
            actionAgentIds.delete(actionId);
          }
        }
        resolve({ actionId, milestoneId, exitCode: -1, stderrOutput: stderrFull, durationMs, startedAt, completedAt, retried: false, attempts: 1 });
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

    // Register the pipeline itself as an agent
    if (registry) {
      const agent = registry.spawn('pipeline', 'manifest', '');
      pipelineAgentId = agent.id;
    }
    pipelineState = {
      currentWave: 0,
      totalWaves: waves.length,
      completedActions: [],
      failedActions: [],
      stoppedActions: [],
      skippedActions: [],
    };

    // Count total actions for summary
    let totalActions = 0;
    for (const wave of waves) {
      for (const m of wave.milestones) {
        totalActions += m.actions.length;
      }
    }
    totalActionCount = totalActions;
    persistState();

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
      const pipelineStartTime = Date.now();
      let startSha = 'unknown';
      try { startSha = execSync('git rev-parse --short HEAD', { cwd }).toString().trim(); } catch (_) {}

      for (let wi = 0; wi < waves.length; wi++) {
        if (stopRequested) break;

        const wave = waves[wi];
        pipelineState.currentWave = wi + 1;
        persistState();

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

        // Retry transient failures once
        for (let ri = 0; ri < waveResults.length; ri++) {
          const r = waveResults[ri];
          if (r.exitCode !== 0 && !stopRequested && isTransientFailure(r.exitCode, r.stderrOutput)) {
            broadcast('action-retry', { actionId: r.actionId, milestoneId: r.milestoneId, attempt: 2, reason: 'transient failure detected' });
            appendLog(
              findMilestoneFolder(path.join(cwd, '.planning'), r.milestoneId)
                ? path.join(findMilestoneFolder(path.join(cwd, '.planning'), r.milestoneId), 'execution.log')
                : undefined,
              `\n=== RETRY ${r.actionId} (attempt 2) ===`
            );
            const retryResult = await executeAction(r.actionId, r.milestoneId);
            retryResult.retried = true;
            retryResult.attempts = 2;
            waveResults[ri] = retryResult;
          }
        }

        results.push(...waveResults);

        for (const r of waveResults) {
          if (r.exitCode === 0) {
            pipelineState.completedActions.push(r.actionId);
          } else {
            pipelineState.failedActions.push(r.actionId);
          }
        }
        persistState();

        broadcast('pipeline-wave-complete', {
          wave: wi + 1,
          totalWaves: waves.length,
          completed: waveResults.filter(r => r.exitCode === 0).map(r => r.actionId),
          failed: waveResults.filter(r => r.exitCode !== 0).map(r => r.actionId),
        });

        // Pause on failure: if any action in this wave failed (after retry),
        // pause and wait for user decision before continuing to next wave.
        const failedInWave = waveResults.filter(r => r.exitCode !== 0);
        if (failedInWave.length > 0 && !stopRequested) {
          const firstFailed = failedInWave[0];
          pausedOnFailure = { actionId: firstFailed.actionId, exitCode: firstFailed.exitCode, waveIndex: wi };
          persistState();
          broadcast('pipeline-paused', {
            actionId: firstFailed.actionId,
            exitCode: firstFailed.exitCode,
            wave: wi + 1,
            totalWaves: waves.length,
            failedActions: failedInWave.map(r => r.actionId),
          });

          // Wait for user decision (skip or stop)
          const decision = await new Promise(resolve => { skipResolve = resolve; });
          skipResolve = null;

          if (decision === 'stop') {
            stopRequested = true;
            pausedOnFailure = null;
            break;
          }
          // decision === 'skip': mark failed actions as skipped and continue
          for (const f of failedInWave) {
            pipelineState.skippedActions.push(f.actionId);
          }
          pausedOnFailure = null;
          broadcast('pipeline-resumed', { wave: wi + 1, skipped: failedInWave.map(r => r.actionId) });
        }
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

      const reportPath = generateExecutionReport(cwd, finalResults, pipelineStartTime, stopRequested, startSha);
      if (reportPath) {
        broadcast('pipeline-report', { path: '.planning/execution-report.md' });
      }

      broadcast('pipeline-complete', {
        completed: finalState.completedActions,
        failed: finalState.failedActions,
        stopped: stopRequested ? finalState.stoppedActions : [],
        results: finalResults,
        reportPath: reportPath ? '.planning/execution-report.md' : null,
      });

      // Complete or fail the pipeline agent in the registry
      if (registry && pipelineAgentId) {
        const failed = finalState.failedActions.length;
        if (failed === 0 && !stopRequested) {
          registry.complete(pipelineAgentId, {
            completed: finalState.completedActions.length,
            failed: 0,
            reportPath: reportPath ? '.planning/execution-report.md' : null,
          });
        } else {
          registry.fail(pipelineAgentId, 1, stopRequested ? 'stopped by user' : `${failed} action(s) failed`);
        }
        pipelineAgentId = undefined;
      }

      stopRequested = false;
      pausedOnFailure = null;
      pipelineState = null;
      persistState(); // Cleans up state file
    })().catch((_err) => {
      isRunning = false;
      pausedOnFailure = null;
      pipelineState = null;
      persistState(); // Cleans up state file
      if (registry && pipelineAgentId) {
        registry.fail(pipelineAgentId, -1, String(_err));
        pipelineAgentId = undefined;
      }
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

    // If paused on failure, resolve the pending decision as 'stop'
    if (pausedOnFailure && skipResolve) {
      skipResolve('stop');
      skipResolve = null;
    }

    for (const [actionId, proc] of activeProcesses) {
      try { proc.kill('SIGTERM'); } catch (_) {}
      if (registry) {
        const aId = actionAgentIds.get(actionId);
        if (aId) {
          registry.fail(aId, -1, 'stopped by user');
          actionAgentIds.delete(actionId);
        }
      }
    }

    persistState();
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

  /**
   * Skip the failed action and continue the pipeline.
   * Only works when pipeline is paused on failure.
   * @returns {{ ok?: boolean, error?: string }}
   */
  function skip() {
    if (!pausedOnFailure) {
      return { error: 'Pipeline is not paused' };
    }
    if (skipResolve) {
      skipResolve('skip');
      skipResolve = null;
    }
    return { ok: true };
  }

  /**
   * Get paused-on-failure info, or null if not paused.
   * @returns {{ actionId: string, exitCode: number, waveIndex: number } | null}
   */
  function paused() {
    return pausedOnFailure;
  }

  /**
   * Get full pipeline state for browser restore on page refresh.
   * Returns null if pipeline is not active (not running and not paused).
   * @returns {object | null}
   */
  function getFullState() {
    if (!isRunning && !pausedOnFailure) return null;
    return {
      running: isRunning,
      currentWave: pipelineState ? pipelineState.currentWave : 0,
      totalWaves: pipelineState ? pipelineState.totalWaves : 0,
      totalActions: totalActionCount,
      completedActions: pipelineState ? pipelineState.completedActions : [],
      failedActions: pipelineState ? pipelineState.failedActions : [],
      activeActions: [...activeProcesses.keys()],
      outputBuffers: outputBuffers,
      pausedOnFailure: pausedOnFailure,
    };
  }

  return { start, stop, skip, running, paused, status, getFullState };
}

module.exports = { createPipelineRunner };
