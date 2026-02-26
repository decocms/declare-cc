import { useState, useEffect, useRef, useCallback } from "react";
import { NodeCard, BatchBar } from "./node-card";
import { DetailPanel } from "./detail-panel";
import { AgentPanel } from "./agent-panel";
import { useGraph, useApprove, useDeleteNode, useSSE } from "../hooks/use-graph";
import { useAgents, useSpawnAgent } from "../hooks/use-agents";
import { OnboardingFlow } from "./onboarding/onboarding-flow";

function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.theme = next ? "dark" : "light";
  }, [dark]);
  return { dark, toggle };
}

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

/** Read drill state from URL hash (e.g. #D-01 or #D-01/M-03) */
function drillFromHash(): DrillState {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return INITIAL_DRILL;
  const parts = hash.split("/");
  if (parts.length === 2 && parts[0].startsWith("D-") && parts[1].startsWith("M-")) {
    return { level: "actions", declarationId: parts[0], milestoneId: parts[1], savedFocus: { declarations: 0, milestones: 0, actions: 0 } };
  }
  if (parts.length === 1 && parts[0].startsWith("D-")) {
    return { level: "milestones", declarationId: parts[0], savedFocus: { declarations: 0, milestones: 0, actions: 0 } };
  }
  return INITIAL_DRILL;
}

export function LifecycleView() {
  const { data: graph, isLoading } = useGraph();
  useSSE();

  const [drill, setDrillRaw] = useState<DrillState>(drillFromHash);
  const [focusIdx, setFocusIdx] = useState(0);

  // Sync drill state to URL hash
  const setDrill = (d: DrillState) => {
    setDrillRaw(d);
    if (d.level === "actions" && d.declarationId && d.milestoneId) {
      window.location.hash = `${d.declarationId}/${d.milestoneId}`;
    } else if (d.level === "milestones" && d.declarationId) {
      window.location.hash = d.declarationId;
    } else {
      window.location.hash = "";
    }
  };
  const listRef = useRef<HTMLDivElement>(null);

  const approveRaw = useApprove();
  const deleteNode = useDeleteNode();
  const { data: agents = [] } = useAgents();
  const spawnAgent = useSpawnAgent();

  /** Approve → then auto-plan next level */
  function approveAndPlan(ids: string[]) {
    approveRaw.mutate(ids, {
      onSuccess: () => {
        for (const id of ids) {
          const prefix = id.split("-")[0];
          if (prefix === "D") {
            // Declaration approved → derive milestones
            spawnAgent.mutate({ endpoint: "derive", body: { declarationId: id } });
          } else if (prefix === "M") {
            // Milestone approved → plan actions
            spawnAgent.mutate({ endpoint: "plan-actions", body: { milestoneId: id } });
          }
        }
      },
    });
  }

  const items = getItems(graph, drill);

  // Build a set of node IDs that have a running agent
  const runningNodeIds = new Set(
    agents
      .filter((a) => a.status === "running")
      .map((a) => {
        // Extract node ID from agent prompt (e.g. "Execute M-03" → "M-03")
        const match = a.prompt.match(/\b([DMA]-\d+)\b/i);
        return match ? match[1].toUpperCase() : null;
      })
      .filter(Boolean) as string[],
  );

  // Keep refs in sync so the keydown handler always sees latest state
  const drillRef = useRef(drill);
  const focusRef = useRef(focusIdx);
  const itemsRef = useRef(items);
  const spawnAgentRef = useRef(spawnAgent);
  drillRef.current = drill;
  focusRef.current = focusIdx;
  itemsRef.current = items;
  spawnAgentRef.current = spawnAgent;

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
          if (currentItems[currentFocus]) approveAndPlan([currentItems[currentFocus].id]);
          break;
        case "d":
          e.preventDefault();
          if (currentItems[currentFocus]) deleteNode.mutate({ id: currentItems[currentFocus].id, type: currentItems[currentFocus].nodeType });
          break;
        case "A":
          e.preventDefault();
          {
            const draftIds = currentItems.filter((i) => i.review !== "approved").map((i) => i.id);
            if (draftIds.length > 0) approveAndPlan(draftIds);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // stable — never re-registers

  // Show onboarding when no declarations exist (after all hooks)
  if (!isLoading && items.length === 0 && drill.level === "declarations") {
    return <OnboardingFlow />;
  }

  function handleDrillIn(currentItems: ItemShape[], idx: number, d: DrillState) {
    const item = currentItems[idx];
    if (!item || item.childCount === 0) return; // No children → just select, don't drill

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
    if (draftIds.length > 0) approveAndPlan(draftIds);
  }

  const breadcrumbs = buildBreadcrumbs(graph, drill, navigateTo);

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const drafts = items.filter((i) => i.review !== "approved");

  // Build detail item from focused item + graph enrichment
  const focusedItem = items[focusIdx] ?? null;
  const detailItem = focusedItem ? buildDetailItem(focusedItem, graph) : null;

  const { dark, toggle } = useTheme();
  const projectName = graph?.projectName ?? "Declare";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topbar — full width, breadcrumb + shortcuts + theme */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            onClick={() => navigateTo("declarations")}
            className={`font-semibold shrink-0 transition-colors ${drill.level === "declarations" ? "text-foreground" : "text-muted-foreground hover:text-foreground cursor-pointer"}`}
          >
            {projectName}
          </button>
          {breadcrumbs.filter(bc => !bc.isHome).map((bc, i) => (
            <span key={i} className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground text-xs shrink-0">&rsaquo;</span>
              {bc.onClick ? (
                <button onClick={bc.onClick} className="text-muted-foreground hover:text-foreground transition-colors truncate text-xs">
                  {bc.label}
                </button>
              ) : (
                <span className="font-medium text-foreground truncate text-xs">{bc.label}</span>
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            <kbd className="font-mono">↑↓</kbd> nav &middot; <kbd className="font-mono">→</kbd> in &middot; <kbd className="font-mono">←</kbd> back &middot; <kbd className="font-mono">a</kbd> approve
          </span>
          <button onClick={toggle} className="h-6 w-6 flex items-center justify-center text-xs rounded-md border bg-card hover:bg-accent transition-colors text-muted-foreground" title={dark ? "Light mode" : "Dark mode"}>
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      {/* Content: list + detail + agents */}
      <div className="flex flex-1 overflow-hidden">
      {/* List panel */}
      <div className="flex w-[480px] shrink-0 flex-col overflow-hidden border-r">

      {/* Level header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2
          style={{ color: `var(--color-node-${drill.level === "declarations" ? "decl" : drill.level === "milestones" ? "mile" : "act"})` }}
          className="text-xs font-medium uppercase tracking-wide"
        >
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
              status={item.status}
              review={item.review as "draft" | "approved" | undefined}
              isRunning={runningNodeIds.has(item.id)}
              childCount={item.childCount}
              focused={i === focusIdx}
              onClick={() => setFocusIdx(i)}
              onDoubleClick={() => handleDrillIn(items, i, drill)}
              onApprove={() => approveAndPlan([item.id])}
              onDelete={() => deleteNode.mutate({ id: item.id, type: item.nodeType })}
            />
          ))
        )}
      </div>

      {/* Batch bar */}
      <BatchBar count={drafts.length} onApproveAll={approveAll} />
      </div>

      {/* Right panels */}
      <div className="flex flex-1 min-w-0">
        <DetailPanel item={detailItem} isRunning={focusedItem ? runningNodeIds.has(focusedItem.id) : false} />
        <AgentPanel />
      </div>
      </div>
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
  childCount: number;
}

function getItems(graph: any, drill: DrillState): ItemShape[] {
  if (!graph) return [];

  if (drill.level === "declarations") {
    return (graph.declarations ?? []).map((d: any) => {
      const milestoneCount = (graph.milestones ?? []).filter(
        (m: any) => m.realizes?.includes(d.id)
      ).length;
      return {
        id: d.id,
        nodeType: "declaration" as const,
        title: d.title,
        description: d.statement,
        status: d.status ?? "PENDING",
        review: d.review ?? "draft",
        childCount: milestoneCount,
      };
    });
  }

  if (drill.level === "milestones" && drill.declarationId) {
    return (graph.milestones ?? [])
      .filter((m: any) => m.realizes?.includes(drill.declarationId))
      .map((m: any) => {
        const actionCount = (graph.actions ?? []).filter(
          (a: any) => a.milestoneId === m.id
        ).length;
        return {
          id: m.id,
          nodeType: "milestone" as const,
          title: m.title,
          description: m.description,
          status: m.status ?? "PENDING",
          review: m.reviewState ?? "draft",
          childCount: actionCount,
        };
      });
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
        childCount: 0,
      }));
  }

  return [];
}

function buildBreadcrumbs(
  graph: any,
  drill: DrillState,
  navigateTo: (level: DrillLevel) => void,
): { label: string; isHome?: boolean; onClick?: () => void }[] {
  const crumbs: { label: string; isHome?: boolean; onClick?: () => void }[] = [];

  // Always show home icon — clickable when drilled in, inert at top level
  crumbs.push({
    label: "",
    isHome: true,
    onClick: drill.level !== "declarations" ? () => navigateTo("declarations") : undefined,
  });

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

function buildDetailItem(item: ItemShape, graph: any) {
  if (!item || !graph) return null;

  const base = {
    id: item.id,
    nodeType: item.nodeType,
    title: item.title,
    description: item.description,
    status: item.status,
    review: item.review,
  };

  if (item.nodeType === "declaration") {
    const d = graph.declarations?.find((d: any) => d.id === item.id);
    const milestoneCount = (graph.milestones ?? []).filter(
      (m: any) => m.realizes?.includes(item.id)
    ).length;
    return { ...base, statement: d?.statement, why: d?.why, milestoneCount };
  }

  if (item.nodeType === "milestone") {
    const m = graph.milestones?.find((m: any) => m.id === item.id);
    const actionCount = (graph.actions ?? []).filter(
      (a: any) => a.milestoneId === item.id
    ).length;
    return { ...base, realizes: m?.realizes, actionCount };
  }

  return base;
}
