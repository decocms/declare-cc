import { test, expect } from "@playwright/test";

/**
 * Phase 1 smoke tests — verify API and basic dashboard load.
 * These run against the Hono server directly (no React client needed yet).
 */

test.describe("Dashboard Smoke", () => {
  test("dashboard loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });

  test("dashboard renders main layout", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The page should have rendered something (not blank)
    const body = await page.locator("body").textContent();
    expect(body?.length).toBeGreaterThan(0);
  });
});

test.describe("API Smoke", () => {
  test("GET /api/graph returns valid graph structure", async ({ request }) => {
    const response = await request.get("/api/graph");
    expect(response.ok()).toBe(true);

    const graph = await response.json();
    expect(graph).toHaveProperty("declarations");
    expect(graph).toHaveProperty("milestones");
    expect(graph).toHaveProperty("actions");
    expect(graph).toHaveProperty("stats");
    expect(Array.isArray(graph.declarations)).toBe(true);
    expect(Array.isArray(graph.milestones)).toBe(true);
  });

  test("GET /api/status returns version", async ({ request }) => {
    const response = await request.get("/api/status");
    expect(response.ok()).toBe(true);

    const status = await response.json();
    expect(status.version).toMatch(/^2\./);
  });

  test("graph declarations have expected shape", async ({ request }) => {
    const response = await request.get("/api/graph");
    const graph = await response.json();

    if (graph.declarations.length > 0) {
      const d = graph.declarations[0];
      expect(d).toHaveProperty("id");
      expect(d).toHaveProperty("title");
      expect(d.id).toMatch(/^D-\d+$/);
    }
  });

  test("graph milestones have expected shape", async ({ request }) => {
    const response = await request.get("/api/graph");
    const graph = await response.json();

    if (graph.milestones.length > 0) {
      const m = graph.milestones[0];
      expect(m).toHaveProperty("id");
      expect(m).toHaveProperty("title");
      expect(m).toHaveProperty("realizes");
      expect(m.id).toMatch(/^M-\d+$/);
    }
  });

  test("stats match actual counts", async ({ request }) => {
    const response = await request.get("/api/graph");
    const graph = await response.json();

    expect(graph.stats.declarations).toBe(graph.declarations.length);
    expect(graph.stats.milestones).toBe(graph.milestones.length);
  });
});
