import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Step = "vision" | "questions";

interface Question {
  question: string;
  context?: string;
  options?: string[];
}

const STEP_LABELS: Record<Step, { num: number; title: string }> = {
  vision: { num: 1, title: "Vision" },
  questions: { num: 2, title: "Clarifying Questions" },
};

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("vision");
  const [vision, setVision] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  async function goToQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboard/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate questions");
        return;
      }
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => ""));
      setStep("questions");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function selectOption(questionIndex: number, option: string) {
    const next = [...answers];
    const current = next[questionIndex];
    if (current.includes(option)) {
      next[questionIndex] = current
        .split(", ")
        .filter((s) => s !== option)
        .join(", ");
    } else {
      next[questionIndex] = current ? current + ", " + option : option;
    }
    setAnswers(next);
  }

  async function generateDeclarations() {
    setLoading(true);
    setError(null);
    try {
      // Generate declaration candidates from vision + Q&A
      const res = await fetch("/api/onboard/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vision, questions, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate declarations");
        return;
      }

      // Set project name if returned
      if (data.projectName) {
        await fetch("/api/project-name", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.projectName }),
        });
      }

      // Create each declaration directly
      for (const c of data.candidates) {
        await fetch("/api/declarations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c),
        });
      }

      // Refresh graph — the normal lifecycle view will show them
      queryClient.invalidateQueries({ queryKey: ["graph"] });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const { num } = STEP_LABELS[step];

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-8 py-12">
      <div className="w-full max-w-xl space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {(["vision", "questions"] as Step[]).map((s, i) => (
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

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

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
                disabled={vision.trim().length < 10 || loading}
                className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Generating questions..." : "Next"}
              </button>
            </div>
          </div>
        )}

        {step === "questions" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground">
              A few clarifying questions
            </h2>
            <p className="text-sm text-muted-foreground">
              These help sharpen your vision into concrete declarations.
            </p>
            {questions.map((q, i) => (
              <div key={i} className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {q.question}
                </label>
                {q.context && (
                  <p className="text-xs text-muted-foreground">{q.context}</p>
                )}
                {q.options && q.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt) => {
                      const isSelected = answers[i]?.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => selectOption(i, opt)}
                          className={[
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            isSelected
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                          ].join(" ")}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
                <textarea
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  rows={2}
                  placeholder="Type your answer or click a suggestion above..."
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
                onClick={generateDeclarations}
                disabled={loading}
                className="h-9 rounded-md bg-brand px-5 text-sm font-medium text-brand-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Generating declarations..." : "Generate Declarations"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
