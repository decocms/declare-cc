import { useState, useEffect, useRef } from "react";
import { NodeCard, BatchBar } from "./node-card";
import { useGraph, useApprove, useDeleteNode, useSSE } from "../hooks/use-graph";
import { OnboardingFlow } from "./onboarding/onboarding-flow";

type DrillLevel = "declarations" | "milestones" | "actions";

interface DrillState {
  level: DrillLevel;
  declarationId?: string;
  milestoneId?: string;
  /** Saved focus index per level so we restore position on drill-out */
  savedFocus: { declarations: number; milestones: number; actions: number };
}

const INITIAL_DRILL: DrillState = {
  level: "declarations",
  savedFocus: { declarations: 0, milestones: 0, actions: 0 },
};

export function LifecycleView() {
  const { data: graph, isLoading } = useGraph();
  useSSE();

  const [drill, setDrill] = useState<DrillState>(INITIAL_DRILL);
  const [focusIdx, setFocusIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const approve = useApprove();
  const deleteNode = useDeleteNode();

  const items = getItems(graph, drill);

  // Show onboarding when no declarations exist
  if (!isLoading && items.length === 0 && drill.level === "declarations") {
    return <OnboardingFlow />;
  }

  // Keep refs in sync so the keydown handler always sees latest state
  const drillRef = useRef(drill);
  const focusRef = useRef(focusIdx);
  const itemsRef = useRef(items);
  drillRef.current = drill;
  focusRef.current = focusIdx;
  itemsRef.current = items;

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.children[focusIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusIdx]);

  // Keyboard navigation — single stable listener, reads from refs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const currentItems = itemsRef.current;
      const currentFocus = focusRef.current;
      const currentDrill = drillRef.current;
      const len = currentItems.length;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          setFocusIdx(Math.min(currentFocus + 1, len - 1));
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          setFocusIdx(Math.max(currentFocus - 1, 0));
          break;
        case "Enter":
        case "ArrowRight":
        case "l":
          e.preventDefault();
          handleDrillIn(currentItems, currentFocus, currentDrill);
          break;
        case "Escape":
        case "ArrowLeft":
        case "h":
          e.preventDefault();
          handleDrillOut(currentDrill);
          break;
        case "a":
          e.preventDefault();
          if (currentItems[currentFocus]) approve.mutate([currentItems[currentFocus].id]);
          break;
        case "d":
          e.preventDefault();
          if (currentItems[currentFocus]) deleteNode.mutate({ id: currentItems[currentFocus].id, type: currentItems[currentFocus].nodeType });
          break;
        case "A":
          e.preventDefault();
          {
            const draftIds = currentItems.filter((i) => i.review !== "approved").map((i) => i.id);
            if (draftIds.length > 0) approve.mutate(draftIds);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // stable — never re-registers

  function handleDrillIn(currentItems: ItemShape[], idx: number, d: DrillState) {
    const item = currentItems[idx];
    if (!item) return;

    if (d.level === "declarations") {
      setDrill({
        ...d,
        level: "milestones",
        declarationId: item.id,
        savedFocus: { ...d.savedFocus, declarations: idx },
      });
      setFocusIdx(0);
    } else if (d.level === "milestones") {
      setDrill({
        ...d,
        level: "actions",
        milestoneId: item.id,
        savedFocus: { ...d.savedFocus, milestones: idx },
      });
      setFocusIdx(0);
    }
  }

  function handleDrillOut(d: DrillState) {
    if (d.level === "actions") {
      setDrill({ ...d, level: "milestones", milestoneId: undefined });
      setFocusIdx(d.savedFocus.milestones);
    } else if (d.level === "milestones") {
      setDrill({ ...d, level: "declarations", declarationId: undefined });
      setFocusIdx(d.savedFocus.declarations);
    }
  }

  function navigateTo(level: DrillLevel) {
    const d = drillRef.current;
    if (level === "declarations") {
      setDrill({ ...d, level: "declarations", declarationId: undefined, milestoneId: undefined });
      setFocusIdx(d.savedFocus.declarations);
    } else if (level === "milestones") {
      setDrill({ ...d, level: "milestones", milestoneId: undefined });
      setFocusIdx(d.savedFocus.milestones);
    }
  }

  function approveAll() {
    const draftIds = items.filter((i) => i.review !== "approved").map((i) => i.id);
    if (draftIds.length > 0) approve.mutate(draftIds);
  }

  const breadcrumbs = buildBreadcrumbs(graph, drill, navigateTo);

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const drafts = items.filter((i) => i.review !== "approved");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 border-b px-4 py-2 text-xs">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center gap-2">
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
              onClick={() => { setFocusIdx(i); handleDrillIn(items, i, drill); }}
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
  navigateTo: (level: DrillLevel) => void,
): { label: string; onClick?: () => void }[] {
  const crumbs: { label: string; onClick?: () => void }[] = [];

  const projectName = graph?.projectName ?? "Project";

  if (drill.level === "declarations") {
    crumbs.push({ label: projectName });
  } else {
    crumbs.push({ label: projectName, onClick: () => navigateTo("declarations") });
  }

  if (drill.level === "milestones" || drill.level === "actions") {
    const d = graph?.declarations?.find((d: any) => d.id === drill.declarationId);
    const label = d ? `${d.id} ${d.title}` : drill.declarationId ?? "";
    if (drill.level === "milestones") {
      crumbs.push({ label });
    } else {
      crumbs.push({ label, onClick: () => navigateTo("milestones") });
    }
  }

  if (drill.level === "actions") {
    const m = graph?.milestones?.find((m: any) => m.id === drill.milestoneId);
    crumbs.push({ label: m ? `${m.id} ${m.title}` : drill.milestoneId ?? "" });
  }

  return crumbs;
}
