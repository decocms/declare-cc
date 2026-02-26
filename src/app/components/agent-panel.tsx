import { useState } from "react";
import { useAgents, type Agent } from "../hooks/use-agents";

export function AgentPanel() {
  const { data: agents = [] } = useAgents();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const running = agents.filter((a) => a.status === "running");
  const completed = agents.filter((a) => a.status !== "running");

  return (
    <aside className="w-72 shrink-0 border-l flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Agents
          {running.length > 0 && (
            <span className="ml-2 text-brand">{running.length} running</span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No agents yet. Spawn agents from declarations or milestones.
          </div>
        ) : (
          <div className="divide-y">
            {agents.map((agent) => (
              <AgentItem
                key={agent.id}
                agent={agent}
                expanded={expandedId === agent.id}
                onToggle={() =>
                  setExpandedId(expandedId === agent.id ? null : agent.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function AgentItem({
  agent,
  expanded,
  onToggle,
}: {
  agent: Agent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusColor: Record<string, string> = {
    running: "text-warning",
    completed: "text-success",
    failed: "text-destructive",
    interrupted: "text-muted-foreground",
  };

  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              agent.status === "running" ? "bg-warning animate-pulse" : agent.status === "completed" ? "bg-success" : "bg-destructive"
            }`}
          />
          <span className="text-xs font-medium text-foreground truncate flex-1">
            {agent.prompt}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px]">
          <span className={statusColor[agent.status] ?? "text-muted-foreground"}>
            {agent.status}
          </span>
          <span className="text-muted-foreground">{agent.type}</span>
          <span className="text-muted-foreground">
            {new Date(agent.startedAt).toLocaleTimeString()}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Prompt */}
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
              Prompt
            </p>
            <pre className="text-[11px] p-2 rounded bg-muted text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap font-mono">
              {agent.context.slice(0, 500)}
              {agent.context.length > 500 && "..."}
            </pre>
          </div>

          {/* Output */}
          {agent.output && (
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
                Output
              </p>
              <pre className="text-[11px] p-2 rounded bg-muted text-foreground max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                {agent.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {agent.error && (
            <div>
              <p className="text-[10px] font-medium uppercase text-destructive mb-1">
                Error
              </p>
              <pre className="text-[11px] p-2 rounded bg-destructive/10 text-destructive max-h-20 overflow-y-auto whitespace-pre-wrap font-mono">
                {agent.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
