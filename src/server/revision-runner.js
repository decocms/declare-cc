// @ts-check
'use strict';

/**
 * Revision runner for browser-based plan revision.
 *
 * Uses the AI runner (Claude Agent SDK) to revise plan artifacts based on
 * annotations. Streams output to SSE clients, versions the current artifact,
 * and overwrites with revised content.
 *
 * Session-based tracking (one revision at a time).
 */

const { runAI } = require('./ai-runner');
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

const SYSTEM_PROMPT =
  'You are revising a plan artifact based on reviewer annotations. ' +
  'Do NOT implement anything — only update the plan document. ' +
  'Output ONLY the revised content with no markdown fencing or preamble.';

/**
 * Create a revision runner that uses the AI runner SDK for plan revision.
 *
 * @param {Set<import('http').ServerResponse>} sseClients - Active SSE clients to broadcast to
 * @param {string} cwd - Project root directory
 * @param {(nodeId: string) => void} onComplete - Callback invoked after successful revision
 * @returns {{ revise: (nodeId: string, artifactPath: string, artifactContent: string, annotations: Array<{line: number, text: string}>) => { ok?: boolean, error?: string, status?: number, sessionId?: string }, stop: () => { ok?: boolean, error?: string, status?: number }, running: () => string|null }}
 */
function createRevisionRunner(sseClients, cwd, onComplete, registry) {
  /** @type {{ sessionId: string, abortController: AbortController, nodeId: string, agentId?: string } | null} */
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
   * Run an AI agent to revise a plan artifact.
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

    const abortController = new AbortController();

    /** @type {string|undefined} */
    let agentId;
    if (registry) {
      const agent = registry.spawn('revision', nodeId, '');
      agentId = agent.id;
    }

    current = { sessionId, abortController, nodeId, agentId };

    // Fire and forget — results stream via SSE
    runAI(prompt, {
      cwd,
      model: 'sonnet',
      systemPrompt: SYSTEM_PROMPT,
      abortController,
      onText: (chunk) => {
        broadcast('revision-output', {
          sessionId,
          nodeId,
          text: chunk,
          stream: 'stdout',
        });
      },
    }).then(({ text, error }) => {
      const completedNodeId = current ? current.nodeId : nodeId;
      const closingAgentId = current ? current.agentId : undefined;
      current = null;

      if (error) {
        broadcast('revision-complete', {
          sessionId,
          nodeId: completedNodeId,
          exitCode: 1,
          error: true,
        });
        if (registry && closingAgentId) {
          registry.fail(closingAgentId, 1, error);
        }
        return;
      }

      try {
        // Strip markdown fencing if present and write revised content
        const revisedContent = stripMarkdownFencing(text);
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
          exitCode: 0,
          revisionRound: newRound,
        });

        // Call the onComplete callback to transition review state
        if (onComplete) {
          try { onComplete(completedNodeId); } catch (_) { /* ignore */ }
        }
        if (registry && closingAgentId) {
          registry.complete(closingAgentId, {
            nodeId: completedNodeId,
            planPath: artifactPath,
            revisionRound: newRound,
          });
        }
      } catch (err) {
        broadcast('revision-complete', {
          sessionId,
          nodeId: completedNodeId,
          exitCode: -1,
          error: true,
        });
        if (registry && closingAgentId) {
          registry.fail(closingAgentId, -1, 'revision post-processing error');
        }
      }
    }).catch((err) => {
      const errorAgentId = current ? current.agentId : undefined;
      current = null;
      broadcast('revision-complete', {
        sessionId,
        nodeId,
        exitCode: -1,
        error: true,
      });
      if (registry && errorAgentId) {
        registry.fail(errorAgentId, -1, 'error');
      }
    });

    return { ok: true, sessionId };
  }

  /**
   * Stop the currently running revision.
   *
   * @returns {{ ok?: boolean, error?: string, status?: number }}
   */
  function stop() {
    if (!current) {
      return { error: 'not_running', status: 404 };
    }

    current.abortController.abort();
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
