import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { NodeCard, BatchBar } from "./node-card";
import { DetailPanel } from "./detail-panel";
import { AgentPanel } from "./agent-panel";
import { useGraph, useApprove, useDeleteNode, useUpdateNode, useSSE } from "../hooks/use-graph";
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

type DrillLevel = "declarations" | "milestones";

interface DrillState {
  level: DrillLevel;
  declarationId?: string;
  /** Selected milestone ID — shown in detail panel, not a drill level */
  milestoneId?: string;
  /** Saved focus index per level so we restore position on drill-out */
  savedFocus: { declarations: number; milestones: number };
}

const INITIAL_DRILL: DrillState = {
  level: "declarations",
  savedFocus: { declarations: 0, milestones: 0 },
};

/** Read drill state from URL hash (e.g. #D-01 or #D-01/M-03) */
function drillFromHash(): DrillState {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return INITIAL_DRILL;
  const parts = hash.split("/");
  if (parts.length === 2 && parts[0].startsWith("D-") && parts[1].startsWith("M-")) {
    return { level: "milestones", declarationId: parts[0], milestoneId: parts[1], savedFocus: { declarations: 0, milestones: 0 } };
  }
  if (parts.length === 1 && parts[0].startsWith("D-")) {
    return { level: "milestones", declarationId: parts[0], savedFocus: { declarations: 0, milestones: 0 } };
  }
  return INITIAL_DRILL;
}

export function LifecycleView() {
  const { data: graph, isLoading } = useGraph();
  useSSE();

  const [drill, setDrillRaw] = useState<DrillState>(drillFromHash);
  const [focusIdx, setFocusIdx] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const { dark, toggle } = useTheme();

  // Sync drill state to URL hash
  const setDrill = (d: DrillState) => {
    setDrillRaw(d);
    if (d.level === "milestones" && d.declarationId) {
      window.location.hash = d.milestoneId
        ? `${d.declarationId}/${d.milestoneId}`
        : d.declarationId;
    } else {
      window.location.hash = "";
    }
  };
  const listRef = useRef<HTMLDivElement>(null);

  const approveRaw = useApprove();
  const deleteNode = useDeleteNode();
  const updateNode = useUpdateNode();
  const { data: agents = [] } = useAgents();
  const spawnAgent = useSpawnAgent();

  // Inline edit state: which node is being edited, and the feedback text
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFeedback, setEditFeedback] = useState("");

  /** Approve → then auto-plan next level. Skip if children already exist. */
  function approveAndPlan(ids: string[]) {
    // Split into already-approved (retry) vs new approvals
    const alreadyApproved = ids.filter((id) => {
      const item = items.find((i) => i.id === id);
      return item?.review === "approved";
    });
    const toApprove = ids.filter((id) => !alreadyApproved.includes(id));

    function spawnAgents(spawnIds: string[]) {
      for (const id of spawnIds) {
        const prefix = id.split("-")[0];
        if (prefix === "D") {
          // Only derive if this declaration has no milestones yet
          const hasMilestones = (graph?.milestones ?? []).some(
            (m: any) => m.realizes?.includes(id),
          );
          if (!hasMilestones) {
            spawnAgent.mutate({ endpoint: "derive", body: { declarationId: id } });
          }
        } else if (prefix === "M") {
          // Only plan if this milestone has no actions yet
          const hasActions = (graph?.actions ?? []).some(
            (a: any) => a.milestoneId === id,
          );
          if (!hasActions) {
            spawnAgent.mutate({ endpoint: "plan-actions", body: { milestoneId: id } });
          }
        }
      }
    }

    // Retry already-approved items — only spawn if children don't exist
    if (alreadyApproved.length > 0) {
      spawnAgents(alreadyApproved);
    }

    // Approve new items, then spawn agents
    if (toApprove.length > 0) {
      approveRaw.mutate(toApprove, {
        onSuccess: () => spawnAgents(toApprove),
      });
    }
  }

  const items = useMemo(() => getItems(graph, drill), [graph, drill.level, drill.declarationId]);

  // Set focus by index, also remembering the ID so it survives graph refetches
  const setFocus = useCallback((idx: number) => {
    setFocusIdx(idx);
    // itemsRef has latest items
    const id = itemsRef.current[idx]?.id ?? null;
    setFocusId(id);
  }, []);

  // Restore focus position by ID after items change (e.g. graph refetch)
  useEffect(() => {
    if (focusId && items.length > 0) {
      const idx = items.findIndex((i) => i.id === focusId);
      if (idx >= 0 && idx !== focusIdx) {
        setFocusIdx(idx);
      }
    }
  }, [items, focusId]);

  // Compute display focus index — resolve by ID to survive graph refetches
  const displayFocusIdx = useMemo(() => {
    if (drill.level === "milestones" && drill.milestoneId) {
      return Math.max(0, items.findIndex(i => i.id === drill.milestoneId));
    }
    if (focusId) {
      const idx = items.findIndex(i => i.id === focusId);
      if (idx >= 0) return idx;
    }
    return Math.min(focusIdx, Math.max(0, items.length - 1));
  }, [drill.level, drill.milestoneId, focusId, focusIdx, items]);

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
  focusRef.current = displayFocusIdx;
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
        case "j": {
          e.preventDefault();
          const next = Math.min(currentFocus + 1, len - 1);
          setFocus(next);
          if (currentDrill.level === "milestones" && currentItems[next]) {
            setDrill({ ...currentDrill, milestoneId: currentItems[next].id });
          }
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const prev = Math.max(currentFocus - 1, 0);
          setFocus(prev);
          if (currentDrill.level === "milestones" && currentItems[prev]) {
            setDrill({ ...currentDrill, milestoneId: currentItems[prev].id });
          }
          break;
        }
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
        case "e":
          e.preventDefault();
          if (currentItems[currentFocus]) {
            setEditingId((prev) => prev === currentItems[currentFocus].id ? null : currentItems[currentFocus].id);
            setEditFeedback("");
          }
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

  // Build detail item (must be before early returns — hooks must be unconditional)
  const { detailItem, detailSourceId } = useMemo(() => {
    const focusedItem = items[displayFocusIdx] ?? null;
    const selectedMilestone = drill.milestoneId && graph
      ? (() => {
          const m = (graph.milestones ?? []).find((m: any) => m.id === drill.milestoneId);
          if (!m) return null;
          const actions = (graph.actions ?? []).filter((a: any) => a.milestoneId === m.id);
          return {
            id: m.id,
            nodeType: "milestone" as const,
            title: m.title,
            description: m.description,
            status: m.status ?? "PENDING",
            review: m.reviewState ?? "draft",
            childCount: actions.length,
          };
        })()
      : null;
    const detailSource = selectedMilestone ?? focusedItem;
    return {
      detailItem: detailSource ? buildDetailItem(detailSource, graph) : null,
      detailSourceId: detailSource?.id ?? null,
    };
  }, [items, displayFocusIdx, drill.milestoneId, graph]);

  const projectName = graph?.projectName ?? "Declare";
  const drafts = items.filter((i) => i.review !== "approved");

  // Show onboarding when no declarations exist (after all hooks)
  if (!isLoading && items.length === 0 && drill.level === "declarations") {
    return <OnboardingFlow />;
  }

  if (isLoading && !graph) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>;
  }

  function handleDrillIn(currentItems: ItemShape[], idx: number, d: DrillState) {
    const item = currentItems[idx];
    if (!item) return;

    if (d.level === "declarations") {
      if (item.childCount === 0) return; // No milestones → don't drill
      setDrill({
        ...d,
        level: "milestones",
        declarationId: item.id,
        savedFocus: { ...d.savedFocus, declarations: idx },
      });
      setFocus(0);
    } else if (d.level === "milestones") {
      // Select/toggle milestone — actions shown inline in detail panel
      setDrill({
        ...d,
        milestoneId: d.milestoneId === item.id ? undefined : item.id,
      });
    }
  }

  function handleDrillOut(d: DrillState) {
    if (d.level === "milestones") {
      setDrill({ ...d, level: "declarations", declarationId: undefined, milestoneId: undefined });
      setFocus(d.savedFocus.declarations);
    }
  }

  function navigateTo(level: DrillLevel) {
    const d = drillRef.current;
    if (level === "declarations") {
      setDrill({ ...d, level: "declarations", declarationId: undefined, milestoneId: undefined });
      setFocus(d.savedFocus.declarations);
    } else if (level === "milestones") {
      setDrill({ ...d, level: "milestones", milestoneId: undefined });
      setFocus(d.savedFocus.milestones);
    }
  }

  function approveAll() {
    const draftIds = items.filter((i) => i.review !== "approved").map((i) => i.id);
    if (draftIds.length > 0) approveAndPlan(draftIds);
  }

  const breadcrumbs = buildBreadcrumbs(graph, drill, navigateTo);

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
          style={{ color: `var(--color-node-${drill.level === "declarations" ? "decl" : "mile"})` }}
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
            <div key={item.id}>
              <NodeCard
                id={item.id}
                type={item.nodeType}
                title={item.title}
                status={item.status}
                review={item.review as "draft" | "approved" | undefined}
                isRunning={runningNodeIds.has(item.id)}
                childCount={item.childCount}
                focused={i === displayFocusIdx}
                selected={drill.milestoneId === item.id}
                onClick={() => {
                  setFocus(i);
                  if (drill.level === "milestones") {
                    handleDrillIn(items, i, drill);
                  }
                }}
                onApprove={() => approveAndPlan([item.id])}
                onEdit={() => {
                  setEditingId(editingId === item.id ? null : item.id);
                  setEditFeedback("");
                }}
                onDelete={() => deleteNode.mutate({ id: item.id, type: item.nodeType })}
              />
              {editingId === item.id && (
                <div className="mt-1 ml-4 mr-2 space-y-2">
                  <textarea
                    autoFocus
                    value={editFeedback}
                    onChange={(e) => setEditFeedback(e.target.value)}
                    placeholder="Describe what to change..."
                    rows={3}
                    className="w-full rounded-lg border bg-card p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!editFeedback.trim()) return;
                        updateNode.mutate({
                          id: item.id,
                          type: item.nodeType,
                          data: { feedback: editFeedback.trim() },
                        });
                        setEditingId(null);
                        setEditFeedback("");
                      }}
                      disabled={!editFeedback.trim()}
                      className="h-7 px-3 text-xs font-medium rounded-md bg-brand text-brand-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      Save Feedback
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditFeedback(""); }}
                      className="h-7 px-3 text-xs font-medium rounded-md border bg-card hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Batch bar */}
      <BatchBar count={drafts.length} onApproveAll={approveAll} />
      </div>

      {/* Right panels */}
      <div className="flex flex-1 min-w-0">
        <DetailPanel
          item={detailItem}
          isRunning={detailSourceId ? runningNodeIds.has(detailSourceId) : false}
          onDrillToMilestone={drill.level === "declarations" ? (declId: string, mileId: string) => {
            setDrill({
              ...drill,
              level: "milestones",
              declarationId: declId,
              milestoneId: mileId,
              savedFocus: { ...drill.savedFocus, declarations: displayFocusIdx },
            });
            setFocus(0);
          } : undefined}
        />
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

  if (drill.level === "milestones") {
    const d = graph?.declarations?.find((d: any) => d.id === drill.declarationId);
    const label = d ? `${d.id} ${d.title}` : drill.declarationId ?? "";
    crumbs.push({ label });
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
    const milestones = (graph.milestones ?? [])
      .filter((m: any) => m.realizes?.includes(item.id))
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        status: m.status ?? "PENDING",
        review: m.reviewState ?? "draft",
        actionCount: (graph.actions ?? []).filter((a: any) => a.milestoneId === m.id).length,
      }));
    return { ...base, statement: d?.statement, why: d?.why, milestoneCount: milestones.length, milestones };
  }

  if (item.nodeType === "milestone") {
    const m = graph.milestones?.find((m: any) => m.id === item.id);
    const actions = (graph.actions ?? [])
      .filter((a: any) => a.milestoneId === item.id)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status ?? "PENDING",
        review: a.reviewState ?? "draft",
        files: a.files,
        verify: a.verify,
        done: a.done,
        wave: a.wave,
        produces: a.produces,
        dependsOn: a.dependsOn,
      }));
    return {
      ...base,
      realizes: m?.realizes,
      actionCount: actions.length,
      actions,
      successCriteria: m?.planMeta?.successCriteria,
      mustHaves: m?.planMeta?.mustHaves,
    };
  }

  return base;
}
