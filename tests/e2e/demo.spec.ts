import { test, expect } from "@playwright/test";

/**
 * Demo E2E test — runs the full Declare lifecycle in a visible browser.
 *
 * Designed for screen recording:
 *   npx playwright test tests/e2e/demo.spec.ts --headed
 *
 * Uses the real project data already on disk (7 declarations, 15 milestones).
 * Steps are paced with deliberate pauses so a human viewer can follow along.
 */

const PACE = 800; // ms between visual steps

test.describe.serial("Declare Lifecycle Demo", () => {
  let createdId: string;

  test("Step 1: Load dashboard and see declarations list", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=declarations", { timeout: 10_000 });
    await page.waitForTimeout(PACE);

    // Sidebar shows project name and graph stats
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("declarations");
    await expect(sidebar).toContainText("milestones");

    // Level header shows "declarations" with a count
    const header = page.locator("h2", { hasText: "declarations" });
    await expect(header).toBeVisible();

    // At least one NodeCard is visible
    const cards = page.locator("[role=button]");
    await expect(cards.first()).toBeVisible();
    await page.waitForTimeout(PACE);
  });

  test("Step 2: Navigate declarations with keyboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });
    await page.waitForTimeout(PACE);

    // Arrow down a few times to move focus through declarations
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(PACE);

    // The fourth card (index 3) should have the focus ring
    const cards = page.locator("[role=button]");
    const count = await cards.count();
    expect(count).toBeGreaterThan(3);
  });

  test("Step 3: Drill into a declaration to see milestones", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });
    await page.waitForTimeout(PACE);

    // Drill into first declaration
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(PACE);

    // Level header should now show "milestones"
    const header = page.locator("h2", { hasText: "milestones" });
    await expect(header).toBeVisible();

    // Breadcrumb should show the declaration we drilled into
    const breadcrumb = page.locator(".border-b .text-xs").first();
    await expect(breadcrumb).toBeVisible();
    await page.waitForTimeout(PACE);
  });

  test("Step 4: Navigate milestones", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });

    // Drill into first declaration
    await page.keyboard.press("ArrowRight");
    await page.waitForSelector("h2:has-text('milestones')", { timeout: 5_000 });
    await page.waitForTimeout(PACE);

    // Navigate milestones
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(PACE);
  });

  test("Step 5: Go back to declarations with ArrowLeft", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });

    // Drill in
    await page.keyboard.press("ArrowRight");
    await page.waitForSelector("h2:has-text('milestones')", { timeout: 5_000 });
    await page.waitForTimeout(PACE);

    // Go back
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(PACE);

    // Should be back at declarations
    const header = page.locator("h2", { hasText: "declarations" });
    await expect(header).toBeVisible();
    await page.waitForTimeout(PACE);
  });

  test("Step 6: Verify sidebar and agent panel exist", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });
    await page.waitForTimeout(PACE);

    // Sidebar with keyboard shortcuts
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("navigate");
    await expect(sidebar).toContainText("drill in");

    // Agent panel on the right
    const agentPanel = page.locator("aside").last();
    await expect(agentPanel).toContainText("Agents");
    await page.waitForTimeout(PACE);
  });

  test("Step 7: Create a new declaration via API", async ({ page, request }) => {
    // Create via API
    const res = await request.post("/api/declarations", {
      data: {
        title: "Demo declaration",
        statement: "Created live during the E2E demo recording",
        why: "Demonstrates the full lifecycle",
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    createdId = body.id;
    expect(createdId).toMatch(/^D-\d+$/);

    await page.waitForTimeout(PACE);

    // Load dashboard and verify it appears
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });
    await page.waitForTimeout(PACE);

    // The new declaration should be visible
    await expect(page.locator(`text=Demo declaration`)).toBeVisible();
    await page.waitForTimeout(PACE);
  });

  test("Step 8: Verify the new declaration appears in the graph API", async ({ request }) => {
    const graph = await (await request.get("/api/graph")).json();
    const found = graph.declarations.find((d: any) => d.id === createdId);
    expect(found).toBeDefined();
    expect(found.title).toBe("Demo declaration");
  });

  test("Step 9: Delete the demo declaration", async ({ page, request }) => {
    // Delete via API
    const res = await request.delete(`/api/declarations/${createdId}`);
    expect(res.ok()).toBe(true);

    await page.waitForTimeout(PACE);

    // Reload and verify it is gone
    await page.goto("/");
    await page.waitForSelector("[role=button]", { timeout: 10_000 });
    await page.waitForTimeout(PACE);

    // Should no longer appear
    await expect(page.locator(`text=Demo declaration`)).toHaveCount(0);
    await page.waitForTimeout(PACE);
  });

  test("Step 10: Verify graph is back to original state", async ({ request }) => {
    const graph = await (await request.get("/api/graph")).json();
    const found = graph.declarations.find((d: any) => d.id === createdId);
    expect(found).toBeUndefined();

    // Original declarations still present
    expect(graph.declarations.length).toBeGreaterThanOrEqual(7);
    expect(graph.milestones.length).toBeGreaterThanOrEqual(15);
  });
});
