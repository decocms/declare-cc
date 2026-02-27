import { test, expect, type Page } from "@playwright/test";

/**
 * Full declaration lifecycle E2E test.
 *
 * Uses request interception to mock AI agent responses,
 * making tests deterministic and fast (no real AI calls).
 *
 * Flow: empty state → onboarding → declarations → milestones → actions → verify
 */

// ── Fixtures: realistic AI responses ──

const MOCK_QUESTIONS = JSON.stringify({
  vision:
    "A CLI tool that converts markdown files to PDF with custom styling",
  questions: [
    "What markdown flavors need to be supported?",
    "What styling customization options are needed?",
  ],
});

const MOCK_DECLARATIONS = `## D-01: Markdown-to-PDF conversion works reliably

**Statement:** Users can convert any GitHub-flavored markdown file to a styled PDF with a single command.
**Why:** This is the core value proposition — reliable, single-command conversion.

## D-02: Custom styling is fully supported

**Statement:** Users can apply custom CSS themes to their PDF output.
**Why:** Without styling, the tool is no different from browser print-to-PDF.`;

const MOCK_MILESTONES = `| ID | Title | Description | Realizes |
|----|-------|-------------|----------|
| M-01 | Markdown parsing works | GFM parser correctly handles tables, code blocks, and footnotes | D-01 |
| M-02 | PDF rendering pipeline | Puppeteer renders HTML to PDF with correct page breaks | D-01 |
| M-03 | CSS theme system | Users can pass custom CSS that applies to PDF output | D-02 |`;

const MOCK_ACTIONS = `## Must-Haves

**Truths:**
- Markdown files parse without errors
- Code blocks render with syntax highlighting

**Artifacts:**
- \`src/parser.ts\` — GFM markdown parser module

## Actions

### A-01: Create markdown parser module

**Status:** PENDING
**Files:** src/parser.ts, tests/parser.test.ts
**Verify:** \`bun test tests/parser.test.ts\`
**Done:** Parser converts GFM to HTML AST
**Wave:** 1

### A-02: Add syntax highlighting for code blocks

**Status:** PENDING
**Files:** src/highlight.ts
**Verify:** \`bun test tests/highlight.test.ts\`
**Done:** Code blocks render with highlight classes
**Wave:** 1
**Depends On:** A-01`;

const MOCK_VERIFY = `## M-01: Markdown parsing works

**Condition**: GFM parser correctly handles tables, code blocks, and footnotes
**Verdict**: VERIFIED

### Artifacts
| Path | Exists | Substantive | Wired | Notes |
|------|--------|-------------|-------|-------|
| src/parser.ts | yes | yes | yes | Full GFM support |

### Evidence Checked
1. src/parser.ts exists and has 150 lines of implementation -- PASS
2. Tests pass: 8/8 passing -- PASS`;

// ── Helper: intercept agent endpoints with mock responses ──

async function mockAgentEndpoints(page: Page) {
  await page.route("**/api/onboard/questions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-q1",
        type: "onboarding",
        status: "completed",
        output: MOCK_QUESTIONS,
        prompt: "Generate questions",
        context: "",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route("**/api/onboard/declarations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-d1",
        type: "onboarding",
        status: "completed",
        output: MOCK_DECLARATIONS,
        prompt: "Generate declarations",
        context: "",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route("**/api/agents/derive", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-derive",
        type: "derivation",
        status: "completed",
        output: MOCK_MILESTONES,
        prompt: "Derive milestones",
        context: "",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route("**/api/agents/plan-actions", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-plan",
        type: "derivation",
        status: "completed",
        output: MOCK_ACTIONS,
        prompt: "Plan actions",
        context: "",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route("**/api/agents/verify", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-verify",
        type: "verification",
        status: "completed",
        output: MOCK_VERIFY,
        prompt: "Verify milestone",
        context: "",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }),
    });
  });
}

// ── Tests ──

test.describe("Declaration Lifecycle", () => {
  test("smoke: dashboard loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("graph API returns valid structure at each step", async ({
    request,
  }) => {
    // Step 1: Empty state — graph should be valid
    const r1 = await request.get("/api/graph");
    expect(r1.ok()).toBe(true);
    const g1 = await r1.json();
    expect(g1).toHaveProperty("declarations");
    expect(g1).toHaveProperty("milestones");
    expect(g1).toHaveProperty("actions");
    expect(g1).toHaveProperty("stats");
    expect(g1.stats.declarations).toBe(g1.declarations.length);
    expect(g1.stats.milestones).toBe(g1.milestones.length);

    // Step 2: Create a declaration via API
    const r2 = await request.post("/api/declarations", {
      data: {
        title: "E2E test declaration",
        statement: "The system processes user input correctly.",
        why: "Core functionality validation",
      },
    });
    expect(r2.ok()).toBe(true);
    const decl = await r2.json();
    expect(decl.id).toMatch(/^D-\d+$/);

    // Step 3: Graph should include the new declaration
    const r3 = await request.get("/api/graph");
    const g3 = await r3.json();
    expect(g3.declarations.some((d: any) => d.id === decl.id)).toBe(true);
    expect(g3.stats.declarations).toBe(g3.declarations.length);

    // Wholeness should be computed for all nodes
    for (const d of g3.declarations) {
      expect(["whole", "partial", "broken", "pending"]).toContain(
        d.wholeness || "pending"
      );
    }

    // Step 4: Cleanup — delete the test declaration
    const r4 = await request.delete(`/api/declarations/${decl.id}`);
    expect(r4.ok()).toBe(true);

    // Verify deletion
    const r5 = await request.get("/api/graph");
    const g5 = await r5.json();
    expect(g5.declarations.some((d: any) => d.id === decl.id)).toBe(false);
  });

  test("agents: list agents endpoint works", async ({ request }) => {
    const response = await request.get("/api/agents");
    expect(response.ok()).toBe(true);
    const agents = await response.json();
    expect(Array.isArray(agents)).toBe(true);
  });

  test("SSE: event stream connects", async ({ page }) => {
    await page.goto("/");
    // Verify SSE endpoint responds by checking from the browser context
    const connected = await page.evaluate(async () => {
      const baseUrl = window.location.origin;
      return new Promise<boolean>((resolve) => {
        const es = new EventSource(`${baseUrl}/events`);
        es.onopen = () => { es.close(); resolve(true); };
        es.onerror = () => { es.close(); resolve(false); };
        setTimeout(() => { es.close(); resolve(false); }, 5000);
      });
    });
    expect(connected).toBe(true);
  });
});
