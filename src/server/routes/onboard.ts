import { Hono } from "hono";

// TODO: replace with agent-driven generation

const onboardRoutes = new Hono();

onboardRoutes.post("/onboard/declarations", async (c) => {
  const { vision, answers } = await c.req.json<{ vision: string; answers: string[] }>();

  // Split vision into sentence-like chunks to create declaration candidates
  const sentences = vision
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const base = sentences.length > 0 ? sentences : [vision.trim()];

  const candidates = base.slice(0, 3).map((s, i) => ({
    title: `Aspect ${i + 1}`,
    statement: s.endsWith(".") ? s : `${s}.`,
    why: "Derived from the project vision.",
  }));

  return c.json({ candidates });
});

export { onboardRoutes };
