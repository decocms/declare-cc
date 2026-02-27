/**
 * AI Runner — uses @anthropic-ai/claude-agent-sdk (query) for Claude calls.
 *
 * Uses local Claude authentication (OAuth/subscription) — no separate API key needed.
 * The SDK is ESM-only, so we use dynamic import.
 *
 * CLAUDECODE env var is cleared once at module load to allow nested SDK usage.
 * After this fix, concurrent calls are safe — no serial queue needed.
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

export interface GenerateOpts {
  system?: string;
  prompt: string;
  onChunk?: (text: string) => void;
  model?: string;
  maxTurns?: number;
  withTools?: boolean;
  allowedTools?: string[];
  cwd?: string;
}

/**
 * Run a single Claude prompt and get the result text.
 * Concurrent-safe — no queue needed since CLAUDECODE is cleared at module load.
 */
export function generate(opts: GenerateOpts): Promise<string> {
  return _generate(opts);
}

/**
 * Run multiple Claude prompts concurrently (wave execution).
 * All tasks in the wave run in parallel; returns when all complete.
 * Results array matches input order. Throws if any task fails.
 */
export async function generateWave(tasks: GenerateOpts[]): Promise<string[]> {
  return Promise.all(tasks.map((t) => _generate(t)));
}

async function _generate(opts: GenerateOpts): Promise<string> {
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
