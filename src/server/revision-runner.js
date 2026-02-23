// @ts-check
'use strict';

/**
 * Revision runner for browser-based plan revision.
 *
 * Spawns a Claude CLI subprocess with a revision prompt bundling
 * open annotations, streams output line-by-line to SSE clients,
 * versions the current artifact, and overwrites with revised content.
 *
 * Session-based tracking (one revision at a time).
 * Zero runtime dependencies — uses Node's built-in child_process and fs only.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Build the revision prompt from artifact content and annotations.
 *
 * @param {string} artifactContent - Current plan content
 * @param {Array<{line: number, text: string}>} annotations - Open annotations
 * @returns {string}
 */
function buildRevisionPrompt(artifactContent, annotations) {
  const annotationList = annotations
    .map(a => `- Line ${a.line}: ${a.text}`)
    .join('\n');

  return (
    'You are revising a plan artifact based on reviewer annotations. ' +
    'Do NOT implement anything — only update the plan document.\n\n' +
    '## Current plan content\n\n' +
    artifactContent + '\n\n' +
    '## Reviewer annotations to address\n\n' +
    annotationList + '\n\n' +
    '## Instructions\n\n' +
    'Revise the plan above to address ALL the reviewer\'s annotations. ' +
    'Output ONLY the revised plan content — no explanations, no markdown fencing, no preamble. ' +
    'The output will directly replace the current file.'
  );
}

/**
 * Create a revision runner that spawns and tracks Claude CLI revision processes.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @param {(nodeId: string) => void} onComplete - Callback invoked after successful revision
 * @returns {{ revise: (nodeId: string, artifactPath: string, artifactContent: string, annotations: Array<{line: number, text: string}>) => { ok?: boolean, error?: string, status?: number, sessionId?: string }, stop: () => { ok?: boolean, error?: string, status?: number }, running: () => string|null }}
 */
function createRevisionRunner(sseClients, cwd, onComplete) {
  /** @type {{ sessionId: string, proc: import('child_process').ChildProcess, nodeId: string } | null} */
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
   * @param {string} nodeId
   * @param {string} streamName - 'stdout' or 'stderr'
   * @param {{ text: string }} accumulator - Object to accumulate full text for stdout
   * @returns {(chunk: Buffer) => void}
   */
  function createLineHandler(sessionId, nodeId, streamName, accumulator) {
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
        broadcast('revision-output', {
          sessionId,
          nodeId,
          text: line,
          stream: streamName,
        });
      }
    };
  }

  /**
   * Strip markdown fencing from agent output if present.
   * The agent may wrap output in ```markdown ... ``` or ``` ... ```.
   *
   * @param {string} text
   * @returns {string}
   */
  function stripMarkdownFencing(text) {
    const trimmed = text.trim();
    // Match ```markdown\n...\n``` or ```\n...\n```
    const fenceMatch = trimmed.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/);
    if (fenceMatch) {
      return fenceMatch[1];
    }
    return trimmed;
  }

  /**
   * Spawn a Claude CLI process to revise a plan artifact.
   *
   * @param {string} nodeId - Node being revised
   * @param {string} artifactPath - Full path to the artifact file
   * @param {string} artifactContent - Current content of the artifact
   * @param {Array<{line: number, text: string}>} annotations - Open annotations to address
   * @returns {{ ok?: boolean, error?: string, status?: number, sessionId?: string }}
   */
  function revise(nodeId, artifactPath, artifactContent, annotations) {
    if (current) {
      return { error: 'busy', status: 409 };
    }

    const sessionId = `revision-${Date.now()}`;
    const prompt = buildRevisionPrompt(artifactContent, annotations);

    // Version the current artifact before revision
    try {
      const annPath = path.join(cwd, '.planning', 'annotations', nodeId.toUpperCase() + '.json');
      let round = 0;
      if (fs.existsSync(annPath)) {
        try {
          const annData = JSON.parse(fs.readFileSync(annPath, 'utf-8'));
          round = annData.revisionRound || 0;
        } catch (_) { /* ignore */ }
      }
      const versionedPath = artifactPath.replace('.md', '') + '.v' + round + '.md';
      fs.copyFileSync(artifactPath, versionedPath);
    } catch (_) {
      // If versioning fails, continue with the revision anyway
    }

    const spawnEnv = { ...process.env, FORCE_COLOR: '0' };
    delete spawnEnv.CLAUDECODE;
    const proc = spawn('claude', ['-p', prompt, '--output-format', 'text'], {
      cwd,
      env: spawnEnv,
    });

    current = { sessionId, proc, nodeId };

    // Accumulator for full stdout text
    const stdout = { text: '' };

    // Pipe stdout line-by-line
    if (proc.stdout) {
      proc.stdout.on('data', createLineHandler(sessionId, nodeId, 'stdout', stdout));
    }

    // Pipe stderr line-by-line
    if (proc.stderr) {
      proc.stderr.on('data', createLineHandler(sessionId, nodeId, 'stderr', stdout));
    }

    // Process exited
    proc.on('close', (exitCode) => {
      const completedNodeId = current ? current.nodeId : nodeId;
      current = null;

      if (exitCode === 0) {
        try {
          // Strip markdown fencing if present and write revised content
          const revisedContent = stripMarkdownFencing(stdout.text);
          fs.writeFileSync(artifactPath, revisedContent, 'utf-8');

          // Increment revisionRound
          const annPath = path.join(cwd, '.planning', 'annotations', completedNodeId.toUpperCase() + '.json');
          let annData = { nodeId: completedNodeId.toUpperCase(), annotations: [], revisionRound: 0 };
          if (fs.existsSync(annPath)) {
            try {
              annData = JSON.parse(fs.readFileSync(annPath, 'utf-8'));
            } catch (_) { /* ignore */ }
          }
          const newRound = (annData.revisionRound || 0) + 1;
          annData.revisionRound = newRound;
          const annDir = path.dirname(annPath);
          fs.mkdirSync(annDir, { recursive: true });
          fs.writeFileSync(annPath, JSON.stringify(annData, null, 2), 'utf-8');

          broadcast('revision-complete', {
            sessionId,
            nodeId: completedNodeId,
            exitCode,
            revisionRound: newRound,
          });

          // Call the onComplete callback to transition review state
          if (onComplete) {
            try { onComplete(completedNodeId); } catch (_) { /* ignore */ }
          }
        } catch (err) {
          broadcast('revision-complete', {
            sessionId,
            nodeId: completedNodeId,
            exitCode: -1,
            error: true,
          });
        }
      } else {
        broadcast('revision-complete', {
          sessionId,
          nodeId: completedNodeId,
          exitCode: exitCode ?? -1,
          error: true,
        });
      }
    });

    // Process failed to spawn (e.g. claude not found)
    proc.on('error', (_err) => {
      current = null;
      broadcast('revision-complete', {
        sessionId,
        nodeId,
        exitCode: -1,
        error: true,
      });
    });

    return { ok: true, sessionId };
  }

  /**
   * Stop the currently running revision process with SIGTERM.
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
   * Return the session ID of the currently running revision, or null.
   * @returns {string|null}
   */
  function running() {
    return current ? current.sessionId : null;
  }

  return { revise, stop, running };
}

// Self-test when run directly
if (require.main === module) {
  const runner = createRevisionRunner(new Set(), '.', () => {});
  console.log('revise:', typeof runner.revise);
  console.log('stop:', typeof runner.stop);
  console.log('running:', typeof runner.running);
  console.log('OK');
}

module.exports = { createRevisionRunner };
