import { useGraph } from "../hooks/use-graph";

export function Sidebar() {
  const { data: graph } = useGraph();

  const declarations = graph?.declarations ?? [];
  const milestones = graph?.milestones ?? [];
  const actions = graph?.actions ?? [];
  const total = declarations.length + milestones.length + actions.length;
  const done = [
    ...declarations.filter((d: any) => d.wholeness === "whole"),
    ...milestones.filter((m: any) => m.wholeness === "whole"),
    ...actions.filter((a: any) => a.wholeness === "whole"),
  ].length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar p-4 flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-brand">
          Project
        </p>
        <p className="text-sm font-semibold text-sidebar-foreground">
          {graph?.projectName ?? "Declare"}
        </p>
      </div>

      {total > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Progress
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {done}/{total} done ({pct}%)
          </p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Graph
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {declarations.length} declarations &middot;{" "}
          {milestones.length} milestones &middot;{" "}
          {actions.length} actions
        </p>
      </div>

      <div className="mt-auto text-[10px] text-muted-foreground">
        <p>
          <kbd className="font-mono">↑↓</kbd> navigate &middot;{" "}
          <kbd className="font-mono">→</kbd> drill in
        </p>
        <p>
          <kbd className="font-mono">←</kbd> back &middot;{" "}
          <kbd className="font-mono">a</kbd> approve &middot;{" "}
          <kbd className="font-mono">d</kbd> delete
        </p>
        <p>
          <kbd className="font-mono">A</kbd> approve all
        </p>
      </div>
    </aside>
  );
}
