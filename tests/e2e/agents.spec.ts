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

    // Wait for completion
    await new Promise((r) => setTimeout(r, 3000));

    const agentRes = await request.get(`/api/agents/${agent.id}`);
    const updated = await agentRes.json();
    expect(updated.status).toBe("completed");
    expect(updated.output).toContain("milestone");
  });

  test("POST /api/agents/verify spawns a verification agent", async ({ request }) => {
    const res = await request.post("/api/agents/verify", {
      data: { milestoneId: "M-01" },
    });
    expect(res.ok()).toBe(true);
    const agent = await res.json();
    expect(agent.type).toBe("verification");

    await new Promise((r) => setTimeout(r, 4000));

    const updated = await (await request.get(`/api/agents/${agent.id}`)).json();
    expect(updated.status).toBe("completed");
  });

  test("agents persist across queries", async ({ request }) => {
    // Agents from previous tests should still be listed
    const res = await request.get("/api/agents");
    const agents = await res.json();
    expect(agents.length).toBeGreaterThanOrEqual(2);
  });
});
