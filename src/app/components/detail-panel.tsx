import { useSpawnAgent } from "../hooks/use-agents";

interface DetailPanelProps {
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
    // Milestone-specific
    realizes?: string[];
    milestoneCount?: number;
    actionCount?: number;
  } | null;
}

export function DetailPanel({ item }: DetailPanelProps) {
  const spawnAgent = useSpawnAgent();

  if (!item) {
    return (
      <aside className="w-72 shrink-0 border-l p-4">
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

  const typeColor =
    item.nodeType === "declaration" ? "text-blue-400" :
    item.nodeType === "milestone" ? "text-purple-400" : "text-green-400";

  return (
    <aside className="w-72 shrink-0 border-l flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <p className={`text-[10px] font-medium uppercase tracking-wider ${typeColor}`}>
            {typeLabel}
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.id}</p>
          <h3 className="text-sm font-semibold mt-1">{item.title}</h3>
        </div>

        {/* Statement (declarations) */}
        {item.statement && (
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Statement</p>
            <p className="text-sm text-muted-foreground">{item.statement}</p>
          </div>
        )}

        {/* Description (milestones, actions) */}
        {item.description && !item.statement && (
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
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
                <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
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

        {/* Counts */}
        {item.milestoneCount !== undefined && (
          <p className="text-xs text-muted-foreground">
            {item.milestoneCount} milestone{item.milestoneCount !== 1 ? "s" : ""}
          </p>
        )}
        {item.actionCount !== undefined && (
          <p className="text-xs text-muted-foreground">
            {item.actionCount} action{item.actionCount !== 1 ? "s" : ""}
          </p>
        )}

        {/* Agent actions */}
        <div className="border-t pt-3 space-y-2">
          {item.nodeType === "declaration" && (
            <button
              onClick={() => spawnAgent.mutate({ endpoint: "derive", body: { declarationId: item.id } })}
              disabled={spawnAgent.isPending}
              className="w-full h-8 text-xs font-medium rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              {spawnAgent.isPending ? "Deriving..." : "Derive Milestones"}
            </button>
          )}
          {item.nodeType === "milestone" && (
            <>
              <button
                onClick={() => spawnAgent.mutate({ endpoint: "execute", body: { actionId: item.id } })}
                disabled={spawnAgent.isPending}
                className="w-full h-8 text-xs font-medium rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                Plan Actions
              </button>
              <button
                onClick={() => spawnAgent.mutate({ endpoint: "verify", body: { milestoneId: item.id } })}
                disabled={spawnAgent.isPending}
                className="w-full h-8 text-xs font-medium rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
              >
                Verify
              </button>
            </>
          )}
          {item.nodeType === "action" && (
            <button
              onClick={() => spawnAgent.mutate({ endpoint: "execute", body: { actionId: item.id } })}
              disabled={spawnAgent.isPending}
              className="w-full h-8 text-xs font-medium rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {spawnAgent.isPending ? "Executing..." : "Execute"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
