import { describe, test, expect } from "vitest";
import { parseVerificationReport } from "../../src/agents/parse";

const VERIFIED_REPORT = `## M-12: Dashboard renders lifecycle graph

**Condition**: The dashboard displays all declarations, milestones, and actions in a connected graph
**Verdict**: VERIFIED

### Artifacts
| Path | Exists | Substantive | Wired | Notes |
|------|--------|-------------|-------|-------|
| src/app/components/lifecycle-view.tsx | yes | yes | yes | Renders full DAG |
| src/app/hooks/use-graph.ts | yes | yes | yes | Fetches from /api/graph |
| src/server/routes/graph.ts | yes | yes | yes | Serves graph data |

### Evidence Checked
1. lifecycle-view.tsx renders nodes and edges -- pass
2. use-graph.ts fetches /api/graph and returns typed data -- pass
3. SSE triggers refetch on change event -- pass

`;

const GAPS_REPORT = `## M-15: Authentication guards all routes

**Condition**: Unauthenticated users cannot access any dashboard route
**Verdict**: GAPS_FOUND

### Artifacts
| Path | Exists | Substantive | Wired | Notes |
|------|--------|-------------|-------|-------|
| src/middleware/auth.ts | yes | STUB | no | Only has TODO comment |
| src/app/routes/__root.tsx | yes | yes | no | No auth check |

### Evidence Checked
1. auth.ts exists but body is empty -- fail
2. __root.tsx has no redirect logic -- fail

### Gaps Found
- **Gap**: Auth middleware is a stub with no implementation
  **Impact**: All routes are publicly accessible
  **Fix**: Implement JWT validation in src/middleware/auth.ts
- **Gap**: Root route has no auth guard
  **Impact**: Dashboard renders for unauthenticated users
  **Fix**: Add useAuth() check in __root.tsx with redirect to /login
`;

describe("parseVerificationReport", () => {
  test("returns null for non-verification text", () => {
    expect(parseVerificationReport("just some random text")).toBeNull();
    expect(parseVerificationReport("**Verdict**: MAYBE")).toBeNull();
  });

  test("parses VERIFIED report", () => {
    const report = parseVerificationReport(VERIFIED_REPORT);
    expect(report).not.toBeNull();
    expect(report!.verdict).toBe("VERIFIED");
    expect(report!.milestoneId).toBe("M-12");
    expect(report!.condition).toBe(
      "The dashboard displays all declarations, milestones, and actions in a connected graph",
    );
    expect(report!.artifacts).toHaveLength(3);
    expect(report!.artifacts[0]).toEqual({
      path: "src/app/components/lifecycle-view.tsx",
      exists: "yes",
      substantive: "yes",
      wired: "yes",
      notes: "Renders full DAG",
    });
    expect(report!.gaps).toHaveLength(0);
    expect(report!.evidence).toHaveLength(3);
    expect(report!.evidence[0]).toContain("lifecycle-view.tsx");
  });

  test("parses GAPS_FOUND report", () => {
    const report = parseVerificationReport(GAPS_REPORT);
    expect(report).not.toBeNull();
    expect(report!.verdict).toBe("GAPS_FOUND");
    expect(report!.milestoneId).toBe("M-15");
    expect(report!.artifacts).toHaveLength(2);
    expect(report!.artifacts[0].substantive).toBe("STUB");
    expect(report!.gaps).toHaveLength(2);
    expect(report!.gaps[0].description).toBe("Auth middleware is a stub with no implementation");
    expect(report!.gaps[0].impact).toBe("All routes are publicly accessible");
    expect(report!.gaps[0].fix).toBe("Implement JWT validation in src/middleware/auth.ts");
    expect(report!.gaps[1].description).toBe("Root route has no auth guard");
    expect(report!.evidence).toHaveLength(2);
  });

  test("extracts condition from Condition line", () => {
    const report = parseVerificationReport(VERIFIED_REPORT);
    expect(report!.condition).toContain("dashboard displays");
  });
});
