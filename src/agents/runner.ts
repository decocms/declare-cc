/**
 * Agent runner — spawns and tracks Claude subagents.
 *
 * Each agent gets the full causal context:
 *   Declaration → Milestone → Action
 * plus the relevant meta-prompt from src/agents/prompts/.
 *
 * Output streams via SSE to the dashboard.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { resolve, join } from "path";
import { randomUUID } from "crypto";
import { broadcastEvent } from "../server/sse";

export type AgentType = "derivation" | "execution" | "verification" | "onboarding" | "research";
export type AgentStatus = "running" | "completed" | "failed" | "interrupted";

export interface AgentRecord {
  id: string;
  type: AgentType;
  status: AgentStatus;
  prompt: string;
  context: string;
  output: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  wave?: number;
}

/** In-memory registry of agents */
const agents = new Map<string, AgentRecord>();

export function getAgents(): AgentRecord[] {
  return Array.from(agents.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function getAgent(id: string): AgentRecord | undefined {
  return agents.get(id);
}

/**
 * Spawn an agent. For now this is a simulated runner that:
 * 1. Records the agent in the registry
 * 2. Broadcasts status via SSE
 * 3. Runs the provided async function
 * 4. Captures output and completion
 *
 * TODO: Replace with actual Claude Agent SDK spawning
 */
export function spawnAgent(opts: {
  type: AgentType;
  prompt: string;
  context: string;
  cwd: string;
  execute: (onOutput: (chunk: string) => void) => Promise<string>;
}): AgentRecord {
  const agent: AgentRecord = {
    id: randomUUID().slice(0, 8),
    type: opts.type,
    status: "running",
    prompt: opts.prompt,
    context: opts.context,
    output: "",
    startedAt: new Date().toISOString(),
  };

  agents.set(agent.id, agent);
  broadcastEvent("agent-start", { id: agent.id, type: agent.type, prompt: agent.prompt });
  persistState(opts.cwd);

  // Run async
  opts
    .execute((chunk: string) => {
      agent.output += chunk;
      broadcastEvent("agent-output", { id: agent.id, chunk });
    })
    .then((result) => {
      agent.status = "completed";
      agent.output = result || agent.output;
      agent.completedAt = new Date().toISOString();
      broadcastEvent("agent-complete", { id: agent.id, status: "completed" });
      persistState(opts.cwd);
    })
    .catch((err) => {
      agent.status = "failed";
      agent.error = String(err);
      agent.completedAt = new Date().toISOString();
      broadcastEvent("agent-complete", { id: agent.id, status: "failed", error: agent.error });
      persistState(opts.cwd);
    });

  return agent;
}

/**
 * Build the causal context string for an action.
 * Declaration → Milestone → Action chain.
 */
export function buildActionContext(cwd: string, actionId: string): string {
  const { buildGraphFromDisk } = require("../core/graph") as typeof import("../core/graph");
  const graph = buildGraphFromDisk(cwd);

  const action = graph.actions.find((a) => a.id === actionId);
  if (!action) return `Action ${actionId} not found.`;

  const milestone = graph.milestones.find((m) => m.id === (action as any).milestoneId);
  const declaration = milestone
    ? graph.declarations.find((d) => milestone.realizes.includes(d.id))
    : undefined;

  const lines: string[] = [];
  if (declaration) {
    lines.push(`DECLARATION: ${declaration.id} — "${declaration.title}"`);
    lines.push(`  Statement: ${declaration.statement}`);
    lines.push("");
  }
  if (milestone) {
    lines.push(`MILESTONE: ${milestone.id} — "${milestone.title}"`);
    lines.push(`  Description: ${milestone.description}`);
    lines.push(`  Realizes: ${milestone.realizes.join(", ")}`);
    lines.push("");
  }
  lines.push(`ACTION: ${action.id} — "${action.title}"`);
  lines.push(`  Description: ${action.description ?? ""}`);

  return lines.join("\n");
}

/**
 * Load a meta-prompt by name (e.g., "05-execution").
 */
export function loadPrompt(name: string): string {
  const promptDir = resolve(__dirname, "prompts");
  const fp = join(promptDir, `${name}.md`);
  if (existsSync(fp)) return readFileSync(fp, "utf-8");
  return `Prompt "${name}" not found.`;
}

/** Persist agent state to disk for recovery across restarts */
function persistState(cwd: string) {
  const fp = resolve(cwd, ".planning", "agent-state.json");
  const data = Array.from(agents.values());
  try {
    writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

/** Restore agent state from disk */
export function restoreAgents(cwd: string): number {
  const fp = resolve(cwd, ".planning", "agent-state.json");
  if (!existsSync(fp)) return 0;
  try {
    const data: AgentRecord[] = JSON.parse(readFileSync(fp, "utf-8"));
    let interrupted = 0;
    for (const a of data) {
      if (a.status === "running") {
        a.status = "interrupted";
        interrupted++;
      }
      agents.set(a.id, a);
    }
    return interrupted;
  } catch {
    return 0;
  }
}
