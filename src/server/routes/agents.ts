import { Hono } from "hono";
import {
  getAgents,
  getAgent,
  spawnAgent,
  buildActionContext,
  loadPrompt,
} from "../../agents/runner";

const agentRoutes = new Hono();

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

/** Spawn a derivation agent (e.g., derive milestones for a declaration) */
agentRoutes.post("/agents/derive", async (c) => {
  const body = await c.req.json<{ declarationId: string; direction?: string }>();
  const cwd = process.env.DCL_PROJECT_ROOT || process.cwd();
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

/** Spawn an execution agent for an action */
agentRoutes.post("/agents/execute", async (c) => {
  const body = await c.req.json<{ actionId: string }>();
  const cwd = process.env.DCL_PROJECT_ROOT || process.cwd();
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
  const cwd = process.env.DCL_PROJECT_ROOT || process.cwd();
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
