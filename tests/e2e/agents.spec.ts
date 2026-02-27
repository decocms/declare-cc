import { test, expect } from "@playwright/test";

test.describe.serial("Agent API", () => {
  test("GET /api/agents returns array", async ({ request }) => {
    const res = await request.get("/api/agents");
    expect(res.ok()).toBe(true);
    const agents = await res.json();
    expect(Array.isArray(agents)).toBe(true);
  });

  test("POST /api/agents/derive spawns a derivation agent", async ({ request }) => {
    const res = await request.post("/api/agents/derive", {
      data: { declarationId: "D-01" },
    });
    expect(res.ok()).toBe(true);
    const agent = await res.json();
    expect(agent.id).toBeDefined();
    expect(agent.type).toBe("derivation");
    expect(agent.status).toBe("running");
  });

  test("POST /api/agents/verify spawns a verification agent", async ({ request }) => {
    const res = await request.post("/api/agents/verify", {
      data: { milestoneId: "M-01" },
    });
    expect(res.ok()).toBe(true);
    const agent = await res.json();
    expect(agent.type).toBe("verification");
    expect(agent.status).toBe("running");
  });

  test("agents persist across queries", async ({ request }) => {
    // Agents from previous tests should still be listed
    const res = await request.get("/api/agents");
    const agents = await res.json();
    expect(agents.length).toBeGreaterThanOrEqual(2);
  });
});
