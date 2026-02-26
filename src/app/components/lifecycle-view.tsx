import { useState, useCallback, useEffect, useRef } from "react";
import { NodeCard, BatchBar } from "./node-card";
import { useGraph, useApprove, useDeleteNode, useSSE } from "../hooks/use-graph";

type DrillLevel = "declarations" | "milestones" | "actions";

interface DrillState {
  level: DrillLevel;
  declarationId?: string;
  milestoneId?: string;
}

export function LifecycleView() {
  const { data: graph, isLoading } = useGraph();
  useSSE();

  const [drill, setDrill] = useState<DrillState>({ level: "declarations" });
  const [focusIdx, setFocusIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const approve = useApprove();
  const deleteNode = useDeleteNode();

  // Current items based on drill level
  const items = getItems(graph, drill);

  // Reset focus when drill level or items change
  useEffect(() => { setFocusIdx(0); }, [drill.level, drill.declarationId, drill.milestoneId]);

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.children[focusIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusIdx]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const len = items.length;
      if (!len) return;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          setFocusIdx((i) => Math.min(i + 1, len - 1));
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          setFocusIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case "ArrowRight":
        case "l":
          e.preventDefault();
          drillIn(items[focusIdx]);
          break;
        case "Escape":
        case "ArrowLeft":
        case "h":
          e.preventDefault();
          drillOut();
          break;
        case "a":
          e.preventDefault();
          if (items[focusIdx]) {
            approve.mutate([items[focusIdx].id]);
          }
          break;
        case "d":
          e.preventDefault();
          if (items[focusIdx]) {
            deleteNode.mutate({ id: items[focusIdx].id, type: items[focusIdx].nodeType });
          }
          break;
        case "A":
          // Shift+A = approve all
          e.preventDefault();
          approveAll();
          break;
      }
    },
    [items, focusIdx, drill],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function drillIn(item: ReturnType<typeof getItems>[number] | undefined) {
    if (!item) return;
    if (drill.level === "declarations") {
      setDrill({ level: "milestones", declarationId: item.id });
    } else if (drill.level === "milestones") {
      setDrill({ level: "actions", declarationId: drill.declarationId, milestoneId: item.id });
    }
  }

  function drillOut() {
    if (drill.level === "actions") {
      setDrill({ level: "milestones", declarationId: drill.declarationId });
    } else if (drill.level === "milestones") {
      setDrill({ level: "declarations" });
    }
  }

  function approveAll() {
    const draftIds = items.filter((i) => i.review !== "approved").map((i) => i.id);
    if (draftIds.length > 0) approve.mutate(draftIds);
  }

  // Breadcrumb data
  const breadcrumbs = buildBreadcrumbs(graph, drill);

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const drafts = items.filter((i) => i.review !== "approved");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b px-4 py-2 text-xs">
        {breadcrumbs.map((bc, i) => (
          <span key={bc.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">&rsaquo;</span>}
            {bc.onClick ? (
              <button onClick={bc.onClick} className="text-muted-foreground hover:text-foreground transition-colors">
                {bc.label}
              </button>
            ) : (
              <span className="font-semibold text-foreground">{bc.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Level header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-brand">
          {drill.level} <span className="text-muted-foreground ml-1">{items.length}</span>
        </h2>
      </div>

      {/* Item list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No {drill.level} yet</p>
          </div>
        ) : (
          items.map((item, i) => (
            <NodeCard
              key={item.id}
              id={item.id}
              type={item.nodeType}
              title={item.title}
              description={item.description}
              status={item.status}
              review={item.review as "draft" | "approved" | undefined}
              focused={i === focusIdx}
              onClick={() => { setFocusIdx(i); drillIn(item); }}
              onApprove={() => approve.mutate([item.id])}
              onDelete={() => deleteNode.mutate({ id: item.id, type: item.nodeType })}
            />
          ))
        )}
      </div>

      {/* Batch bar */}
      <BatchBar count={drafts.length} onApproveAll={approveAll} />
    </div>
  );
}

// ── Helpers ──

interface ItemShape {
  id: string;
  nodeType: "declaration" | "milestone" | "action";
  title: string;
  description?: string;
  status?: string;
  review?: string;
}

function getItems(graph: any, drill: DrillState): ItemShape[] {
  if (!graph) return [];

  if (drill.level === "declarations") {
    return (graph.declarations ?? []).map((d: any) => ({
      id: d.id,
      nodeType: "declaration" as const,
      title: d.title,
      description: d.statement,
      status: d.status ?? "PENDING",
      review: d.review ?? "draft",
    }));
  }

  if (drill.level === "milestones" && drill.declarationId) {
    return (graph.milestones ?? [])
      .filter((m: any) => m.realizes?.includes(drill.declarationId))
      .map((m: any) => ({
        id: m.id,
        nodeType: "milestone" as const,
        title: m.title,
        description: m.description,
        status: m.status ?? "PENDING",
        review: m.reviewState ?? "draft",
      }));
  }

  if (drill.level === "actions" && drill.milestoneId) {
    return (graph.actions ?? [])
      .filter((a: any) => a.milestoneId === drill.milestoneId)
      .map((a: any) => ({
        id: a.id,
        nodeType: "action" as const,
        title: a.title,
        description: a.description,
        status: a.status ?? "PENDING",
        review: "draft",
      }));
  }

  return [];
}

function buildBreadcrumbs(
  graph: any,
  drill: DrillState,
): { label: string; onClick?: () => void }[] {
  const crumbs: { label: string; onClick?: () => void }[] = [];

  crumbs.push({
    label: graph?.projectName ?? "Project",
    onClick: drill.level !== "declarations" ? () => {} : undefined,
  });

  if (drill.level === "milestones" || drill.level === "actions") {
    const d = graph?.declarations?.find((d: any) => d.id === drill.declarationId);
    crumbs[0].onClick = undefined; // Will be set below
    crumbs.push({
      label: d ? `${d.id} ${d.title}` : drill.declarationId ?? "",
      onClick: drill.level === "actions" ? () => {} : undefined,
    });
  }

  if (drill.level === "actions") {
    const m = graph?.milestones?.find((m: any) => m.id === drill.milestoneId);
    crumbs.push({
      label: m ? `${m.id} ${m.title}` : drill.milestoneId ?? "",
    });
  }

  return crumbs;
}
