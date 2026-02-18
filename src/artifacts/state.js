// @ts-check
'use strict';

/**
 * STATE.md reader and writer for Declare projects.
 *
 * Manages the persistent state document that tracks current position,
 * decisions, blockers, and session history across Claude sessions.
 *
 * Zero runtime dependencies. CJS module.
 */

const fs = require('fs');
const path = require('path');

/**
 * Get the path to STATE.md for a given project directory.
 * @param {string} cwd - Project root directory
 * @returns {string}
 */
function statePath(cwd) {
  return path.join(cwd, '.planning', 'STATE.md');
}

/**
 * Read and parse STATE.md from a project directory.
 *
 * Returns a structured object with the key sections parsed out.
 * Returns null if the file does not exist.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ raw: string, currentPosition: string, recentWork: string, decisions: string, blockers: string, sessionHistory: string } | null}
 */
function readState(cwd) {
  const filePath = statePath(cwd);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');

  /**
   * Extract a markdown section by heading.
   * @param {string} text
   * @param {string} heading
   * @returns {string}
   */
  function extractSection(text, heading) {
    const pattern = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=## |$)`, 'i');
    const match = text.match(pattern);
    return match ? match[1].trim() : '';
  }

  return {
    raw,
    currentPosition: extractSection(raw, 'Current Position'),
    recentWork: extractSection(raw, 'Recent Work'),
    decisions: extractSection(raw, 'Decisions Made'),
    blockers: extractSection(raw, 'Blockers'),
    sessionHistory: extractSection(raw, 'Session History'),
  };
}

/**
 * Write STATE.md to a project directory.
 *
 * Accepts a data object with optional fields. Fields not provided
 * are left as empty placeholders. The file is always written in
 * canonical format.
 *
 * @param {string} cwd - Project root directory
 * @param {{ currentPosition?: string, recentWork?: string, decisions?: string, blockers?: string, sessionHistory?: string }} data
 * @returns {void}
 */
function writeState(cwd, data) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const content = buildStateContent(today, data);
  fs.writeFileSync(statePath(cwd), content, 'utf8');
}

/**
 * Build STATE.md content from structured data.
 *
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {{ currentPosition?: string, recentWork?: string, decisions?: string, blockers?: string, sessionHistory?: string }} data
 * @returns {string}
 */
function buildStateContent(date, data) {
  const {
    currentPosition = 'Project initialized',
    recentWork = '(none yet)',
    decisions = '| Decision | Rationale | Date |\n|----------|-----------|------|\n',
    blockers = '(none)',
    sessionHistory = '| Date | Stopped At | Resume File |\n|------|------------|-------------|',
  } = data;

  return [
    '# Project State',
    '',
    `**Last Updated:** ${date}`,
    `**Current Position:** ${currentPosition}`,
    '',
    '## Recent Work',
    '',
    recentWork,
    '',
    '## Decisions Made',
    '',
    decisions,
    '',
    '## Blockers',
    '',
    blockers,
    '',
    '## Session History',
    '',
    sessionHistory,
    '',
  ].join('\n');
}

/**
 * Append a session entry to the Session History table in STATE.md.
 *
 * Creates or updates STATE.md. If the file does not exist, initializes it
 * with the session entry. If it exists, appends the new row to the
 * Session History section.
 *
 * @param {string} cwd - Project root directory
 * @param {string} stoppedAt - Description of where the session stopped
 * @param {string} [resumeFile] - Optional path to resume file or command
 * @returns {{ ok: boolean, path: string }}
 */
function recordSession(cwd, stoppedAt, resumeFile) {
  const today = new Date().toISOString().split('T')[0];
  const resumeValue = resumeFile || '—';
  const newRow = `| ${today} | ${stoppedAt} | ${resumeValue} |`;

  const filePath = statePath(cwd);

  if (!fs.existsSync(filePath)) {
    // Initialize STATE.md with this session entry
    writeState(cwd, {
      currentPosition: stoppedAt,
      sessionHistory: `| Date | Stopped At | Resume File |\n|------|------------|-------------|\n${newRow}`,
    });
    return { ok: true, path: filePath };
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Update "Last Updated" header field
  content = content.replace(
    /\*\*Last Updated:\*\*[^\n]*/,
    `**Last Updated:** ${today}`
  );

  // Update "Current Position" header field
  content = content.replace(
    /\*\*Current Position:\*\*[^\n]*/,
    `**Current Position:** ${stoppedAt}`
  );

  // Append to Session History table
  const sessionTablePattern = /## Session History\s*\n([\s\S]*?)(?=## |$)/i;
  const match = content.match(sessionTablePattern);

  if (match) {
    // Table exists — append row before the end of section
    const existingSection = match[1];
    const updatedSection = existingSection.trimEnd() + '\n' + newRow + '\n';
    content = content.replace(sessionTablePattern, `## Session History\n\n${updatedSection}\n`);
  } else {
    // No Session History section — append it
    content += `\n## Session History\n\n| Date | Stopped At | Resume File |\n|------|------------|-------------|\n${newRow}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, path: filePath };
}

module.exports = { readState, writeState, recordSession };
