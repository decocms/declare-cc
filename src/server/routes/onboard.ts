import { Hono } from "hono";
import { generate } from "../../agents/claude";
import { loadPrompt } from "../../agents/runner";
import { extractJSON } from "../../agents/parse";

const onboardRoutes = new Hono();

/** Generate clarifying questions from the user's vision */
onboardRoutes.post("/onboard/questions", async (c) => {
  const { vision } = await c.req.json<{ vision: string }>();

  try {
    const systemPrompt = loadPrompt("01-vision");
    const result = await generate({
      system: systemPrompt,
      prompt: [
        "The user has provided the following project vision:",
        "",
        vision,
        "",
        "Generate 3-5 clarifying questions to sharpen this vision into concrete declarations.",
        "",
        "Output ONLY a JSON object:",
        '{ "questions": [{"question": "The question text", "context": "Why this matters for planning", "options": ["Option A", "Option B"]}] }',
        "",
        "The options array should contain 2-3 suggested answers that the user can click to select.",
        "Include options when there are clear alternatives to choose from.",
      ].join("\n"),
    });

    const parsed = extractJSON<{
      questions: { question: string; context?: string; options?: string[] }[];
    }>(result);
    return c.json({ questions: parsed.questions });
  } catch (err) {
    console.error("[onboard/questions]", err);
    return c.json({ error: String(err) }, 500);
  }
});

/** Generate declaration candidates from vision + Q&A */
onboardRoutes.post("/onboard/declarations", async (c) => {
  const { vision, questions, answers } = await c.req.json<{
    vision: string;
    questions?: { question: string; context?: string; options?: string[] }[];
    answers?: string[];
  }>();

  try {
    const systemPrompt = loadPrompt("02-declarations");

    const qaPairs =
      questions && answers
        ? questions
            .map((q, i) => `Q: ${q.question}\nA: ${answers[i] || "(no answer)"}`)
            .join("\n\n")
        : "";

    const result = await generate({
      system: systemPrompt,
      prompt: [
        "Project vision:",
        vision,
        "",
        ...(qaPairs ? ["Clarifying Q&A:", qaPairs, ""] : []),
        "Generate 3-7 declaration candidates based on this vision.",
        "Also generate a short project name (2-4 words) that captures the essence of this project.",
        'Return JSON: { "projectName": "Short Project Name", "candidates": [{ "title": "...", "statement": "...", "why": "..." }, ...] }',
      ].join("\n"),
    });

    const parsed = extractJSON<{
      projectName?: string;
      candidates: { title: string; statement: string; why: string }[];
    }>(result);
    return c.json({ projectName: parsed.projectName, candidates: parsed.candidates });
  } catch (err) {
    console.error("[onboard/declarations]", err);
    return c.json({ error: String(err) }, 500);
  }
});

export { onboardRoutes };
