import { Hono } from "hono";
import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { buildGraphFromDisk } from "../../core/graph";
import {
  parseFutureFile,
  writeFutureFile,
  parseMilestonesFile,
  writeMilestonesFile,
  parsePlanFile,
  writePlanFile,
} from "../../core/artifacts";
import type { Declaration } from "../../core/artifacts/future";
import type { Milestone } from "../../core/artifacts/milestones";
import { broadcastEvent } from "../sse";

const graphRoutes = new Hono();

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

// ── Read ──

graphRoutes.get("/graph", (c) => {
  try {
    const graph = buildGraphFromDisk(getCwd());
    return c.json(graph);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

graphRoutes.get("/status", (c) => {
  return c.json({ status: "ok", version: "2.0.0-alpha.0" });
});

// ── Declaration mutations ──

graphRoutes.post("/declarations", async (c) => {
  const body = await c.req.json<{ title: string; statement: string; why?: string }>();
  const dir = getPlanningDir();
  const fp = resolve(dir, "FUTURE.md");

  const content = existsSync(fp) ? readFileSync(fp, "utf-8") : "";
  const declarations = parseFutureFile(content);
  const projectName = getProjectName(dir);

  // Auto-assign next ID
  const maxNum = declarations.reduce((max, d) => {
    const n = parseInt(d.id.replace("D-", ""), 10);
    return n > max ? n : max;
  }, 0);
  const newId = `D-${String(maxNum + 1).padStart(2, "0")}`;

  const newDecl: Declaration = {
    id: newId,
    title: body.title,
    statement: body.statement,
    why: body.why ?? "",
    review: "draft",
  };
  declarations.push(newDecl);
  writeFileSync(fp, writeFutureFile(declarations, projectName), "utf-8");

  broadcastEvent("change", { reason: "add", nodeId: newId });
  return c.json(newDecl, 201);
});

graphRoutes.put("/declarations/:id", async (c) => {
  const id = c.req.param("id").toUpperCase();
  const body = await c.req.json<Partial<Declaration>>();
  const dir = getPlanningDir();
  const fp = resolve(dir, "FUTURE.md");

  if (!existsSync(fp)) return c.json({ error: "No FUTURE.md" }, 404);

  const content = readFileSync(fp, "utf-8");
  const declarations = parseFutureFile(content);
  const projectName = getProjectName(dir);
  const idx = declarations.findIndex((d) => d.id === id);
  if (idx === -1) return c.json({ error: `Not found: ${id}` }, 404);

  declarations[idx] = { ...declarations[idx], ...body, id };
  writeFileSync(fp, writeFutureFile(declarations, projectName), "utf-8");

  broadcastEvent("change", { reason: "update", nodeId: id });
  return c.json(declarations[idx]);
});

graphRoutes.delete("/declarations/:id", (c) => {
  const id = c.req.param("id").toUpperCase();
  const dir = getPlanningDir();
  const fp = resolve(dir, "FUTURE.md");

  if (!existsSync(fp)) return c.json({ error: "No FUTURE.md" }, 404);

  const content = readFileSync(fp, "utf-8");
  const declarations = parseFutureFile(content);
  const projectName = getProjectName(dir);
  const filtered = declarations.filter((d) => d.id !== id);
  if (filtered.length === declarations.length)
    return c.json({ error: `Not found: ${id}` }, 404);

  writeFileSync(fp, writeFutureFile(filtered, projectName), "utf-8");

  // Cascade: remove orphaned milestones
  const msPath = resolve(dir, "MILESTONES.md");
  if (existsSync(msPath)) {
    const msContent = readFileSync(msPath, "utf-8");
    const milestones = parseMilestonesFile(msContent);
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
      const msProjectName = getProjectName(dir);
      writeFileSync(msPath, writeMilestonesFile(surviving, msProjectName), "utf-8");
    }
  }

  broadcastEvent("change", { reason: "delete", nodeId: id });
  return c.json({ ok: true });
});

// ── Milestone mutations ──

graphRoutes.put("/milestones/:id", async (c) => {
  const id = c.req.param("id").toUpperCase();
  const body = await c.req.json<Partial<Milestone>>();
  const dir = getPlanningDir();
  const msPath = resolve(dir, "MILESTONES.md");

  if (!existsSync(msPath)) return c.json({ error: "No MILESTONES.md" }, 404);

  const milestones = parseMilestonesFile(readFileSync(msPath, "utf-8"));
  const projectName = getProjectName(dir);
  const idx = milestones.findIndex((m) => m.id === id);
  if (idx === -1) return c.json({ error: `Not found: ${id}` }, 404);

  milestones[idx] = { ...milestones[idx], ...body, id };
  writeFileSync(msPath, writeMilestonesFile(milestones, projectName), "utf-8");

  broadcastEvent("change", { reason: "update", nodeId: id });
  return c.json(milestones[idx]);
});

graphRoutes.delete("/milestones/:id", (c) => {
  const id = c.req.param("id").toUpperCase();
  const dir = getPlanningDir();
  const msPath = resolve(dir, "MILESTONES.md");

  if (!existsSync(msPath)) return c.json({ error: "No MILESTONES.md" }, 404);

  const milestones = parseMilestonesFile(readFileSync(msPath, "utf-8"));
  const projectName = getProjectName(dir);
  const filtered = milestones.filter((m) => m.id !== id);
  if (filtered.length === milestones.length)
    return c.json({ error: `Not found: ${id}` }, 404);

  writeFileSync(msPath, writeMilestonesFile(filtered, projectName), "utf-8");

  // Delete milestone folder
  const folder = findMilestoneFolder(dir, id);
  if (folder) rmSync(folder, { recursive: true, force: true });

  broadcastEvent("change", { reason: "delete", nodeId: id });
  return c.json({ ok: true });
});

// ── Batch approve ──

graphRoutes.post("/approve-batch", async (c) => {
  const body = await c.req.json<{ ids: string[] }>();
  const dir = getPlanningDir();
  const results: string[] = [];

  for (const rawId of body.ids) {
    const id = rawId.toUpperCase();
    const prefix = id.split("-")[0];

    if (prefix === "D") {
      const fp = resolve(dir, "FUTURE.md");
      if (!existsSync(fp)) continue;
      const declarations = parseFutureFile(readFileSync(fp, "utf-8"));
      const projectName = getProjectName(dir);
      const d = declarations.find((d) => d.id === id);
      if (d) {
        d.review = "approved";
        writeFileSync(fp, writeFutureFile(declarations, projectName), "utf-8");
        results.push(id);
      }
    } else if (prefix === "M") {
      const msPath = resolve(dir, "MILESTONES.md");
      if (!existsSync(msPath)) continue;
      const milestones = parseMilestonesFile(readFileSync(msPath, "utf-8"));
      const projectName = getProjectName(dir);
      const m = milestones.find((m) => m.id === id);
      if (m) {
        m.reviewState = "approved";
        writeFileSync(msPath, writeMilestonesFile(milestones, projectName), "utf-8");
        results.push(id);
      }
    }
  }

  broadcastEvent("change", { reason: "approve-batch", ids: results });
  return c.json({ approved: results });
});

// ── Helpers ──

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

function readdirSync(dir: string, opts: { withFileTypes: true }) {
  const fs = require("fs");
  return fs.readdirSync(dir, opts);
}

export { graphRoutes };
