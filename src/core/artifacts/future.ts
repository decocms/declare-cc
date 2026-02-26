/**
 * FUTURE.md parser and writer.
 * Parses section-card format (## D-XX: Title) into declaration objects.
 * Permissive on input, strict on output. Zero runtime dependencies.
 */

export interface Declaration {
  id: string;
  title: string;
  statement: string;
  why: string;
  review: string;
}

function extractField(lines: string[], field: string): string | null {
  const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, 'i');
  const line = lines.find(l => pattern.test(l.trim()));
  if (!line) return null;
  return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, '').trim();
}

export function parseFutureFile(content: string): Declaration[] {
  if (!content?.trim()) return [];

  const sections = content.split(/^## /m).slice(1);
  const declarations: Declaration[] = [];

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const match = lines[0].match(/^(D-\d+):\s*(.+)/);
    if (!match) continue;

    declarations.push({
      id: match[1],
      title: match[2].trim(),
      statement: extractField(lines, 'Statement') || '',
      why: extractField(lines, 'Why') || '',
      review: extractField(lines, 'Review') || 'draft',
    });
  }

  return declarations;
}

export function writeFutureFile(declarations: Declaration[], projectName: string): string {
  const lines = [`# Future: ${projectName}`, ''];

  for (const d of declarations) {
    lines.push(`## ${d.id}: ${d.title}`);
    lines.push(`**Statement:** ${d.statement}`);
    lines.push(`**Why:** ${d.why}`);
    lines.push(`**Review:** ${d.review || 'draft'}`);
    lines.push('');
  }

  return lines.join('\n');
}
