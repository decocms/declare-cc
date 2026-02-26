// @ts-check
'use strict';

/**
 * AI Runner — uses @anthropic-ai/claude-agent-sdk to run AI tasks.
 *
 * Replaces spawning `claude -p` as a subprocess. The SDK manages the
 * subprocess lifecycle internally and streams results via async generator.
 *
 * Two modes:
 *   - textOnly (default): no tools, quick text generation (reviews, derivations)
 *   - withTools: full tool access for write operations that modify files
 */

let _query;

/**
 * Lazily load the SDK query function.
 * The SDK is ESM-only, so we use dynamic import.
 */
async function getQuery() {
  if (!_query) {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    _query = sdk.query;
  }
  return _query;
}

/**
 * Run an AI prompt and get the result text.
 * Streams internally and returns the final text result.
 *
 * @param {string} prompt - The prompt to send
 * @param {object} [opts]
 * @param {string} [opts.cwd] - Working directory
 * @param {string} [opts.model] - Model to use (default: 'haiku')
 * @param {number} [opts.maxTurns] - Max turns (default: 1)
 * @param {boolean} [opts.withTools] - Enable file tools (Read, Write, Edit, Bash, Glob, Grep)
 * @param {string[]} [opts.allowedTools] - Specific tools to allow (overrides withTools default set)
 * @param {string} [opts.systemPrompt] - Custom system prompt (overrides default)
 * @param {(text: string) => void} [opts.onText] - Callback for streaming text chunks
 * @param {AbortController} [opts.abortController] - For cancellation
 * @returns {Promise<{ text: string, error?: string }>}
 */
async function runAI(prompt, opts = {}) {
  const queryFn = await getQuery();
  const abortController = opts.abortController || new AbortController();

  // Auto-timeout: abort after 2 minutes for text-only, 10 minutes for tool-enabled
  const timeoutMs = (opts.withTools || opts.allowedTools) ? 10 * 60 * 1000 : 2 * 60 * 1000;
  const timeoutId = setTimeout(() => {
    if (!abortController.signal.aborted) abortController.abort();
  }, timeoutMs);

  // Clear CLAUDECODE env var to allow nested SDK usage
  const savedClaudeCode = process.env.CLAUDECODE;
  delete process.env.CLAUDECODE;

  try {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    // Build options based on mode
    const queryOpts = {
      model: opts.model || 'sonnet',
      maxTurns: opts.maxTurns || 1,
      cwd: opts.cwd || process.cwd(),
      abortController,
      env,
      systemPrompt: opts.systemPrompt || 'You are a helpful assistant. Respond concisely and directly.',
    };

    if (opts.withTools || opts.allowedTools) {
      // Tool-enabled mode: agent can read/write files, run commands
      queryOpts.allowedTools = opts.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
      queryOpts.permissionMode = 'bypassPermissions';
      // More turns needed when tools are in play
      if (!opts.maxTurns) queryOpts.maxTurns = 10;
    } else {
      // Text-only mode: no tools for fast generation
      queryOpts.tools = [];
    }

    const conversation = queryFn({
      prompt,
      options: queryOpts,
    });

    let resultText = '';
    for await (const message of conversation) {
      if (message.type === 'assistant') {
        // Extract text from content blocks
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              resultText += block.text;
              if (opts.onText) opts.onText(block.text);
            }
          }
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success' && message.result) {
          resultText = message.result;
        } else if (message.is_error) {
          const errDetail = message.errors?.join(', ') || message.error || JSON.stringify(message);
          console.error('[ai-runner] SDK error result:', errDetail);
          return { text: '', error: errDetail || 'AI query failed' };
        }
      }
    }

    return { text: resultText };
  } catch (err) {
    console.error('[ai-runner] Exception:', err.message || err);
    if (abortController.signal.aborted) {
      return { text: '', error: 'Cancelled' };
    }
    return { text: '', error: String(err.message || err) };
  } finally {
    clearTimeout(timeoutId);
    // Restore CLAUDECODE env var
    if (savedClaudeCode) process.env.CLAUDECODE = savedClaudeCode;
  }
}

module.exports = { runAI };
