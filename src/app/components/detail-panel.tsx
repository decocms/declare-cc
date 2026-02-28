import { memo, useMemo } from "react";
import { useSpawnAgent, useAgents } from "../hooks/use-agents";
import { parseVerificationReport } from "../../agents/parse";

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  review?: string;
  files?: string[];
  verify?: string;
  done?: string;
  wave?: number;
  produces?: string;
  dependsOn?: string[];
}

interface MilestoneItem {
  id: string;
  title: string;
  status: string;
  review?: string;
  actionCount: number;
}

interface DetailPanelProps {
  isRunning?: boolean;
  onDrillToMilestone?: (declarationId: string, milestoneId: string) => void;
  item: {
    id: string;
    nodeType: "declaration" | "milestone" | "action";
    title: string;
    description?: string;
    status?: string;
    review?: string;
    // Declaration-specific
    statement?: string;
    why?: string;
    milestones?: MilestoneItem[];
    // Milestone-specific
    realizes?: string[];
    milestoneCount?: number;
    actionCount?: number;
    actions?: ActionItem[];
    successCriteria?: string[];
    mustHaves?: string[];
  } | null;
}

export const DetailPanel = memo(function DetailPanel({ item, isRunning, onDrillToMilestone }: DetailPanelProps) {
  const spawnAgent = useSpawnAgent();
  const { data: agents = [] } = useAgents();

  // Find latest verification verdict for milestones
  const verificationVerdict = useMemo(() => {
    if (!item || item.nodeType !== "milestone") return null;
    const verifyAgents = agents
      .filter((a) => a.type === "verification" && a.status === "completed" && a.prompt.includes(item.id))
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    if (verifyAgents.length === 0) return null;
    const report = parseVerificationReport(verifyAgents[0].output);
    return report?.verdict ?? null;
  }, [item, agents]);

  if (!item) {
    return (
      <aside className="flex-1 border-l p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">Details</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Click a node to see details.
        </p>
      </aside>
    );
  }

  const typeLabel =
    item.nodeType === "declaration" ? "Declaration" :
    item.nodeType === "milestone" ? "Milestone" : "Action";

  const colorVar =
    item.nodeType === "declaration" ? "--color-node-decl" :
    item.nodeType === "milestone" ? "--color-node-mile" : "--color-node-act";

  // Group actions by wave if any have wave numbers
  const hasWaves = item.actions?.some(a => a.wave !== undefined) ?? false;
  const waveGroups = hasWaves ? groupByWave(item.actions ?? []) : null;

  return (
    <aside className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <p style={{ color: `var(${colorVar})` }} className="text-[10px] font-medium uppercase tracking-wider">
            {typeLabel}
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.id}</p>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            {verificationVerdict && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  verificationVerdict === "VERIFIED"
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {verificationVerdict === "VERIFIED" ? "✓ Verified" : "✗ Gaps"}
              </span>
            )}
          </div>
        </div>

        {/* Statement (declarations) */}
        {item.statement && (
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Statement</p>
            <p className="text-[15px] leading-relaxed text-foreground/80">{item.statement}</p>
          </div>
        )}

        {/* Description (milestones, actions) */}
        {item.description && !item.statement && (
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Description</p>
            <p className="text-[15px] leading-relaxed text-foreground/80">{item.description}</p>
          </div>
        )}

        {/* Why (declarations) */}
        {item.why && (
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Why</p>
            <p className="text-sm text-muted-foreground italic">{item.why}</p>
          </div>
        )}

        {/* Realizes (milestones) */}
        {item.realizes && item.realizes.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Realizes</p>
            <div className="flex flex-wrap gap-1">
              {item.realizes.map((r) => (
                <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-node-decl-bg text-node-decl font-mono">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status + Review */}
        <div className="flex items-center gap-2">
          {item.status && (
            <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {item.status}
            </span>
          )}
          {item.review && item.review !== "draft" && (
            <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${
              item.review === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}>
              {item.review}
            </span>
          )}
        </div>

        {/* Inline Milestone List (declarations only) */}
        {item.nodeType === "declaration" && item.milestones && item.milestones.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Milestones <span className="text-muted-foreground/60">{item.milestones.length}</span>
            </p>
            <ol className="space-y-1">
              {item.milestones.map((m, i) => {
                const isDone = m.status === "DONE" || m.status === "KEPT" || m.status === "HONORED";
                const isApproved = m.review === "approved";
                const icon = isDone ? "✓" : isApproved ? "○" : "·";
                return (
                  <li
                    key={m.id}
                    onClick={() => onDrillToMilestone?.(item.id, m.id)}
                    className={`flex items-baseline gap-2 text-xs px-1.5 py-1.5 rounded transition-colors hover:bg-muted/50 ${
                      onDrillToMilestone ? "cursor-pointer" : ""
                    } ${isDone ? "text-muted-foreground line-through" : ""}`}
                  >
                    <span className="text-[10px] text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                    <span className={`w-3 text-center shrink-0 ${
                      isDone ? "text-success" : isApproved ? "text-node-mile" : "text-muted-foreground"
                    }`}>
                      {icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-medium">{m.title}</span>
                      {m.actionCount > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1.5">{m.actionCount} actions</span>
                      )}
                    </span>
                    <span className="text-[9px] font-semibold uppercase text-muted-foreground shrink-0">
                      {m.status}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {item.nodeType === "declaration" && (!item.milestones || item.milestones.length === 0) && item.milestoneCount !== undefined && (
          <p className="text-xs text-muted-foreground">
            {item.milestoneCount} milestone{item.milestoneCount !== 1 ? "s" : ""}
          </p>
        )}

        {/* Success Criteria (milestones with plan meta) */}
        {item.successCriteria && item.successCriteria.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Success Criteria
            </p>
            <ul className="space-y-0.5">
              {item.successCriteria.map((c, i) => (
                <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                  <span className="text-muted-foreground shrink-0">☐</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Must Haves (milestones with plan meta) */}
        {item.mustHaves && item.mustHaves.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Must Haves
            </p>
            <ul className="space-y-0.5">
              {item.mustHaves.map((m, i) => (
                <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inline Action Plan (milestones only — skip for DONE milestones without plans) */}
        {item.nodeType === "milestone" && (() => {
          const isDone = item.status === "DONE" || item.status === "KEPT" || item.status === "HONORED";
          const hasActions = (item.actions?.length ?? 0) > 0;

          // DONE milestones with no actions were completed outside the pipeline — nothing to show
          if (isDone && !hasActions) return null;

          return (
            <div className="border-t pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Action Plan
              </p>
              {hasActions ? (
                waveGroups ? (
                  <div className="space-y-3">
                    {waveGroups.map(({ wave, actions }) => (
                      <div key={wave}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="flex-1 border-t border-dashed border-muted-foreground/30" />
                          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Wave {wave}
                          </span>
                          <span className="flex-1 border-t border-dashed border-muted-foreground/30" />
                        </div>
                        <ol className="space-y-1">
                          {actions.map((a, i) => renderActionItem(a, i))}
                        </ol>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ol className="space-y-1">
                    {item.actions!.map((a, i) => renderActionItem(a, i))}
                  </ol>
                )
              ) : isRunning ? (
                <p className="text-xs text-muted-foreground italic">Planning...</p>
              ) : item.review === "approved" ? (
                <button
                  onClick={() => spawnAgent.mutate({ endpoint: "plan-actions", body: { milestoneId: item.id } })}
                  disabled={spawnAgent.isPending}
                  className="w-full h-8 text-xs font-medium rounded-md bg-node-mile-bg text-node-mile border border-node-mile/20 hover:brightness-90 transition-colors disabled:opacity-50"
                >
                  Plan Actions
                </button>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Action plan generates on approve
                </p>
              )}
            </div>
          );
        })()}

        {/* Agent actions */}
        <div className="border-t pt-3 space-y-2">
          {isRunning && item.status !== "DONE" && item.status !== "KEPT" && item.status !== "HONORED" && (
            <div className="flex items-center gap-2 text-xs text-warning animate-pulse">
              <span className="h-2 w-2 rounded-full bg-warning" />
              Agent running...
            </div>
          )}
          {item.nodeType === "milestone" && (item.actions?.length ?? 0) > 0 && (
            <>
              <button
                onClick={() => spawnAgent.mutate({ endpoint: "execute", body: { milestoneId: item.id } })}
                disabled={spawnAgent.isPending || isRunning}
                className="w-full h-8 text-xs font-medium rounded-md bg-node-act-bg text-node-act border border-node-act/20 hover:brightness-90 transition-colors disabled:opacity-50"
              >
                {isRunning ? "Running..." : "Execute"}
              </button>
              <button
                onClick={() => spawnAgent.mutate({ endpoint: "verify", body: { milestoneId: item.id } })}
                disabled={spawnAgent.isPending || isRunning}
                className="w-full h-8 text-xs font-medium rounded-md bg-node-decl-bg text-node-decl border border-node-decl/20 hover:brightness-90 transition-colors disabled:opacity-50"
              >
                {isRunning ? "Running..." : "Verify"}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
});

function renderActionItem(a: ActionItem, i: number) {
  const isDone = a.status === "DONE" || a.status === "KEPT" || a.status === "HONORED";
  const isApproved = a.review === "approved";
  const icon = isDone ? "✓" : isApproved ? "○" : "·";
  return (
    <li
      key={a.id}
      className={`flex flex-col px-1.5 py-1 rounded transition-colors hover:bg-muted/50 ${
        isDone ? "text-muted-foreground line-through" : ""
      }`}
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span className="text-[10px] text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
        <span className={`w-3 text-center shrink-0 ${
          isDone ? "text-success" : isApproved ? "text-primary" : "text-muted-foreground"
        }`}>
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-medium">{a.title}</span>
        </span>
        <span className="text-[9px] font-semibold uppercase text-muted-foreground shrink-0">
          {a.status}
        </span>
      </div>
      {/* Rich metadata */}
      <div className="ml-9 mt-0.5 space-y-0.5">
        {a.description && (
          <p className="text-[11px] text-muted-foreground">{a.description}</p>
        )}
        {a.files && a.files.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {a.files.map((f) => (
              <span key={f} className="text-[10px] font-mono bg-muted px-1 rounded text-muted-foreground">
                {f}
              </span>
            ))}
          </div>
        )}
        {a.verify && (
          <p className="text-[10px] font-mono text-node-act">
            ▸ {a.verify}
          </p>
        )}
        {a.done && (
          <p className="text-[11px] italic text-muted-foreground">
            ✓ {a.done}
          </p>
        )}
        {a.dependsOn && a.dependsOn.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {a.dependsOn.map((d) => (
              <span key={d} className="text-[9px] font-mono px-1 rounded bg-muted/60 text-muted-foreground">
                ← {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function groupByWave(actions: ActionItem[]): { wave: number; actions: ActionItem[] }[] {
  const map = new Map<number, ActionItem[]>();
  for (const a of actions) {
    const w = a.wave ?? 0;
    if (!map.has(w)) map.set(w, []);
    map.get(w)!.push(a);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([wave, actions]) => ({ wave, actions }));
}
