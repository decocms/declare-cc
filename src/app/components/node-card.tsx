import { memo, type ReactNode } from "react";

export type NodeType = "declaration" | "milestone" | "action";
export type ReviewState = "draft" | "approved" | "rejected";

interface NodeCardProps {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status?: string;
  review?: ReviewState;
  wholeness?: string;
  isRunning?: boolean;
  childCount?: number;
  focused?: boolean;
  selected?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  onApprove?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TYPE_STYLES: Record<NodeType, { idVar: string; borderVar: string; bgVar: string }> = {
  declaration: { idVar: "--color-node-decl", borderVar: "--color-node-decl", bgVar: "--color-node-decl-bg" },
  milestone:   { idVar: "--color-node-mile", borderVar: "--color-node-mile", bgVar: "--color-node-mile-bg" },
  action:      { idVar: "--color-node-act",  borderVar: "--color-node-act",  bgVar: "--color-node-act-bg" },
};

export const NodeCard = memo(function NodeCard({
  id,
  type,
  title,
  description,
  status,
  review,
  isRunning,
  childCount,
  focused,
  onClick,
  onApprove,
  onEdit,
  onDelete,
}: NodeCardProps) {
  const vars = TYPE_STYLES[type];

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{
        borderColor: isRunning ? undefined : `var(${vars.borderVar} / 0.3)`,
      }}
      className={[
        "rounded-lg border p-4 transition-all cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110",
        focused ? "ring-2 ring-brand/40 bg-accent" : "bg-card",
        isRunning ? "border-warning/40" : "",
      ].join(" ")}
    >
      {/* Header: ID + Title */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span
          style={{ color: `var(${vars.idVar})` }}
          className="text-xs font-mono font-semibold shrink-0"
        >
          {id}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}

      {/* Badges */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {isRunning && (
          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning animate-pulse">
            Running
          </span>
        )}
        {status && (
          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {status}
          </span>
        )}
        {review === "approved" && (childCount === undefined || childCount > 0) && (
          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-success/10 text-success">
            approved
          </span>
        )}
        {review === "approved" && childCount === 0 && status !== "DONE" && status !== "KEPT" && status !== "HONORED" && (
          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-warning/10 text-warning animate-pulse">
            planning...
          </span>
        )}
      </div>

      {/* Actions — identical at every level */}
      <div className="mt-3 flex items-center gap-2">
        {onApprove && review !== "approved" && (
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="h-7 px-3 text-xs font-medium rounded-md bg-brand text-brand-foreground hover:opacity-90 transition-opacity"
          >
            <kbd className="mr-1 opacity-60">A</kbd>Approve
          </button>
        )}
        {onApprove && review === "approved" && childCount === 0 && !isRunning && status !== "DONE" && status !== "KEPT" && status !== "HONORED" && (
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="h-7 px-3 text-xs font-medium rounded-md border border-warning/40 bg-warning/5 text-warning hover:bg-warning/10 transition-colors"
          >
            Retry
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="h-7 px-3 text-xs font-medium rounded-md border bg-card hover:bg-accent transition-colors"
          >
            <kbd className="mr-1 opacity-60">E</kbd>Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="h-7 px-3 text-xs font-medium rounded-md border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <kbd className="mr-1 opacity-60">D</kbd>Delete
          </button>
        )}
      </div>
    </div>
  );
});

/** Batch action bar — shown at bottom when there are items to batch-approve */
export function BatchBar({
  count,
  onApproveAll,
  onCancel,
}: {
  count: number;
  onApproveAll: () => void;
  onCancel?: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-0 flex items-center gap-3 border-t bg-card p-3">
      <button
        onClick={onApproveAll}
        className="h-8 px-4 text-xs font-medium rounded-md bg-brand text-brand-foreground hover:opacity-90 transition-opacity"
      >
        Approve All ({count})
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          className="h-8 px-4 text-xs font-medium rounded-md border bg-card hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
