import type { VerificationReport as Report } from "../../agents/parse";

interface Props {
  report: Report;
  onMarkKept?: () => void;
  onReplan?: () => void;
}

export function VerificationReport({ report, onMarkKept, onReplan }: Props) {
  const isVerified = report.verdict === "VERIFIED";

  return (
    <div className="space-y-3">
      {/* Verdict banner */}
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
          isVerified
            ? "bg-success/10 text-success border border-success/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}
      >
        <span>{isVerified ? "✓" : "✗"}</span>
        <span>{report.verdict}</span>
        {report.milestoneId && (
          <span className="ml-auto text-xs opacity-70 font-mono">{report.milestoneId}</span>
        )}
      </div>

      {/* Condition */}
      {report.condition && (
        <p className="text-xs text-muted-foreground italic">{report.condition}</p>
      )}

      {/* Artifacts table */}
      {report.artifacts.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Artifacts</p>
          <div className="rounded border text-[11px]">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="text-left px-2 py-1 font-medium">Path</th>
                  <th className="text-center px-2 py-1 font-medium w-12">Exists</th>
                  <th className="text-center px-2 py-1 font-medium w-16">Subst.</th>
                  <th className="text-center px-2 py-1 font-medium w-12">Wired</th>
                </tr>
              </thead>
              <tbody>
                {report.artifacts.map((a, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-2 py-1 font-mono truncate max-w-[140px]" title={a.path}>
                      {a.path}
                    </td>
                    <td className="text-center px-2 py-1">
                      <StatusDot value={a.exists} />
                    </td>
                    <td className="text-center px-2 py-1">
                      <StatusDot value={a.substantive} />
                    </td>
                    <td className="text-center px-2 py-1">
                      <StatusDot value={a.wired} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gaps */}
      {report.gaps.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase text-destructive mb-1">
            Gaps ({report.gaps.length})
          </p>
          <div className="space-y-2">
            {report.gaps.map((g, i) => (
              <div key={i} className="rounded border border-destructive/20 bg-destructive/5 p-2 text-xs">
                <p className="font-medium text-destructive">{g.description}</p>
                {g.impact && (
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium">Impact:</span> {g.impact}
                  </p>
                )}
                {g.fix && (
                  <p className="mt-0.5 text-muted-foreground">
                    <span className="font-medium">Fix:</span> {g.fix}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      {report.evidence.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Evidence</p>
          <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside">
            {report.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex gap-2 pt-1">
        {isVerified && onMarkKept && (
          <button
            onClick={onMarkKept}
            className="h-7 px-3 text-xs font-medium rounded-md bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
          >
            Mark as KEPT
          </button>
        )}
        {!isVerified && onReplan && (
          <button
            onClick={onReplan}
            className="h-7 px-3 text-xs font-medium rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
          >
            Re-plan
          </button>
        )}
      </div>
    </div>
  );
}

function StatusDot({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const isPositive = lower === "yes" || lower === "true" || lower === "connected";
  const isNegative = lower === "no" || lower === "false" || lower === "stub" || lower === "broken";

  return (
    <span
      className={
        isPositive
          ? "text-success"
          : isNegative
            ? "text-destructive"
            : "text-muted-foreground"
      }
    >
      {isPositive ? "✓" : isNegative ? "✗" : value}
    </span>
  );
}
