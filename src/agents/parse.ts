/**
 * Helpers to extract structured data from Claude responses.
 * Handles markdown code fences, tables, action sections, and verification reports.
 */

import type { Action } from "../core/artifacts/plan";

export interface VerificationArtifact {
  path: string;
  exists: string;
  substantive: string;
  wired: string;
  notes: string;
}

export interface VerificationGap {
  description: string;
  impact: string;
  fix: string;
}

export interface VerificationReport {
  verdict: "VERIFIED" | "GAPS_FOUND";
  milestoneId: string;
  condition: string;
  artifacts: VerificationArtifact[];
  gaps: VerificationGap[];
  evidence: string[];
}

/**
 * Extract JSON from a Claude response. Handles ```json fences.
 */
export function extractJSON<T>(text: string): T {
  // Try to find JSON in a code fence first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

/**
 * Extract markdown table rows into objects keyed by header names.
 */
export function extractTableRows(text: string): Record<string, string>[] {
  const lines = text
    .split("\n")
    .filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return [];

  const raw = lines[0].split("|").map((h) => h.trim());
  const headers = raw.slice(1, raw.length - 1);

  return lines.slice(2).map((line) => {
    const raw = line.split("|").map((c) => c.trim());
    const cells = raw.slice(1, raw.length - 1);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] || "").trim();
    });
    return row;
  });
}

/**
 * Extract action sections (### A-XX: Title) from Claude response.
 * Returns Action objects compatible with plan.ts.
 */
export function extractActions(text: string): Action[] {
  const sections = text.split(/^### /m).slice(1);

  return sections
    .map((section) => {
      const lines = section.trim().split("\n");
      const match = lines[0].match(/^(A-[\w-]+):\s*(.+)/);
      if (!match) return null;

      const getField = (field: string): string | null => {
        const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, "i");
        const idx = lines.findIndex((l) => pattern.test(l.trim()));
        if (idx === -1) return null;
        const inline = lines[idx]
          .trim()
          .replace(/^\*\*[^:]+:\*\*\s*/, "")
          .trim();
        if (inline) return inline;
        // Check for list items below the heading
        const listItems: string[] = [];
        for (let j = idx + 1; j < lines.length; j++) {
          const l = lines[j].trim();
          if (l.startsWith("**") || l.startsWith("###")) break;
          const m = l.match(/^[-*]\s+(.+)/);
          if (m) listItems.push(m[1].trim().replace(/^`|`$/g, ""));
          else if (l && !l.startsWith("-")) break;
        }
        return listItems.length > 0 ? listItems.join(", ") : null;
      };

      const splitMulti = (v: string | null): string[] =>
        v
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      // Extract description: lines that aren't field headings, list items under fields, or separators
      const descLines: string[] = [];
      let inFieldList = false;
      for (let j = 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (l.startsWith("**") && l.includes(":**")) { inFieldList = true; continue; }
        if (inFieldList && (l.startsWith("-") || l.startsWith("*") || l === "")) { continue; }
        if (l === "---") { inFieldList = false; continue; }
        inFieldList = false;
        if (l) descLines.push(l);
      }
      const description = descLines.join("\n");

      const filesRaw = getField("Files");
      const waveRaw = getField("Wave");
      const wave = waveRaw ? parseInt(waveRaw, 10) : undefined;

      return {
        id: match[1],
        title: match[2].trim(),
        description,
        status: (getField("Status") || "PENDING").toUpperCase(),
        dependsOn: splitMulti(getField("Depends On")),
        ...(getField("Produces") ? { produces: getField("Produces")! } : {}),
        ...(filesRaw ? { files: splitMulti(filesRaw) } : {}),
        ...(getField("Verify") ? { verify: getField("Verify")! } : {}),
        ...(getField("Done") ? { done: getField("Done")! } : {}),
        ...(wave !== undefined && !isNaN(wave) ? { wave } : {}),
      } satisfies Action;
    })
    .filter((a): a is Action => a !== null);
}

/**
 * Parse a verification report from Claude's markdown output.
 */
export function parseVerificationReport(text: string): VerificationReport | null {
  // Extract verdict
  const verdictMatch = text.match(/\*\*Verdict\*\*:\s*(VERIFIED|GAPS_FOUND)/);
  if (!verdictMatch) return null;

  const verdict = verdictMatch[1] as "VERIFIED" | "GAPS_FOUND";

  // Extract milestone ID from ## M-XX: heading
  const milestoneMatch = text.match(/^##\s+(M-\d+)/m);
  const milestoneId = milestoneMatch ? milestoneMatch[1] : "";

  // Extract condition
  const conditionMatch = text.match(/\*\*Condition\*\*:\s*(.+)/);
  const condition = conditionMatch ? conditionMatch[1].trim() : "";

  // Extract artifacts table
  const artifactsSection = text.match(/### Artifacts\n([\s\S]*?)(?=\n###|$)/);
  const artifacts: VerificationArtifact[] = [];
  if (artifactsSection) {
    const rows = extractTableRows(artifactsSection[1]);
    for (const row of rows) {
      artifacts.push({
        path: row["Path"] || "",
        exists: row["Exists"] || "",
        substantive: row["Substantive"] || "",
        wired: row["Wired"] || "",
        notes: row["Notes"] || "",
      });
    }
  }

  // Extract gaps
  const gaps: VerificationGap[] = [];
  const gapsSection = text.match(/### Gaps Found[\s\S]*?(?=\n##[^#]|$)/i);
  if (gapsSection) {
    const gapBlocks = gapsSection[0].split(/^- \*\*Gap\*\*:\s*/m).slice(1);
    for (const block of gapBlocks) {
      const lines = block.trim().split("\n");
      const description = lines[0]?.trim() || "";
      const impactMatch = block.match(/\*\*Impact\*\*:\s*(.+)/);
      const fixMatch = block.match(/\*\*Fix\*\*:\s*(.+)/);
      gaps.push({
        description,
        impact: impactMatch ? impactMatch[1].trim() : "",
        fix: fixMatch ? fixMatch[1].trim() : "",
      });
    }
  }

  // Extract evidence
  const evidence: string[] = [];
  const evidenceSection = text.match(/### Evidence Checked\n([\s\S]*?)(?=\n###|$)/);
  if (evidenceSection) {
    const lines = evidenceSection[1].trim().split("\n");
    for (const line of lines) {
      const m = line.match(/^\d+\.\s+(.+)/);
      if (m) evidence.push(m[1].trim());
    }
  }

  return { verdict, milestoneId, condition, artifacts, gaps, evidence };
}
