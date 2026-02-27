/**
 * Build the full graph from disk (.planning/ directory).
 * Ties together artifact parsers + DAG engine.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { DeclareDag } from "./dag";
import { parseFutureFile } from "./artifacts/future";
import { parseMilestonesFile } from "./artifacts/milestones";
import { parsePlanFile } from "./artifacts/plan";
import type { Declaration } from "./artifacts/future";
import type { Milestone } from "./artifacts/milestones";
import type { Action, PlanMeta } from "./artifacts/plan";

export interface GraphData {
  declarations: (Declaration & { wholeness?: string })[];
  milestones: (Milestone & { wholeness?: string; actions?: Action[]; planMeta?: PlanMeta })[];
  actions: (Action & { milestoneId?: string; wholeness?: string })[];
  stats: { declarations: number; milestones: number; actions: number };
  projectName: string;
  validation: { errors: string[] };
}

export function buildGraphFromDisk(cwd: string): GraphData {
  const planningDir = resolve(cwd, ".planning");
  const empty: GraphData = {
    declarations: [],
    milestones: [],
    actions: [],
    stats: { declarations: 0, milestones: 0, actions: 0 },
    projectName: "Untitled",
    validation: { errors: [] },
  };

  if (!existsSync(planningDir)) return empty;

  // Parse declarations
  const futurePath = resolve(planningDir, "FUTURE.md");
  let declarations: Declaration[] = [];
  let projectName = "Untitled";
  if (existsSync(futurePath)) {
    const content = readFileSync(futurePath, "utf-8");
    const nameMatch = content.match(/^# Future:\s*(.+)/m);
    if (nameMatch) projectName = nameMatch[1].trim();
    declarations = parseFutureFile(content);
  }

  // Parse milestones
  const msPath = resolve(planningDir, "MILESTONES.md");
  let milestones: Milestone[] = [];
  if (existsSync(msPath)) {
    milestones = parseMilestonesFile(readFileSync(msPath, "utf-8"));
  }

  // Parse actions from milestone folders
  let globalActionCounter = 0;
  const allActions: (Action & { milestoneId: string; localId?: string })[] = [];
  const planMetaMap = new Map<string, PlanMeta>();
  const milestonesDir = resolve(planningDir, "milestones");
  if (existsSync(milestonesDir)) {
    for (const entry of readdirSync(milestonesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mId = entry.name.match(/^(M-\d+)/)?.[1];
      if (!mId) continue;
      const planPath = join(milestonesDir, entry.name, "PLAN.md");
      if (existsSync(planPath)) {
        const { actions, meta } = parsePlanFile(readFileSync(planPath, "utf-8"));
        if (meta.successCriteria?.length || meta.mustHaves?.length) {
          planMetaMap.set(mId, meta);
        }
        // Assign globally unique action IDs (A-01, A-02, ... continuing from previous)
        for (const a of actions) {
          globalActionCounter++;
          const globalId = `A-${String(globalActionCounter).padStart(2, "0")}`;
          allActions.push({
            ...a,
            id: globalId,
            localId: a.id, // preserve original for display
            milestoneId: mId,
          });
        }
      }
    }
  }

  // Build DAG and compute wholeness
  const dag = new DeclareDag();
  for (const d of declarations) {
    dag.addNode(d.id, "declaration", d.title, "PENDING");
  }
  for (const m of milestones) {
    dag.addNode(m.id, "milestone", m.title, (m.status || "PENDING") as import("./dag").NodeStatus);
    for (const dId of m.realizes) {
      try {
        dag.addEdge(m.id, dId);
      } catch {}
    }
  }
  for (const a of allActions) {
    dag.addNode(a.id, "action", a.title, (a.status || "PENDING") as import("./dag").NodeStatus);
    try {
      dag.addEdge(a.id, a.milestoneId);
    } catch {}
  }

  const wholeness = dag.computeWholeness();
  const validation = dag.validate();

  return {
    declarations: declarations.map((d) => ({
      ...d,
      wholeness: wholeness.get(d.id) ?? "pending",
    })),
    milestones: milestones.map((m) => ({
      ...m,
      wholeness: wholeness.get(m.id) ?? "pending",
      actions: allActions.filter((a) => a.milestoneId === m.id),
      ...(planMetaMap.has(m.id) ? { planMeta: planMetaMap.get(m.id) } : {}),
    })),
    actions: allActions.map((a) => ({
      ...a,
      wholeness: wholeness.get(a.id) ?? "pending",
    })),
    stats: {
      declarations: declarations.length,
      milestones: milestones.length,
      actions: allActions.length,
    },
    projectName,
    validation: {
      errors: validation.errors.map((e) => `${e.node ?? "unknown"}: ${e.message}`),
    },
  };
}
