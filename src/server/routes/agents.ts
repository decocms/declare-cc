import { Hono } from "hono";
import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import {
  getAgents,
  getAgent,
  spawnAgent,
  buildActionContext,
  loadPrompt,
} from "../../agents/runner";
import { generate, generateWave } from "../../agents/claude";
import { extractActions, extractTableRows } from "../../agents/parse";
import { broadcastEvent } from "../sse";
import { writePlanFile, type PlanMeta } from "../../core/artifacts/plan";
import { parseMilestonesFile, writeMilestonesFile } from "../../core/artifacts/milestones";

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
  const systemPrompt = loadPrompt("03-milestones");

  // Load current graph for context
  const { buildGraphFromDisk } = await import("../../core/graph");
  const graph = buildGraphFromDisk(cwd);
  const declaration = graph.declarations.find((d) => d.id === body.declarationId);

  // Load current MILESTONES.md if it exists
  const msPath = resolve(cwd, ".planning", "MILESTONES.md");
  const currentMilestones = existsSync(msPath)
    ? readFileSync(msPath, "utf-8")
    : "(no milestones yet)";

  const agent = spawnAgent({
    type: "derivation",
    prompt: `Derive milestones for ${body.declarationId}`,
    context: `Declaration: ${body.declarationId}\n${declaration ? `Title: ${declaration.title}\nStatement: ${declaration.statement}` : ""}\nDirection: ${body.direction ?? "none"}`,
    cwd,
    execute: async (onOutput) => {
      try {
        onOutput("Analyzing declaration and deriving milestones...\n");

        const userPrompt = [
          `Derive milestones for this declaration:`,
          ``,
          `${body.declarationId}: ${declaration?.title ?? "Unknown"}`,
          `Statement: ${declaration?.statement ?? "N/A"}`,
          `Why: ${declaration?.why ?? "N/A"}`,
          ``,
          ...(body.direction ? [`Direction/focus: ${body.direction}`, ``] : []),
          `Current milestones in the project:`,
          currentMilestones,
          ``,
          `Generate 3-5 new milestones that realize ${body.declarationId}.`,
          `Return a markdown table with columns: | ID | Title | Description | Realizes |`,
          `Use the next available M-XX IDs (check existing milestones above to avoid conflicts).`,
        ].join("\n");

        const result = await generate({
          system: systemPrompt,
          prompt: userPrompt,
          onChunk: onOutput,
        });

        // Parse milestones from the response table and write to MILESTONES.md
        const rows = extractTableRows(result);
        if (rows.length > 0) {
          const planningDir = resolve(cwd, ".planning");
          const msFilePath = resolve(planningDir, "MILESTONES.md");
          const existing = existsSync(msFilePath)
            ? parseMilestonesFile(readFileSync(msFilePath, "utf-8"))
            : [];

          const projectName = (() => {
            const fp = resolve(planningDir, "FUTURE.md");
            if (!existsSync(fp)) return "Untitled";
            const m = readFileSync(fp, "utf-8").match(/^# Future:\s*(.+)/m);
            return m ? m[1].trim() : "Untitled";
          })();

          const newMilestones = rows
            .filter((r) => r["ID"]?.match(/^M-\d+$/))
            .map((r) => ({
              id: r["ID"],
              title: r["Title"] || "",
              description: r["Description"] || "",
              status: "PENDING",
              realizes: (r["Realizes"] || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              hasPlan: false,
              reviewState: "draft",
              classification: "agent",
              dependsOn: [] as string[],
            }));

          // Replace milestones for this declaration, keep others
          const targetDeclId = body.declarationId.toUpperCase();
          const kept = existing.filter(
            (m) => !m.realizes.includes(targetDeclId) || m.status === "DONE" || m.status === "KEPT" || m.status === "HONORED",
          );
          // Also skip new milestones whose IDs already exist in kept set
          const keptIds = new Set(kept.map((m) => m.id));
          const toAdd = newMilestones.filter((m) => !keptIds.has(m.id));
          const merged = [...kept, ...toAdd];

          if (!existsSync(planningDir)) mkdirSync(planningDir, { recursive: true });
          writeFileSync(msFilePath, writeMilestonesFile(merged, projectName), "utf-8");

          onOutput(`\n\nWrote ${toAdd.length} new milestones to MILESTONES.md\n`);
        } else {
          onOutput("\n\nWarning: Could not parse milestones from response.\n");
        }

        broadcastEvent("change", { reason: "derive", nodeId: body.declarationId });
        return result;
      } catch (err) {
        throw err;
      }
    },
  });

  return c.json(agent, 201);
});

/** Spawn an agent to plan actions for a milestone — writes PLAN.md */
agentRoutes.post("/agents/plan-actions", async (c) => {
  const body = await c.req.json<{ milestoneId: string }>();
  const cwd = getCwd();
  const mId = body.milestoneId.toUpperCase();
  const systemPrompt = loadPrompt("04-actions");

  // Find milestone info from graph
  const { buildGraphFromDisk } = await import("../../core/graph");
  const graph = buildGraphFromDisk(cwd);
  const milestone = graph.milestones.find((m) => m.id === mId);
  const title = milestone?.title ?? mId;

  // Build parent declaration context
  const parentDeclarations = milestone
    ? graph.declarations.filter((d) => milestone.realizes.includes(d.id))
    : [];

  const agent = spawnAgent({
    type: "derivation",
    prompt: `Plan actions for ${mId}`,
    context: `Milestone: ${mId} — ${title}`,
    cwd,
    execute: async (onOutput) => {
      try {
        onOutput(`Planning actions for ${mId}: ${title}...\n`);

        const declContext = parentDeclarations.length
          ? parentDeclarations
              .map((d) => `${d.id}: ${d.title}\n  Statement: ${d.statement}`)
              .join("\n\n")
          : "(no parent declarations found)";

        const userPrompt = [
          `Plan actions for this milestone:`,
          ``,
          `${mId}: ${title}`,
          `Description: ${milestone?.description ?? "N/A"}`,
          ``,
          `Parent declarations this milestone realizes:`,
          declContext,
          ``,
          `Generate concrete actions using the ### A-XX: Title format.`,
          `Each action should have:`,
          `- **Status:** PENDING`,
          `- **Files:** specific files to create/modify`,
          `- **Verify:** how to check the action is complete`,
          `- **Done:** what "done" looks like`,
          `- **Wave:** execution wave (1, 2, 3...)`,
          `- **Depends On:** other action IDs (if any)`,
          ``,
          `The last action should verify the milestone condition holds.`,
        ].join("\n");

        const result = await generate({
          system: systemPrompt,
          prompt: userPrompt,
          onChunk: onOutput,
        });

        // Parse actions from response and renumber to A-01, A-02, ...
        const rawActions = extractActions(result);
        const actions = rawActions.map((a, i) => ({
          ...a,
          id: `A-${String(i + 1).padStart(2, "0")}`,
          dependsOn: a.dependsOn.map((dep) => {
            // Remap dependency IDs if they were in the old format
            const depIdx = rawActions.findIndex((r) => r.id === dep);
            return depIdx >= 0 ? `A-${String(depIdx + 1).padStart(2, "0")}` : dep;
          }),
        }));

        if (actions.length > 0) {
          // Extract any meta from the response
          const planMeta: PlanMeta = {};
          const scMatch = result.match(/\*\*Success Criteria:\*\*\s*\n((?:[-*]\s+.+\n?)+)/i);
          if (scMatch) {
            planMeta.successCriteria = scMatch[1]
              .split("\n")
              .map((l) => l.replace(/^[-*]\s+/, "").trim())
              .filter(Boolean);
          }
          // Extract structured must-haves
          const truthsMatch = result.match(/\*\*Truths:\*\*\s*\n((?:[-*]\s+.+\n?)+)/i);
          if (truthsMatch) {
            planMeta.truths = truthsMatch[1].split("\n").map(l => l.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
          }
          const artifactsMatch = result.match(/\*\*Artifacts:\*\*\s*\n((?:[-*]\s+.+\n?)+)/i);
          if (artifactsMatch) {
            planMeta.artifacts = artifactsMatch[1].split("\n").map(l => l.replace(/^[-*]\s+/, "").trim()).filter(Boolean)
              .map(item => {
                const m = item.match(/^`([^`]+)`\s*[-—]\s*(.+)/);
                return m ? { path: m[1], provides: m[2].trim() } : { path: item, provides: "" };
              });
          }
          const keyLinksMatch = result.match(/\*\*Key Links:\*\*\s*\n((?:[-*]\s+.+\n?)+)/i);
          if (keyLinksMatch) {
            planMeta.keyLinks = keyLinksMatch[1].split("\n").map(l => l.replace(/^[-*]\s+/, "").trim()).filter(Boolean)
              .map(item => {
                const m = item.match(/from:\s*`?([^`>]+)`?\s*->\s*to:\s*`?([^`>]+)`?\s*->\s*via:\s*(.+)/i);
                return m ? { from: m[1].trim(), to: m[2].trim(), via: m[3].trim() } : { from: item, to: "", via: "" };
              });
          }

          // Write PLAN.md
          const planningDir = resolve(cwd, ".planning");
          const msDir = resolve(planningDir, "milestones");
          const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/-+$/, "")
            .slice(0, 40);
          const folderName = `${mId}-${slug}`;
          const folder = resolve(msDir, folderName);
          if (!existsSync(folder)) mkdirSync(folder, { recursive: true });

          const planContent = writePlanFile(actions, mId, title, planMeta);
          writeFileSync(resolve(folder, "PLAN.md"), planContent, "utf-8");

          onOutput(`\n\nWrote PLAN.md with ${actions.length} actions to ${folderName}/\n`);
          broadcastEvent("change", { reason: "plan-actions", nodeId: mId });
        }

        return result;
      } catch (err) {
        throw err;
      }
    },
  });

  return c.json(agent, 201);
});

/** Spawn an execution agent for an action */
agentRoutes.post("/agents/execute", async (c) => {
  const body = await c.req.json<{ actionId: string }>();
  const cwd = getCwd();
  const context = buildActionContext(cwd, body.actionId);
  const systemPrompt = loadPrompt("05-execution");

  const agent = spawnAgent({
    type: "execution",
    prompt: `Execute ${body.actionId}`,
    context: `${context}\n\n---\n\n${systemPrompt}`,
    cwd,
    execute: async (onOutput) => {
      try {
        onOutput(`Starting execution of ${body.actionId}...\n`);

        const result = await generate({
          system: systemPrompt,
          prompt: [
            `Execute the following action:`,
            ``,
            context,
            ``,
            `Follow the execution rules in your system prompt.`,
            `Report what you would do, what files you would create/modify, and any blockers.`,
          ].join("\n"),
          onChunk: onOutput,
        });

        broadcastEvent("change", { reason: "execute", nodeId: body.actionId });
        return result;
      } catch (err) {
        throw err;
      }
    },
  });

  return c.json(agent, 201);
});

/** Spawn a verification agent for a milestone */
agentRoutes.post("/agents/verify", async (c) => {
  const body = await c.req.json<{ milestoneId: string }>();
  const cwd = getCwd();
  const systemPrompt = loadPrompt("06-verification");

  const { buildGraphFromDisk } = await import("../../core/graph");
  const graph = buildGraphFromDisk(cwd);
  const milestone = graph.milestones.find((m) => m.id === body.milestoneId.toUpperCase());

  const agent = spawnAgent({
    type: "verification",
    prompt: `Verify ${body.milestoneId}`,
    context: `Milestone: ${body.milestoneId} — ${milestone?.title ?? "Unknown"}`,
    cwd,
    execute: async (onOutput) => {
      try {
        onOutput(`Verifying milestone ${body.milestoneId}...\n`);

        // Build context about milestone actions
        const msActions = graph.actions.filter(
          (a: any) => a.milestoneId === body.milestoneId.toUpperCase()
        );
        const actionSummary = msActions.length
          ? msActions
              .map((a) => `${a.id}: ${a.title} — ${a.status}`)
              .join("\n")
          : "(no actions found)";

        // Build must-haves context from plan meta
        const planMeta = milestone?.planMeta;
        const mustHavesContext: string[] = [];
        if (planMeta?.truths?.length) {
          mustHavesContext.push("**Must-Have Truths:**");
          for (const t of planMeta.truths) mustHavesContext.push(`- ${t}`);
          mustHavesContext.push("");
        }
        if (planMeta?.artifacts?.length) {
          mustHavesContext.push("**Must-Have Artifacts:**");
          for (const a of planMeta.artifacts) mustHavesContext.push(`- \`${a.path}\` — ${a.provides}`);
          mustHavesContext.push("");
        }
        if (planMeta?.keyLinks?.length) {
          mustHavesContext.push("**Must-Have Key Links:**");
          for (const k of planMeta.keyLinks) mustHavesContext.push(`- from: \`${k.from}\` -> to: \`${k.to}\` -> via: ${k.via}`);
          mustHavesContext.push("");
        }

        const result = await generate({
          system: systemPrompt,
          prompt: [
            `Verify this milestone:`,
            ``,
            `${body.milestoneId}: ${milestone?.title ?? "Unknown"}`,
            `Description: ${milestone?.description ?? "N/A"}`,
            `Status: ${milestone?.status ?? "N/A"}`,
            ``,
            `Actions for this milestone:`,
            actionSummary,
            ``,
            ...(mustHavesContext.length ? [`## Must-Haves to Verify`, ``, ...mustHavesContext] : []),
            `Check if the milestone condition is actually true.`,
            `Use the verification report format from your system prompt.`,
            `Use tools to read files, run commands, and verify artifacts.`,
          ].join("\n"),
          onChunk: onOutput,
          withTools: true,
          maxTurns: 10,
          cwd,
        });

        broadcastEvent("change", { reason: "verify", nodeId: body.milestoneId });
        return result;
      } catch (err) {
        throw err;
      }
    },
  });

  return c.json(agent, 201);
});

/** Execute actions by wave — groups actions by wave number, runs each wave concurrently */
agentRoutes.post("/agents/execute-waves", async (c) => {
  const body = await c.req.json<{ milestoneId: string }>();
  const cwd = getCwd();
  const { buildGraphFromDisk } = await import("../../core/graph");
  const graph = buildGraphFromDisk(cwd);
  const mId = body.milestoneId.toUpperCase();

  const msActions = graph.actions.filter((a: any) => a.milestoneId === mId);
  if (msActions.length === 0) {
    return c.json({ error: "No actions found for milestone" }, 404);
  }

  // Group by wave (default wave 1 if not set)
  const waves = new Map<number, typeof msActions>();
  for (const a of msActions) {
    const w = a.wave ?? 1;
    if (!waves.has(w)) waves.set(w, []);
    waves.get(w)!.push(a);
  }

  const sortedWaves = Array.from(waves.entries()).sort((a, b) => a[0] - b[0]);
  const agents: any[] = [];

  // Spawn a coordinator agent that runs waves sequentially
  const agent = spawnAgent({
    type: "execution",
    prompt: `Execute waves for ${mId}`,
    context: `Milestone: ${mId}\nWaves: ${sortedWaves.length}\nTotal actions: ${msActions.length}`,
    cwd,
    execute: async (onOutput) => {
      const systemPrompt = loadPrompt("05-execution");

      for (const [waveNum, waveActions] of sortedWaves) {
        onOutput(`\n--- Wave ${waveNum} (${waveActions.length} actions) ---\n`);

        const waveResults = await generateWave(
          waveActions.map((a) => {
            const ctx = buildActionContext(cwd, a.id);
            return {
              system: systemPrompt,
              prompt: [
                `Execute the following action:`,
                ``,
                ctx,
                ``,
                `Follow the execution rules in your system prompt.`,
                `Produce all specified artifacts. Stay in scope.`,
              ].join("\n"),
              withTools: true,
              maxTurns: 10,
              cwd,
            };
          })
        );

        for (let i = 0; i < waveActions.length; i++) {
          onOutput(`\n[${waveActions[i].id}] completed\n`);
          broadcastEvent("change", { reason: "execute", nodeId: waveActions[i].id });
        }
      }

      broadcastEvent("change", { reason: "execute-waves", nodeId: mId });
      return `Executed ${msActions.length} actions across ${sortedWaves.length} waves`;
    },
  });

  return c.json(agent, 201);
});

/** Spawn a research agent to explore the project codebase */
agentRoutes.post("/agents/research", async (c) => {
  const body = await c.req.json<{ projectPath?: string; focus?: string }>();
  const cwd = body.projectPath || getCwd();
  const systemPrompt = loadPrompt("00-research");
  const focus = body.focus || "general codebase overview";

  const agent = spawnAgent({
    type: "research",
    prompt: `Research: ${focus}`,
    context: `Project: ${cwd}\nFocus: ${focus}`,
    cwd,
    execute: async (onOutput) => {
      try {
        onOutput(`Researching codebase (focus: ${focus})...\n`);

        const userPrompt = [
          `Research the codebase at: ${cwd}`,
          ``,
          `Focus area: ${focus}`,
          ``,
          `Follow the research protocol in your system prompt.`,
          `Write your findings to ${resolve(cwd, ".planning", "RESEARCH.md")}`,
          `Use tools to explore — read files, search patterns, check structure.`,
        ].join("\n");

        const result = await generate({
          system: systemPrompt,
          prompt: userPrompt,
          onChunk: onOutput,
          withTools: true,
          maxTurns: 15,
          cwd,
        });

        broadcastEvent("change", { reason: "research" });
        return result;
      } catch (err) {
        throw err;
      }
    },
  });

  return c.json(agent, 201);
});

export { agentRoutes };
