/**
 * MCP entry point for `dcl mcp`.
 * Starts the Declare MCP server on stdio transport.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

export async function startMcpServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until the stdio stream closes.
}

// Allow direct invocation: `bun src/mcp/index.ts`
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/mcp/index.ts") ||
  process.argv[1]?.endsWith("/mcp/index.js");

if (isDirectRun) {
  startMcpServer().catch((error) => {
    console.error("Declare MCP server failed:", error);
    process.exit(1);
  });
}
