/**
 * PLAN.md parser and writer.
 * Parses section-per-action format (### A-XX: Title) into action objects.
 * Permissive on input, strict on output. Zero runtime dependencies.
 */

export interface Action {
  id: string;
  title: string;
  description: string;
  status: string;
  produces?: string;
  dependsOn: string[];
  files?: string[];
  verify?: string;
  done?: string;
  wave?: number;
}

export interface PlanMeta {
  successCriteria?: string[];
  mustHaves?: string[];
  truths?: string[];
  artifacts?: { path: string; provides: string }[];
  keyLinks?: { from: string; to: string; via: string }[];
}

function extractField(lines: string[], field: string): string | null {
  const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, 'i');
  const line = lines.find(l => pattern.test(l.trim()));
  if (!line) return null;
  return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, '').trim();
}

function splitMulti(value: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/** Parse list items (- item) following a heading, until the next heading or section */
function parseListItems(lines: string[], startIdx: number): string[] {
  const items: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ') || line.startsWith('### ')) break;
    if (line.startsWith('**') && line.includes(':**')) break;
    const match = line.match(/^[-*]\s+(.+)/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

export function parsePlanFile(content: string): { actions: Action[]; meta: PlanMeta } {
  if (!content?.trim()) return { actions: [], meta: {} };

  // Parse plan-level meta (between # Plan: and ## Actions)
  const meta: PlanMeta = {};
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## Actions')) break;
    if (/^\*\*Success Criteria:\*\*/i.test(line)) {
      meta.successCriteria = parseListItems(lines, i + 1);
    }
    if (/^\*\*Must Haves:\*\*/i.test(line)) {
      meta.mustHaves = parseListItems(lines, i + 1);
    }
    if (/^\*\*Truths:\*\*/i.test(line)) {
      meta.truths = parseListItems(lines, i + 1);
    }
    if (/^\*\*Artifacts:\*\*/i.test(line)) {
      const items = parseListItems(lines, i + 1);
      meta.artifacts = items.map(item => {
        const match = item.match(/^`([^`]+)`\s*[-—]\s*(.+)/);
        if (match) return { path: match[1], provides: match[2].trim() };
        return { path: item, provides: "" };
      });
    }
    if (/^\*\*Key Links:\*\*/i.test(line)) {
      const items = parseListItems(lines, i + 1);
      meta.keyLinks = items.map(item => {
        const match = item.match(/from:\s*`?([^`>]+)`?\s*->\s*to:\s*`?([^`>]+)`?\s*->\s*via:\s*(.+)/i);
        if (match) return { from: match[1].trim(), to: match[2].trim(), via: match[3].trim() };
        return { from: item, to: "", via: "" };
      });
    }
  }

  const sections = content.split(/^### /m).slice(1);

  const actions = sections
    .map(section => {
      const sLines = section.trim().split('\n');
      const match = sLines[0].match(/^(A-\d+):\s*(.+)/);
      if (!match) return null;

      const description = sLines.slice(1)
        .filter(l => !l.trim().startsWith('**'))
        .map(l => l.trim())
        .filter(Boolean)
        .join('\n');

      const produces = extractField(sLines, 'Produces') || undefined;
      const filesRaw = extractField(sLines, 'Files');
      const files = filesRaw ? splitMulti(filesRaw) : undefined;
      const verify = extractField(sLines, 'Verify') || undefined;
      const done = extractField(sLines, 'Done') || undefined;
      const waveRaw = extractField(sLines, 'Wave');
      const wave = waveRaw ? parseInt(waveRaw, 10) : undefined;

      return {
        id: match[1],
        title: match[2].trim(),
        description,
        status: (extractField(sLines, 'Status') || 'PENDING').toUpperCase(),
        ...(produces ? { produces } : {}),
        dependsOn: splitMulti(extractField(sLines, 'Depends On') || ''),
        ...(files ? { files } : {}),
        ...(verify ? { verify } : {}),
        ...(done ? { done } : {}),
        ...(wave !== undefined && !isNaN(wave) ? { wave } : {}),
      } satisfies Action;
    })
    .filter((a): a is Action => a !== null);

  return { actions, meta };
}

export function writePlanFile(actions: Action[], milestoneId: string, milestoneTitle: string, meta?: PlanMeta): string {
  const lines = [
    `# Plan: ${milestoneId} -- ${milestoneTitle}`,
    '',
  ];

  if (meta?.successCriteria?.length) {
    lines.push('**Success Criteria:**');
    for (const c of meta.successCriteria) lines.push(`- ${c}`);
    lines.push('');
  }

  if (meta?.mustHaves?.length) {
    lines.push('**Must Haves:**');
    for (const m of meta.mustHaves) lines.push(`- ${m}`);
    lines.push('');
  }

  // Structured must-haves
  if (meta?.truths?.length || meta?.artifacts?.length || meta?.keyLinks?.length) {
    lines.push('## Must-Haves', '');
  }
  if (meta?.truths?.length) {
    lines.push('**Truths:**');
    for (const t of meta.truths) lines.push(`- ${t}`);
    lines.push('');
  }
  if (meta?.artifacts?.length) {
    lines.push('**Artifacts:**');
    for (const a of meta.artifacts) lines.push(`- \`${a.path}\` — ${a.provides}`);
    lines.push('');
  }
  if (meta?.keyLinks?.length) {
    lines.push('**Key Links:**');
    for (const k of meta.keyLinks) lines.push(`- from: \`${k.from}\` -> to: \`${k.to}\` -> via: ${k.via}`);
    lines.push('');
  }

  lines.push('## Actions', '');

  for (const a of actions) {
    lines.push(`### ${a.id}: ${a.title}`);
    lines.push(`**Status:** ${a.status}`);
    if (a.produces) lines.push(`**Produces:** ${a.produces}`);
    if (a.dependsOn.length > 0) lines.push(`**Depends On:** ${a.dependsOn.join(', ')}`);
    if (a.files?.length) lines.push(`**Files:** ${a.files.join(', ')}`);
    if (a.verify) lines.push(`**Verify:** ${a.verify}`);
    if (a.done) lines.push(`**Done:** ${a.done}`);
    if (a.wave !== undefined) lines.push(`**Wave:** ${a.wave}`);
    if (a.description) lines.push(a.description);
    lines.push('');
  }

  return lines.join('\n');
}
