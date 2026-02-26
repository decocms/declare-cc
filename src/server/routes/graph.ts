import { Hono } from "hono";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

const graphRoutes = new Hono();

/** Resolve project root from query param or CWD */
function getProjectRoot(cwd?: string): string {
  return cwd || process.env.DCL_PROJECT_ROOT || process.cwd();
}

graphRoutes.get("/graph", (c) => {
  const cwd = getProjectRoot(c.req.query("cwd"));
  const planningDir = resolve(cwd, ".planning");

  if (!existsSync(planningDir)) {
    return c.json({
      declarations: [],
      milestones: [],
      actions: [],
      stats: { declarations: 0, milestones: 0, actions: 0 },
      projectName: "Untitled",
    });
  }

  // Load graph from disk using artifact parsers
  // This will be wired up properly once M-02 and M-03 are done
  try {
    const futurePath = resolve(planningDir, "FUTURE.md");
    const msPath = resolve(planningDir, "MILESTONES.md");

    let declarations: unknown[] = [];
    let milestones: unknown[] = [];
    let projectName = "Untitled";

    if (existsSync(futurePath)) {
      // Inline minimal parser until artifact parsers are ready
      const content = readFileSync(futurePath, "utf-8");
      const nameMatch = content.match(/^# Future:\s*(.+)/m);
      if (nameMatch) projectName = nameMatch[1].trim();

      const sections = content.split(/^## /m).slice(1);
      declarations = sections.map((s) => {
        const idMatch = s.match(/^(D-\d+):\s*(.+)/);
        const stmtMatch = s.match(/\*\*Statement:\*\*\s*(.+)/);
        return {
          id: idMatch?.[1] ?? "D-??",
          title: idMatch?.[2]?.trim() ?? "Untitled",
          statement: stmtMatch?.[1]?.trim() ?? "",
          status: "PENDING",
        };
      });
    }

    if (existsSync(msPath)) {
      const content = readFileSync(msPath, "utf-8");
      // Minimal table parser
      const lines = content.split("\n");
      const tableStart = lines.findIndex((l) => l.startsWith("| ID"));
      if (tableStart >= 0) {
        const dataLines = lines
          .slice(tableStart + 2)
          .filter((l) => l.startsWith("|"));
        milestones = dataLines.map((line) => {
          const cells = line
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean);
          return {
            id: cells[0] ?? "",
            title: cells[1] ?? "",
            description: cells[2] ?? "",
            status: cells[3] ?? "PENDING",
            realizes: (cells[4] ?? "")
              .split(",")
              .map((r: string) => r.trim())
              .filter(Boolean),
          };
        });
      }
    }

    return c.json({
      declarations,
      milestones,
      actions: [],
      stats: {
        declarations: declarations.length,
        milestones: milestones.length,
        actions: 0,
      },
      projectName,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

graphRoutes.get("/status", (c) => {
  return c.json({ status: "ok", version: "2.0.0-alpha.0" });
});

export { graphRoutes };
