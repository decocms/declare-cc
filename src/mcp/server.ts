/**
 * Declare v2 MCP Server.
 * Exposes the planning graph to agents via tools, resources, and prompts.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync, writeFileSync, readdirSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildGraphFromDisk } from "../core/graph.js";
import {
  parseFutureFile,
  writeFutureFile,
  parseMilestonesFile,
  writeMilestonesFile,
} from "../core/artifacts/index.js";
import type { Declaration } from "../core/artifacts/future.js";
import type { Milestone } from "../core/artifacts/milestones.js";

// ── Helpers ──

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../agents/prompts");

function getCwd(): string {
  return process.env.DCL_PROJECT_ROOT || process.cwd();
}

function getPlanningDir(): string {
  return resolve(getCwd(), ".planning");
}

function getProjectName(planningDir: string): string {
  const fp = resolve(planningDir, "FUTURE.md");
  if (!existsSync(fp)) return "Untitled";
  const m = readFileSync(fp, "utf-8").match(/^# Future:\s*(.+)/m);
  return m ? m[1].trim() : "Untitled";
}

function findMilestoneFolder(planningDir: string, id: string): string | null {
  const dir = resolve(planningDir, "milestones");
  if (!existsSync(dir)) return null;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const match = entries.find((e) => e.isDirectory() && e.name.startsWith(id));
    return match ? resolve(dir, match.name) : null;
  } catch {
    return null;
  }
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

// ── Server setup ──

export function createServer(): Server {
  const server = new Server(
    { name: "declare", version: "2.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  // ── Tools ──

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get-graph",
        description: "Returns the full Declare planning graph as JSON (declarations, milestones, actions, stats).",
        inputSchema: { type: "object" as const, properties: {} },
      },
      {
        name: "add-declaration",
        description: "Add a new declaration to FUTURE.md. Returns the created declaration with its auto-assigned ID.",
        inputSchema: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Short title for the declaration" },
            statement: { type: "string", description: "The falsifiable statement" },
            why: { type: "string", description: "Why this declaration matters" },
          },
          required: ["title", "statement"],
        },
      },
      {
        name: "update-declaration",
        description: "Update an existing declaration by ID. Only provided fields are changed.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "Declaration ID (e.g. D-01)" },
            title: { type: "string" },
            statement: { type: "string" },
            why: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "delete-declaration",
        description: "Delete a declaration by ID with cascade (orphaned milestones are removed).",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "Declaration ID (e.g. D-01)" },
          },
          required: ["id"],
        },
      },
      {
        name: "approve-batch",
        description: "Approve multiple declarations or milestones by ID. Sets their review state to 'approved'.",
        inputSchema: {
          type: "object" as const,
          properties: {
            ids: { type: "array", items: { type: "string" }, description: "Array of IDs (D-XX or M-XX)" },
          },
          required: ["ids"],
        },
      },
      {
        name: "get-status",
        description: "Returns graph health and stats: counts, validation errors, project name.",
        inputSchema: { type: "object" as const, properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get-graph": {
        const graph = buildGraphFromDisk(getCwd());
        return ok(graph);
      }

      case "add-declaration": {
        const { title, statement, why } = args as { title: string; statement: string; why?: string };
        const dir = getPlanningDir();
        const fp = resolve(dir, "FUTURE.md");
        const content = existsSync(fp) ? readFileSync(fp, "utf-8") : "";
        const declarations = parseFutureFile(content);
        const projectName = getProjectName(dir);

        const maxNum = declarations.reduce((max, d) => {
          const n = parseInt(d.id.replace("D-", ""), 10);
          return n > max ? n : max;
        }, 0);
        const newId = `D-${String(maxNum + 1).padStart(2, "0")}`;

        const newDecl: Declaration = { id: newId, title, statement, why: why ?? "", review: "draft" };
        declarations.push(newDecl);
        writeFileSync(fp, writeFutureFile(declarations, projectName), "utf-8");
        return ok(newDecl);
      }

      case "update-declaration": {
        const { id: rawId, ...fields } = args as { id: string; title?: string; statement?: string; why?: string };
        const id = rawId.toUpperCase();
        const dir = getPlanningDir();
        const fp = resolve(dir, "FUTURE.md");
        if (!existsSync(fp)) return err(`No FUTURE.md found`);

        const declarations = parseFutureFile(readFileSync(fp, "utf-8"));
        const projectName = getProjectName(dir);
        const idx = declarations.findIndex((d) => d.id === id);
        if (idx === -1) return err(`Not found: ${id}`);

        declarations[idx] = { ...declarations[idx], ...fields, id };
        writeFileSync(fp, writeFutureFile(declarations, projectName), "utf-8");
        return ok(declarations[idx]);
      }

      case "delete-declaration": {
        const id = ((args as { id: string }).id).toUpperCase();
        const dir = getPlanningDir();
        const fp = resolve(dir, "FUTURE.md");
        if (!existsSync(fp)) return err(`No FUTURE.md found`);

        const declarations = parseFutureFile(readFileSync(fp, "utf-8"));
        const projectName = getProjectName(dir);
        const filtered = declarations.filter((d) => d.id !== id);
        if (filtered.length === declarations.length) return err(`Not found: ${id}`);

        writeFileSync(fp, writeFutureFile(filtered, projectName), "utf-8");

        // Cascade: remove orphaned milestones
        const msPath = resolve(dir, "MILESTONES.md");
        if (existsSync(msPath)) {
          const milestones = parseMilestonesFile(readFileSync(msPath, "utf-8"));
          const surviving: Milestone[] = [];
          const orphaned: Milestone[] = [];
          for (const m of milestones) {
            if (!m.realizes.includes(id)) {
              surviving.push(m);
            } else if (m.realizes.length === 1) {
              orphaned.push(m);
            } else {
              surviving.push({ ...m, realizes: m.realizes.filter((r) => r !== id) });
            }
          }
          if (orphaned.length > 0) {
            for (const m of orphaned) {
              const folder = findMilestoneFolder(dir, m.id);
              if (folder) rmSync(folder, { recursive: true, force: true });
            }
            writeFileSync(msPath, writeMilestonesFile(surviving, getProjectName(dir)), "utf-8");
          }
        }

        return ok({ deleted: id });
      }

      case "approve-batch": {
        const { ids } = args as { ids: string[] };
        const dir = getPlanningDir();
        const results: string[] = [];

        for (const rawId of ids) {
          const id = rawId.toUpperCase();
          const prefix = id.split("-")[0];

          if (prefix === "D") {
            const fp = resolve(dir, "FUTURE.md");
            if (!existsSync(fp)) continue;
            const declarations = parseFutureFile(readFileSync(fp, "utf-8"));
            const d = declarations.find((d) => d.id === id);
            if (d) {
              d.review = "approved";
              writeFileSync(fp, writeFutureFile(declarations, getProjectName(dir)), "utf-8");
              results.push(id);
            }
          } else if (prefix === "M") {
            const msPath = resolve(dir, "MILESTONES.md");
            if (!existsSync(msPath)) continue;
            const milestones = parseMilestonesFile(readFileSync(msPath, "utf-8"));
            const m = milestones.find((m) => m.id === id);
            if (m) {
              m.reviewState = "approved";
              writeFileSync(msPath, writeMilestonesFile(milestones, getProjectName(dir)), "utf-8");
              results.push(id);
            }
          }
        }

        return ok({ approved: results });
      }

      case "get-status": {
        const graph = buildGraphFromDisk(getCwd());
        return ok({
          projectName: graph.projectName,
          stats: graph.stats,
          validation: graph.validation,
          healthy: graph.validation.errors.length === 0,
        });
      }

      default:
        return err(`Unknown tool: ${name}`);
    }
  });

  // ── Resources ──

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "declare://graph",
        name: "Planning Graph",
        description: "Current graph state as JSON (declarations, milestones, actions)",
        mimeType: "application/json",
      },
      {
        uri: "declare://project",
        name: "PROJECT.md",
        description: "Project description file contents",
        mimeType: "text/markdown",
      },
      ...["01-vision", "02-declarations", "03-milestones", "04-actions", "05-execution", "06-verification"].map(
        (name) => ({
          uri: `declare://prompt/${name}`,
          name: `Meta-prompt: ${name}`,
          description: `The ${name} meta-prompt template`,
          mimeType: "text/markdown",
        }),
      ),
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === "declare://graph") {
      const graph = buildGraphFromDisk(getCwd());
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(graph, null, 2) }] };
    }

    if (uri === "declare://project") {
      const projectPath = resolve(getCwd(), "PROJECT.md");
      const text = existsSync(projectPath) ? readFileSync(projectPath, "utf-8") : "No PROJECT.md found.";
      return { contents: [{ uri, mimeType: "text/markdown", text }] };
    }

    const promptMatch = uri.match(/^declare:\/\/prompt\/(.+)$/);
    if (promptMatch) {
      const name = promptMatch[1];
      const filePath = resolve(PROMPTS_DIR, `${name}.md`);
      if (!existsSync(filePath)) {
        return { contents: [{ uri, mimeType: "text/markdown", text: `Prompt not found: ${name}` }] };
      }
      const text = readFileSync(filePath, "utf-8");
      return { contents: [{ uri, mimeType: "text/markdown", text }] };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // ── Prompts ──

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "onboard",
        description: "Full onboarding flow: vision capture, questions, and declaration generation.",
      },
      {
        name: "derive-milestones",
        description: "Given approved declarations, derive milestones that realize them.",
      },
      {
        name: "plan-actions",
        description: "Given a milestone, plan the concrete actions to complete it.",
        arguments: [{ name: "milestoneId", description: "The milestone ID (e.g. M-01)", required: true }],
      },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    function loadPrompt(filename: string): string {
      const fp = resolve(PROMPTS_DIR, filename);
      return existsSync(fp) ? readFileSync(fp, "utf-8") : `(prompt file not found: ${filename})`;
    }

    switch (name) {
      case "onboard": {
        const vision = loadPrompt("01-vision.md");
        const declarations = loadPrompt("02-declarations.md");
        return {
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: [vision, "---", declarations].join("\n\n") },
            },
          ],
        };
      }

      case "derive-milestones": {
        const graph = buildGraphFromDisk(getCwd());
        const approved = graph.declarations.filter((d) => d.review === "approved");
        const milestones = loadPrompt("03-milestones.md");
        const context = `## Current approved declarations\n\n${JSON.stringify(approved, null, 2)}`;
        return {
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: [milestones, "---", context].join("\n\n") },
            },
          ],
        };
      }

      case "plan-actions": {
        const milestoneId = (args?.milestoneId ?? "").toUpperCase();
        const graph = buildGraphFromDisk(getCwd());
        const milestone = graph.milestones.find((m) => m.id === milestoneId);
        const actions = loadPrompt("04-actions.md");
        const context = milestone
          ? `## Target milestone\n\n${JSON.stringify(milestone, null, 2)}`
          : `## Error\n\nMilestone ${milestoneId} not found.`;
        return {
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: [actions, "---", context].join("\n\n") },
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  return server;
}
