import { test, expect } from "@playwright/test";

/**
 * Full declaration lifecycle E2E test.
 *
 * This test IS the specification for Declare v2.0.
 * Every screen, every interaction, every state transition
 * must pass before any feature is considered complete.
 */

test.describe("Declaration Lifecycle", () => {
  test("smoke: dashboard loads without errors", async ({ page }) => {
    await page.goto("/");
    // No JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await expect(page.locator("body")).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("init: empty project shows onboarding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/describe your vision/i)).toBeVisible();
  });

  test("onboarding: vision → questions → declarations", async ({ page }) => {
    await page.goto("/");

    // Step 1: Enter vision
    const visionInput = page.getByPlaceholder(/what does success look like/i);
    await visionInput.fill(
      "A CLI tool that converts markdown files to PDF with custom styling"
    );
    await page.getByRole("button", { name: /next|continue/i }).click();

    // Step 2: AI generates questions, user answers
    await expect(page.getByText(/question/i)).toBeVisible({ timeout: 30_000 });
    // Answer first question (whatever it is)
    const answerInput = page.getByRole("textbox").first();
    await answerInput.fill("Support GitHub-flavored markdown and custom CSS");
    await page.getByRole("button", { name: /next|continue/i }).click();

    // Step 3: AI generates declaration candidates
    await expect(page.getByText(/proposed declarations/i)).toBeVisible({
      timeout: 30_000,
    });

    // Approve all declarations
    await page.getByRole("button", { name: /approve all/i }).click();

    // Should now show declarations in lifecycle view
    await expect(page.getByText(/D-01/)).toBeVisible();
  });

  test("lifecycle: declarations → milestones → actions", async ({ page }) => {
    // Assumes declarations already exist (from previous test or fixture)
    await page.goto("/");

    // Click first declaration to drill in
    await page.getByText(/D-01/).click();

    // Derive milestones
    await page.getByRole("button", { name: /plan milestones/i }).click();
    await expect(page.getByText(/M-01/)).toBeVisible({ timeout: 60_000 });

    // Approve milestones
    await page.getByRole("button", { name: /approve all/i }).click();

    // Click first milestone to drill in
    await page.getByText(/M-01/).click();

    // Plan actions
    await page.getByRole("button", { name: /plan actions/i }).click();
    await expect(page.getByText(/A-01/)).toBeVisible({ timeout: 60_000 });

    // Approve actions
    await page.getByRole("button", { name: /approve all/i }).click();
  });

  test("execution: run action and verify completion", async ({ page }) => {
    await page.goto("/");

    // Navigate to first action
    await page.getByText(/D-01/).click();
    await page.getByText(/M-01/).click();
    await page.getByText(/A-01/).click();

    // Execute
    await page.getByRole("button", { name: /execute/i }).click();

    // Should show agent running
    await expect(page.getByText(/running/i)).toBeVisible({ timeout: 10_000 });

    // Wait for completion
    await expect(page.getByText(/complete|done/i)).toBeVisible({
      timeout: 120_000,
    });
  });

  test("agents: panel shows running and completed agents", async ({
    page,
  }) => {
    await page.goto("/");

    // Open agent panel
    await page.getByRole("button", { name: /agents/i }).click();

    // Should show agent history
    await expect(
      page.getByText(/completed|running|no agents/i)
    ).toBeVisible();
  });

  test("graph: wholeness computes correctly after execution", async ({
    page,
  }) => {
    // Verify via API
    const response = await page.request.get("/api/graph");
    const graph = await response.json();

    expect(graph.declarations).toBeDefined();
    expect(graph.milestones).toBeDefined();
    expect(graph.actions).toBeDefined();
    expect(graph.stats).toBeDefined();

    // Wholeness should be computed
    for (const d of graph.declarations) {
      expect(["whole", "partial", "broken", "pending"]).toContain(
        d.wholeness || "pending"
      );
    }
  });
});
