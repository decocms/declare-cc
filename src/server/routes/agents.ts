import { Hono } from "hono";
import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import {
  getAgents,
  getAgent,
  spawnAgent,
  buildActionContext,
  loadPrompt,
} from "../../agents/runner";
import { broadcastEvent } from "../sse";
import { writePlanFile } from "../../core/artifacts/plan";

const agentRoutes = new Hono();

function getCwd() {
  return process.env.DCL_PROJECT_ROOT || process.cwd();
}

/** List all agents */
agentRoutes.get("/agents", (c) => {
  return c.json(getAgents());
});

/** Get single agent by ID */
agentRoutes.get("/agents/:id", (c) => {
  const agent = getAgent(c.req.param("id"));
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  return c.json(agent);
});

/** Spawn a derivation agent (derive milestones for a declaration) */
agentRoutes.post("/agents/derive", async (c) => {
  const body = await c.req.json<{ declarationId: string; direction?: string }>();
  const cwd = getCwd();
  const prompt = loadPrompt("03-milestones");

  const agent = spawnAgent({
    type: "derivation",
    prompt: `Derive milestones for ${body.declarationId}`,
    context: `Direction: ${body.direction ?? "none"}\n\n${prompt}`,
    cwd,
    execute: async (onOutput) => {
      // TODO: Replace with actual Claude Agent SDK call
      onOutput("Analyzing declaration...\n");
      await sleep(1000);
      onOutput("Deriving milestones backward from declared future...\n");
      await sleep(1000);
      onOutput("Generated 3 milestone candidates.\n");
      return "Derivation complete. Review milestones in the dashboard.";
    },
  });

  return c.json(agent, 201);
});

/** Spawn an agent to plan actions for a milestone — writes PLAN.md */
agentRoutes.post("/agents/plan-actions", async (c) => {
  const body = await c.req.json<{ milestoneId: string }>();
  const cwd = getCwd();
  const mId = body.milestoneId.toUpperCase();
  const prompt = loadPrompt("04-actions");

  // Find milestone info from graph
  const { buildGraphFromDisk } = await import("../../core/graph");
  const graph = buildGraphFromDisk(cwd);
  const milestone = graph.milestones.find((m) => m.id === mId);
  const title = milestone?.title ?? mId;

  const agent = spawnAgent({
    type: "derivation",
    prompt: `Plan actions for ${mId}`,
    context: `Milestone: ${mId} — ${title}\n\n${prompt}`,
    cwd,
    execute: async (onOutput) => {
      // TODO: Replace with actual Claude Agent SDK call
      // For now, generate placeholder actions and write PLAN.md
      onOutput(`Planning actions for ${mId}: ${title}...\n`);
      await sleep(1000);

      const actions = [
        { id: "A-01", title: `Define requirements for ${title}`, description: `Document what ${title} needs`, status: "PENDING", dependsOn: [] },
        { id: "A-02", title: `Implement ${title}`, description: `Build the core implementation`, status: "PENDING", dependsOn: ["A-01"] },
        { id: "A-03", title: `Verify ${title}`, description: `Test and confirm the milestone condition holds`, status: "PENDING", dependsOn: ["A-02"] },
      ];

      onOutput(`Generated ${actions.length} actions.\n`);
      await sleep(500);

      // Write PLAN.md to the milestone folder
      const planningDir = resolve(cwd, ".planning");
      const msDir = resolve(planningDir, "milestones");
      // Find or create milestone folder
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").slice(0, 40);
      const folderName = `${mId}-${slug}`;
      const folder = resolve(msDir, folderName);
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true });

      const planContent = writePlanFile(actions, mId, title);
      writeFileSync(resolve(folder, "PLAN.md"), planContent, "utf-8");

      onOutput(`Wrote PLAN.md to ${folderName}/\n`);
      broadcastEvent("change", { reason: "plan-actions", nodeId: mId });

      return `Planned ${actions.length} actions for ${mId}. Refresh to see them.`;
    },
  });

  return c.json(agent, 201);
});

/** Spawn an execution agent for an action */
agentRoutes.post("/agents/execute", async (c) => {
  const body = await c.req.json<{ actionId: string }>();
  const cwd = getCwd();
  const context = buildActionContext(cwd, body.actionId);
  const prompt = loadPrompt("05-execution");

  const agent = spawnAgent({
    type: "execution",
    prompt: `Execute ${body.actionId}`,
    context: `${context}\n\n---\n\n${prompt}`,
    cwd,
    execute: async (onOutput) => {
      // TODO: Replace with actual Claude Agent SDK call
      onOutput(`Starting execution of ${body.actionId}...\n`);
      await sleep(2000);
      onOutput("Reading existing code...\n");
      await sleep(1000);
      onOutput("Writing implementation...\n");
      await sleep(2000);
      onOutput("Done.\n");
      return `Action ${body.actionId} executed successfully.`;
    },
  });

  return c.json(agent, 201);
});

/** Spawn a verification agent for a milestone */
agentRoutes.post("/agents/verify", async (c) => {
  const body = await c.req.json<{ milestoneId: string }>();
  const cwd = getCwd();
  const prompt = loadPrompt("06-verification");

  const agent = spawnAgent({
    type: "verification",
    prompt: `Verify ${body.milestoneId}`,
    context: prompt,
    cwd,
    execute: async (onOutput) => {
      // TODO: Replace with actual Claude Agent SDK call
      onOutput(`Verifying milestone ${body.milestoneId}...\n`);
      await sleep(2000);
      onOutput("Checking evidence...\n");
      await sleep(1000);
      onOutput("Verdict: assessment complete.\n");
      return `Milestone ${body.milestoneId} verification complete.`;
    },
  });

  return c.json(agent, 201);
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export { agentRoutes };
