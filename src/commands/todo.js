// @ts-check
'use strict';

/**
 * todo command logic.
 *
 * Manages todo items captured during sessions.
 * Todos live in .planning/todos/ as NNN-slug.md files.
 * Completed todos are moved to .planning/todos/completed/.
 *
 * Zero runtime dependencies. CJS module.
 */

const {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  renameSync,
} = require('node:fs');
const { join, basename } = require('node:path');
const { commitPlanningDocs, loadConfig } = require('../git/commit');
const { parseFlag } = require('./parse-args');

/**
 * Generate a URL-safe slug from a description string.
 *
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

/**
 * Determine the next sequential number for a todo file.
 * Scans .planning/todos/ for existing NNN-*.md files (excluding completed/).
 *
 * @param {string} todosDir - Path to .planning/todos/
 * @returns {string} Zero-padded three-digit number, e.g. "001"
 */
function nextTodoNumber(todosDir) {
  if (!existsSync(todosDir)) return '001';

  const entries = readdirSync(todosDir, { withFileTypes: true });
  let max = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const match = entry.name.match(/^(\d{3})-/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  // Also scan completed/ to avoid ID collisions
  const completedDir = join(todosDir, 'completed');
  if (existsSync(completedDir)) {
    const completed = readdirSync(completedDir, { withFileTypes: true });
    for (const entry of completed) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const match = entry.name.match(/^(\d{3})-/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    }
  }

  return String(max + 1).padStart(3, '0');
}

/**
 * Parse the description from a todo markdown file.
 * Reads the first H1 heading (# ...) as title and extracts created date from frontmatter.
 *
 * @param {string} content - File content
 * @returns {{ description: string, created: string }}
 */
function parseTodoFile(content) {
  const lines = content.split('\n');
  let description = '';
  let created = '';

  // Extract created date from frontmatter (--- ... ---)
  if (lines[0] === '---') {
    let i = 1;
    while (i < lines.length && lines[i] !== '---') {
      const createdMatch = lines[i].match(/^created:\s*(.+)$/);
      if (createdMatch) created = createdMatch[1].trim();
      i++;
    }
  }

  // Extract description from first H1
  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      description = h1Match[1].trim();
      break;
    }
  }

  return { description, created };
}

/**
 * Run the add-todo command.
 * Creates a new todo file at .planning/todos/NNN-slug.md.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--description)
 * @returns {{ id: string, path: string, committed: boolean, hash?: string } | { error: string }}
 */
function runAddTodo(cwd, args) {
  const description = parseFlag(args, 'description');

  if (!description) {
    return { error: 'Missing required flag: --description' };
  }

  const todosDir = join(cwd, '.planning', 'todos');

  // Ensure .planning/todos/ exists
  if (!existsSync(todosDir)) {
    mkdirSync(todosDir, { recursive: true });
  }

  const num = nextTodoNumber(todosDir);
  const slug = slugify(description);
  const fileName = `${num}-${slug}.md`;
  const filePath = join(todosDir, fileName);
  const relPath = `.planning/todos/${fileName}`;

  const today = new Date().toISOString().slice(0, 10);
  const content = [
    '---',
    `created: ${today}`,
    'status: pending',
    '---',
    '',
    `# ${description}`,
    '',
    '## Notes',
    '',
    '<!-- Add context and notes here -->',
    '',
  ].join('\n');

  writeFileSync(filePath, content, 'utf-8');

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: add todo ${num} "${description}"`,
      [relPath]
    );
    committed = result.committed;
    hash = result.hash;
  }

  return {
    id: num,
    path: relPath,
    committed,
    hash,
  };
}

/**
 * Run the check-todos command.
 * Returns all pending todos from .planning/todos/*.md.
 *
 * @param {string} cwd - Working directory (project root)
 * @returns {{ todos: Array<{ id: string, description: string, created: string, path: string }> } | { error: string }}
 */
function runCheckTodos(cwd) {
  const todosDir = join(cwd, '.planning', 'todos');

  if (!existsSync(todosDir)) {
    return { todos: [] };
  }

  const entries = readdirSync(todosDir, { withFileTypes: true });
  const todos = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

    const match = entry.name.match(/^(\d{3})-/);
    if (!match) continue;

    const id = match[1];
    const filePath = join(todosDir, entry.name);
    const relPath = `.planning/todos/${entry.name}`;

    let content = '';
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const { description, created } = parseTodoFile(content);

    todos.push({
      id,
      description: description || entry.name.replace(/^\d{3}-/, '').replace(/\.md$/, '').replace(/-/g, ' '),
      created: created || '',
      path: relPath,
    });
  }

  // Sort by ID ascending
  todos.sort((a, b) => a.id.localeCompare(b.id));

  return { todos };
}

/**
 * Run the complete-todo command.
 * Moves a todo from .planning/todos/NNN-slug.md to .planning/todos/completed/.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--id NNN)
 * @returns {{ id: string, from: string, to: string, committed: boolean, hash?: string } | { error: string }}
 */
function runCompleteTodo(cwd, args) {
  const id = parseFlag(args, 'id');

  if (!id) {
    return { error: 'Missing required flag: --id' };
  }

  const todosDir = join(cwd, '.planning', 'todos');

  if (!existsSync(todosDir)) {
    return { error: `No todos directory found at .planning/todos/` };
  }

  // Find the todo file by ID prefix
  const entries = readdirSync(todosDir, { withFileTypes: true });
  let todoFile = null;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name.startsWith(`${id}-`) || entry.name === `${id}.md`) {
      todoFile = entry.name;
      break;
    }
  }

  if (!todoFile) {
    return { error: `Todo with ID ${id} not found in .planning/todos/` };
  }

  const completedDir = join(todosDir, 'completed');
  if (!existsSync(completedDir)) {
    mkdirSync(completedDir, { recursive: true });
  }

  const fromPath = join(todosDir, todoFile);
  const toPath = join(completedDir, todoFile);
  const relFrom = `.planning/todos/${todoFile}`;
  const relTo = `.planning/todos/completed/${todoFile}`;

  renameSync(fromPath, toPath);

  // Commit if configured
  const config = loadConfig(cwd);
  let committed = false;
  let hash;

  if (config.commit_docs !== false) {
    const result = commitPlanningDocs(
      cwd,
      `declare: complete todo ${id}`,
      [relTo]
    );
    committed = result.committed;
    hash = result.hash;
  }

  return {
    id,
    from: relFrom,
    to: relTo,
    committed,
    hash,
  };
}

module.exports = { runAddTodo, runCheckTodos, runCompleteTodo };
