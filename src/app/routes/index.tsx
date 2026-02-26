import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: graph, isLoading } = useQuery({
    queryKey: ["graph"],
    queryFn: () => fetch("/api/graph").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const declarations = graph?.declarations ?? [];
  const milestones = graph?.milestones ?? [];
  const actions = graph?.actions ?? [];

  return (
    <div className="flex flex-1">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r bg-sidebar p-4">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase text-brand">Project</p>
          <p className="text-sm font-semibold">
            {graph?.projectName ?? "Declare"}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>
            {declarations.length} declarations &middot; {milestones.length}{" "}
            milestones &middot; {actions.length} actions
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        {declarations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <h2 className="text-lg font-semibold">No declarations yet</h2>
            <p className="text-sm text-muted-foreground">
              Describe your vision to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-brand">
              Declarations
            </h2>
            {declarations.map(
              (d: { id: string; title: string; statement?: string }) => (
                <div
                  key={d.id}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono font-medium text-brand">
                      {d.id}
                    </span>
                    <h3 className="text-sm font-semibold">{d.title}</h3>
                  </div>
                  {d.statement && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {d.statement}
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Details panel */}
      <aside className="w-72 shrink-0 border-l p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Details
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Click a declaration to see details.
        </p>
      </aside>
    </div>
  );
}
