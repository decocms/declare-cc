#!/usr/bin/env bun
/**
 * dcl — CLI entry point for Declare v2.
 *
 * Commands:
 *   dcl           Start server in foreground, print dashboard URL
 *   dcl init      Scaffold .planning/ in current directory
 *   dcl serve     Start server (alias for default)
 *   dcl status    Print graph health to stdout
 *   dcl mcp       Start MCP server on stdio
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { resolve, join } from "path";
import { createServer } from "http";

const args = process.argv.slice(2);
const command = args[0] ?? "";

const cwd = process.env.DCL_PROJECT_ROOT || process.cwd();

switch (command) {
  case "init":
    runInit();
    break;
  case "status":
    runStatus();
    break;
  case "mcp":
    runMcp();
    break;
  case "serve":
  case "":
  case ".":
    runOpen();
    break;
  default:
    if (command.startsWith("/") || command.startsWith("~") || command === ".") {
      runOpen();
    } else {
      console.error(`Unknown command: ${command}`);
      console.error("Usage: dcl [init|serve|status|mcp]");
      process.exit(1);
    }
}

function runInit() {
  const planningDir = resolve(cwd, ".planning");
  const created: string[] = [];

  if (!existsSync(planningDir)) {
    mkdirSync(planningDir, { recursive: true });
  }

  const files: Record<string, string> = {
    "FUTURE.md": "# Future: Project\n",
    "MILESTONES.md":
      "# Milestones: Project\n\n## Milestones\n\n| ID | Title | Status | Realizes | Plan | Review |\n|----|-------|--------|----------|------|--------|\n",
    "config.json": '{\n  "commit_docs": true\n}\n',
  };

  for (const [name, content] of Object.entries(files)) {
    const fp = join(planningDir, name);
    if (!existsSync(fp)) {
      writeFileSync(fp, content, "utf-8");
      created.push(name);
    }
  }

  if (created.length > 0) {
    console.log(`Initialized .planning/ — created: ${created.join(", ")}`);
  } else {
    console.log(".planning/ already exists");
  }
}

function runStatus() {
  const { buildGraphFromDisk } = require("../core/graph") as typeof import("../core/graph");
  const graph = buildGraphFromDisk(cwd);

  console.log(`Project: ${graph.projectName}`);
  console.log(
    `Graph: ${graph.stats.declarations} declarations, ${graph.stats.milestones} milestones, ${graph.stats.actions} actions`,
  );
  if (graph.validation.errors.length > 0) {
    console.log(`Validation errors: ${graph.validation.errors.length}`);
    for (const e of graph.validation.errors) console.log(`  - ${e}`);
  } else {
    console.log("Validation: OK");
  }
}

async function runMcp() {
  // Dynamic import to avoid loading MCP deps when not needed
  const { startMcpServer } = await import("../mcp/index");
  await startMcpServer();
}

async function runOpen() {
  // Auto-init if needed
  const planningDir = resolve(cwd, ".planning");
  if (!existsSync(planningDir)) {
    console.log("Initializing Declare project...");
    runInit();
  }

  const portFile = resolve(planningDir, "server.port");

  // Check if server already running
  if (existsSync(portFile)) {
    const port = parseInt(readFileSync(portFile, "utf-8").trim(), 10);
    if (port > 0) {
      const alive = await checkServer(port);
      if (alive) {
        console.log(`Dashboard: http://localhost:${port}`);
        return;
      }
      try { unlinkSync(portFile); } catch {}
    }
  }

  // Start server in foreground
  const { default: server } = await import("../server/index");
  const port = server.port;

  // Write port file
  writeFileSync(portFile, String(port), "utf-8");

  console.log(`Dashboard: http://localhost:${port}`);

  // Cleanup on shutdown
  const shutdown = () => {
    try { unlinkSync(portFile); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Block forever
  await new Promise(() => {});
}

function checkServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = createServer().listen(port, "127.0.0.1");
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(true); // Port in use = server running
      } else {
        resolve(false);
      }
    });
    req.on("listening", () => {
      req.close();
      resolve(false); // Port free = no server
    });
  });
}
