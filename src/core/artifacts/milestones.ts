/**
 * MILESTONES.md parser and writer.
 * Parses markdown table format. Permissive on input, strict on output.
 * Zero runtime dependencies.
 */

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: string;
  realizes: string[];
  hasPlan: boolean;
  reviewState: string;
  classification: string;
  dependsOn: string[];
}

function splitMulti(value: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function parseMarkdownTable(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return [];

  const raw = lines[0].split('|').map(h => h.trim());
  const headers = raw.slice(1, raw.length - 1);

  return lines.slice(2).map(line => {
    const raw = line.split('|').map(c => c.trim());
    const cells = raw.slice(1, raw.length - 1);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
    return row;
  });
}

export function parseMilestonesFile(content: string): Milestone[] {
  if (!content?.trim()) return [];

  const match = content.match(/## Milestones\s*\n([\s\S]*?)(?=## |$)/i);
  const rows = match ? parseMarkdownTable(match[1]) : parseMarkdownTable(content);

  return rows
    .map(row => ({
      id: (row['ID'] || '').trim(),
      title: (row['Title'] || '').trim(),
      description: (row['Description'] || '').trim(),
      status: (row['Status'] || 'PENDING').trim().toUpperCase(),
      realizes: splitMulti(row['Realizes'] || ''),
      hasPlan: (row['Plan'] || '').trim().toUpperCase() === 'YES',
      reviewState: (row['Review'] || 'draft').trim() || 'draft',
      classification: (row['Classification'] || 'agent').trim().toLowerCase() === 'human' ? 'human' : 'agent',
      dependsOn: splitMulti(row['Depends On'] || ''),
    }))
    .filter(m => m.id);
}

function pad(str: string, width: number): string {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

function formatTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map(r => (r[i] || '').length);
    return Math.max(h.length, ...cellWidths);
  });

  const headerLine = '| ' + headers.map((h, i) => pad(h, widths[i])).join(' | ') + ' |';
  const separator = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
  const dataLines = rows.map(row =>
    '| ' + row.map((cell, i) => pad(cell, widths[i])).join(' | ') + ' |'
  );

  return [headerLine, separator, ...dataLines];
}

export function writeMilestonesFile(milestones: Milestone[], projectName: string): string {
  const lines = [`# Milestones: ${projectName}`, '', '## Milestones', ''];

  const hasDesc = milestones.some(m => m.description);
  const hasClassification = milestones.some(m => m.classification && m.classification !== 'agent');
  const hasDeps = milestones.some(m => m.dependsOn?.length > 0);

  const headers = ['ID', 'Title'];
  if (hasDesc) headers.push('Description');
  headers.push('Status', 'Realizes', 'Plan', 'Review');
  if (hasClassification) headers.push('Classification');
  if (hasDeps) headers.push('Depends On');

  const mRows = milestones.map(m => {
    const row = [m.id, m.title];
    if (hasDesc) row.push(m.description || '');
    row.push(m.status, m.realizes.join(', '), m.hasPlan ? 'YES' : 'NO', m.reviewState || 'draft');
    if (hasClassification) row.push(m.classification || 'agent');
    if (hasDeps) row.push((m.dependsOn || []).join(', '));
    return row;
  });

  lines.push(...formatTable(headers, mRows), '');
  return lines.join('\n');
}
