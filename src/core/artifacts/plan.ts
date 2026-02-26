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

export function parsePlanFile(content: string): Action[] {
  if (!content?.trim()) return [];

  const sections = content.split(/^### /m).slice(1);

  return sections
    .map(section => {
      const lines = section.trim().split('\n');
      const match = lines[0].match(/^(A-\d+):\s*(.+)/);
      if (!match) return null;

      const description = lines.slice(1)
        .filter(l => !l.trim().startsWith('**'))
        .map(l => l.trim())
        .filter(Boolean)
        .join('\n');

      const produces = extractField(lines, 'Produces') || undefined;

      return {
        id: match[1],
        title: match[2].trim(),
        description,
        status: (extractField(lines, 'Status') || 'PENDING').toUpperCase(),
        ...(produces ? { produces } : {}),
        dependsOn: splitMulti(extractField(lines, 'Depends On') || ''),
      } satisfies Action;
    })
    .filter((a): a is Action => a !== null);
}

export function writePlanFile(actions: Action[], milestoneId: string, milestoneTitle: string): string {
  const lines = [
    `# Plan: ${milestoneId} -- ${milestoneTitle}`,
    '',
    '## Actions',
    '',
  ];

  for (const a of actions) {
    lines.push(`### ${a.id}: ${a.title}`);
    lines.push(`**Status:** ${a.status}`);
    if (a.produces) lines.push(`**Produces:** ${a.produces}`);
    if (a.dependsOn.length > 0) lines.push(`**Depends On:** ${a.dependsOn.join(', ')}`);
    if (a.description) lines.push(a.description);
    lines.push('');
  }

  return lines.join('\n');
}
