import { useState } from "react";
import { NodeCard } from "../node-card";
import { useGraph } from "../../hooks/use-graph";
import { useQueryClient } from "@tanstack/react-query";

type Step = "vision" | "questions" | "candidates";

const STEP_LABELS: Record<Step, { num: number; title: string }> = {
  vision: { num: 1, title: "Vision" },
  questions: { num: 2, title: "Clarifying Questions" },
  candidates: { num: 3, title: "Declaration Candidates" },
};

// TODO: call agent runner to generate questions from vision
const PLACEHOLDER_QUESTIONS = [
  "Who are the primary users or stakeholders affected by this project?",
  "What does success look like in measurable terms?",
  "What is explicitly NOT in scope for this project?",
];

function generateCandidates(vision: string): { title: string; statement: string; why: string }[] {
  // TODO: call agent runner to generate declarations from vision + answers
  // For now, split the vision into simple declaration candidates
  const sentences = vision
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const base = sentences.length > 0 ? sentences : [vision.trim()];

  return base.slice(0, 3).map((s, i) => ({
    title: `Aspect ${i + 1}`,
    statement: s.endsWith(".") ? s : `${s}.`,
    why: "Derived from the project vision.",
  }));
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("vision");
  const [vision, setVision] = useState("");
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [candidates, setCandidates] = useState<{ title: string; statement: string; why: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const queryClient = useQueryClient();

  function goToQuestions() {
    setStep("questions");
  }

  function goToCandidates() {
    const generated = generateCandidates(vision);
    setCandidates(generated);
    setStep("candidates");
  }

  async function approveAll() {
    setSubmitting(true);
    try {
      for (const c of candidates) {
        await fetch("/api/declarations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    } finally {
      setSubmitting(false);
    }
  }

  const { num, title } = STEP_LABELS[step];

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-xl space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {(["vision", "questions", "candidates"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-border" />}
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  s === step
                    ? "bg-brand text-brand-foreground"
                    : STEP_LABELS[s].num < num
                      ? "bg-brand/20 text-brand"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {STEP_LABELS[s].num}
              </div>
              <span
                className={[
                  "text-xs font-medium",
                  s === step ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {STEP_LABELS[s].title}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === "vision" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              What is true when this project succeeds?
            </h2>
            <p className="text-sm text-muted-foreground">
              Describe the future state -- not what you will build, but what is different in the world.
            </p>
            <textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="When this project succeeds..."
              rows={6}
              className="w-full rounded-lg border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            <div className="flex justify-end">
              <button
                onClick={goToQuestions}
                disabled={vision.trim().length < 10}
                className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === "questions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              A few clarifying questions
            </h2>
            <p className="text-sm text-muted-foreground">
              These help sharpen your vision into concrete declarations.
            </p>
            {PLACEHOLDER_QUESTIONS.map((q, i) => (
              <div key={i} className="space-y-1">
                <label className="text-sm font-medium text-foreground">{q}</label>
                <input
                  type="text"
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  className="w-full rounded-lg border bg-card p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
            ))}
            <div className="flex justify-between">
              <button
                onClick={() => setStep("vision")}
                className="h-9 rounded-md border bg-card px-5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={goToCandidates}
                className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90 transition-opacity"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === "candidates" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Declaration candidates
            </h2>
            <p className="text-sm text-muted-foreground">
              Review these declarations derived from your vision. Approve to add them to your project.
            </p>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <NodeCard
                  key={i}
                  id={`D-${String(i + 1).padStart(2, "0")}`}
                  type="declaration"
                  title={c.title}
                  description={c.statement}
                  review="draft"
                />
              ))}
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => setStep("questions")}
                className="h-9 rounded-md border bg-card px-5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Back
              </button>
              <button
                onClick={approveAll}
                disabled={submitting}
                className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {submitting ? "Creating..." : `Approve All (${candidates.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
