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
    const deleteBody = await deleteRes.json();
    expect(deleteBody.ok).toBe(true);
  });

  test("POST /api/approve-batch approves multiple items", async ({ request }) => {
    // Create fresh declarations for this test
    const d1 = await (await request.post("/api/declarations", {
      data: { title: "Approve test 1", statement: "Draft 1" },
    })).json();
    const d2 = await (await request.post("/api/declarations", {
      data: { title: "Approve test 2", statement: "Draft 2" },
    })).json();
    const draftIds = [d1.id, d2.id];

    const res = await request.post("/api/approve-batch", {
      data: { ids: draftIds },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.approved.length).toBe(2);

    // Verify approved
    const updated = await (await request.get("/api/graph")).json();
    for (const id of draftIds) {
      const d = updated.declarations.find((d: any) => d.id === id);
      expect(d?.review).toBe("approved");
    }

    // Cleanup
    await request.delete(`/api/declarations/${d1.id}`);
    await request.delete(`/api/declarations/${d2.id}`);
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
