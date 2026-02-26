/**
 * AI Runner — uses @anthropic-ai/claude-agent-sdk (query) for Claude calls.
 *
 * Uses local Claude authentication (OAuth/subscription) — no separate API key needed.
 * The SDK is ESM-only, so we use dynamic import.
 *
 * Calls are serialized via a queue because the SDK spawns subprocesses
 * that share auth state and can conflict when running concurrently.
 */

let _query: any;

// Capture and clear CLAUDECODE once at module load to allow nested SDK usage.
const _savedClaudeCode = process.env.CLAUDECODE;
delete process.env.CLAUDECODE;

/** Lazily load the SDK query function. */
async function getQuery() {
  if (!_query) {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    _query = sdk.query;
  }
  return _query;
}

/** Simple serial queue — each generate() waits for the previous one to finish. */
let _queue: Promise<any> = Promise.resolve();

/**
 * Run a Claude prompt and get the result text.
 * Calls are serialized to avoid SDK subprocess conflicts.
 */
export function generate(opts: {
  system?: string;
  prompt: string;
  onChunk?: (text: string) => void;
  model?: string;
  maxTurns?: number;
  withTools?: boolean;
  allowedTools?: string[];
  cwd?: string;
}): Promise<string> {
  const p = _queue.then(() => _generate(opts));
  // Update queue — always resolve so next item runs even if this one fails
  _queue = p.catch(() => {});
  return p;
}

async function _generate(opts: {
  system?: string;
  prompt: string;
  onChunk?: (text: string) => void;
  model?: string;
  maxTurns?: number;
  withTools?: boolean;
  allowedTools?: string[];
  cwd?: string;
}): Promise<string> {
  const queryFn = await getQuery();
  const abortController = new AbortController();

  // Timeout: 2 min text-only, 10 min with tools
  const timeoutMs =
    opts.withTools || opts.allowedTools ? 10 * 60 * 1000 : 2 * 60 * 1000;
  const timeoutId = setTimeout(() => {
    if (!abortController.signal.aborted) abortController.abort();
  }, timeoutMs);

  try {
    // Build a clean env snapshot without CLAUDECODE
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const queryOpts: Record<string, any> = {
      model: opts.model || "sonnet",
      maxTurns: opts.maxTurns || 1,
      cwd: opts.cwd || process.cwd(),
      abortController,
      env,
      systemPrompt:
        opts.system ||
        "You are a helpful assistant. Respond concisely and directly.",
    };

    if (opts.withTools || opts.allowedTools) {
      queryOpts.allowedTools = opts.allowedTools || [
        "Read",
        "Write",
        "Edit",
        "Bash",
        "Glob",
        "Grep",
      ];
      queryOpts.permissionMode = "bypassPermissions";
      if (!opts.maxTurns) queryOpts.maxTurns = 10;
    } else {
      queryOpts.tools = [];
    }

    const conversation = queryFn({
      prompt: opts.prompt,
      options: queryOpts,
    });

    let resultText = "";
    for await (const message of conversation) {
      if (message.type === "assistant") {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              resultText += block.text;
              opts.onChunk?.(block.text);
            }
          }
        }
      } else if (message.type === "result") {
        if (message.subtype === "success" && message.result) {
          resultText = message.result;
        } else if (message.is_error) {
          const errDetail =
            message.errors?.join(", ") ||
            message.error ||
            JSON.stringify(message);
          throw new Error(errDetail || "AI query failed");
        }
      }
    }

    return resultText;
  } catch (err) {
    if (abortController.signal.aborted) {
      throw new Error("AI query cancelled (timeout)");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
