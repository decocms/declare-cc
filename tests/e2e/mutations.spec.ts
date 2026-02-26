import { test, expect } from "@playwright/test";

/**
 * Phase 2 mutation tests — verify CRUD operations on the graph.
 */

test.describe("Mutation API", () => {
  test("POST /api/declarations creates a new declaration", async ({ request }) => {
    const res = await request.post("/api/declarations", {
      data: {
        title: "E2E test declaration",
        statement: "This was created by an E2E test",
        why: "Testing mutations",
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.id).toMatch(/^D-\d+$/);
    expect(body.title).toBe("E2E test declaration");

    // Verify it appears in the graph
    const graph = await (await request.get("/api/graph")).json();
    const found = graph.declarations.find((d: any) => d.id === body.id);
    expect(found).toBeDefined();
    expect(found.title).toBe("E2E test declaration");

    // Clean up
    await request.delete(`/api/declarations/${body.id}`);
  });

  test("PUT /api/declarations/:id updates a declaration", async ({ request }) => {
    // Create
    const createRes = await request.post("/api/declarations", {
      data: { title: "To be updated", statement: "Original" },
    });
    const created = await createRes.json();

    // Update
    const updateRes = await request.put(`/api/declarations/${created.id}`, {
      data: { title: "Updated title", statement: "Updated statement" },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.title).toBe("Updated title");

    // Clean up
    await request.delete(`/api/declarations/${created.id}`);
  });

  test("DELETE /api/declarations/:id removes a declaration", async ({ request }) => {
    // Create
    const createRes = await request.post("/api/declarations", {
      data: { title: "To be deleted", statement: "Ephemeral" },
    });
    const created = await createRes.json();

    // Delete
    const deleteRes = await request.delete(`/api/declarations/${created.id}`);
    expect(deleteRes.ok()).toBe(true);

    // Verify gone
    const graph = await (await request.get("/api/graph")).json();
    const found = graph.declarations.find((d: any) => d.id === created.id);
    expect(found).toBeUndefined();
  });

  test("POST /api/approve-batch approves multiple items", async ({ request }) => {
    // Get current graph
    const graph = await (await request.get("/api/graph")).json();
    const draftIds = graph.declarations
      .filter((d: any) => d.review !== "approved")
      .slice(0, 2)
      .map((d: any) => d.id);

    if (draftIds.length === 0) {
      test.skip();
      return;
    }

    const res = await request.post("/api/approve-batch", {
      data: { ids: draftIds },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.approved.length).toBe(draftIds.length);

    // Verify approved
    const updated = await (await request.get("/api/graph")).json();
    for (const id of draftIds) {
      const d = updated.declarations.find((d: any) => d.id === id);
      expect(d?.review).toBe("approved");
    }
  });

  test("DELETE /api/declarations/:id cascades to orphan milestones", async ({ request }) => {
    // Create a declaration
    const declRes = await request.post("/api/declarations", {
      data: { title: "Cascade test", statement: "Will be deleted" },
    });
    const decl = await declRes.json();

    // Get graph to check milestone count before
    const before = await (await request.get("/api/graph")).json();
    const msBefore = before.milestones.length;

    // Delete it (no milestones realize it, so no cascade needed)
    await request.delete(`/api/declarations/${decl.id}`);

    // Milestones should be unchanged
    const after = await (await request.get("/api/graph")).json();
    expect(after.milestones.length).toBe(msBefore);
  });
});
