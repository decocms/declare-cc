// @ts-check
'use strict';

/**
 * get-exec-plan command.
 *
 * Finds and parses the EXEC-PLAN file for a given action ID.
 * Returns structured data: frontmatter metadata, objective, tasks,
 * success criteria, and whether a SUMMARY.md exists (i.e. was executed).
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { execSync } = require('node:child_process');
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');
const { findMilestoneFolder } = require('../artifacts/milestone-folders');

/**
 * Parse simple YAML frontmatter from EXEC-PLAN content.
 * Handles scalar values, string lists (- item), and nested must_haves.
 *
 * @param {string} fmText - Raw frontmatter text between --- markers
 * @returns {Record<string, any>}
 */
function parseFrontmatter(fmText) {
  const result = {};
  const lines = fmText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
    if (!keyMatch) { i++; continue; }

    const [, key, rest] = keyMatch;

    if (rest.trim() === '') {
      // Could be a block (list or nested map)
      const children = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        const child = lines[i];
        const listItem = child.match(/^\s+-\s+(.*)/);
        const nestedKey = child.match(/^\s+(\w[\w_]*):\s*(.*)/);
        if (listItem) {
          children.push({ type: 'item', value: listItem[1].replace(/^["']|["']$/g, '') });
        } else if (nestedKey) {
          children.push({ type: 'key', key: nestedKey[1], value: nestedKey[2] });
        }
        i++;
      }

      // Group nested keys into objects, plain items into arrays
      if (children.length > 0 && children[0].type === 'item') {
        result[key] = children.map(c => c.value);
      } else if (children.length > 0 && children[0].type === 'key') {
        // nested map — recurse one level (for must_haves)
        result[key] = {};
        let subKey = null;
        let subItems = [];
        for (const c of children) {
          if (c.type === 'key') {
            if (subKey) result[key][subKey] = subItems;
            subKey = c.key;
            subItems = c.value.trim() ? [c.value.replace(/^["']|["']$/g, '')] : [];
          } else if (c.type === 'item') {
            subItems.push(c.value);
          }
        }
        if (subKey) result[key][subKey] = subItems;
      }
    } else {
      result[key] = rest.trim().replace(/^["']|["']$/g, '');
      i++;
    }
  }

  return result;
}

/**
 * Extract text content between an XML-like tag pair (non-greedy).
 * @param {string} content
 * @param {string} tag
 * @returns {string | null}
 */
function extractTag(content, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Parse individual <task> blocks from <tasks> content.
 * @param {string} tasksContent
 * @returns {Array<{type: string, name: string, action: string | null, verify: string | null, done: string | null, howToVerify: string | null, resumeSignal: string | null, whatBuilt: string | null}>}
 */
function parseTasks(tasksContent) {
  const tasks = [];
  const taskRe = /<task([^>]*)>([\s\S]*?)<\/task>/gi;
  let m;

  while ((m = taskRe.exec(tasksContent)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const typeMatch = attrs.match(/type="([^"]+)"/);
    const taskType = typeMatch ? typeMatch[1] : 'auto';

    tasks.push({
      type: taskType,
      name: extractTag(body, 'name') || '',
      action: extractTag(body, 'action'),
      verify: extractTag(body, 'verify'),
      done: extractTag(body, 'done'),
      howToVerify: extractTag(body, 'how-to-verify'),
      resumeSignal: extractTag(body, 'resume-signal'),
      whatBuilt: extractTag(body, 'what-built'),
    });
  }

  return tasks;
}

/**
 * Find the EXEC-PLAN file for a given action ID within a milestone folder.
 *
 * @param {string} milestoneFolder
 * @param {string} actionId - e.g. 'A-01'
 * @returns {string | null} absolute path to EXEC-PLAN file
 */
function findExecPlan(milestoneFolder, actionId) {
  if (!existsSync(milestoneFolder)) return null;
  const entries = readdirSync(milestoneFolder);
  // Match A-01-EXEC-PLAN.md or EXEC-PLAN-01.md patterns
  const match = entries.find(f =>
    f.toUpperCase().startsWith(actionId.toUpperCase() + '-EXEC-PLAN') ||
    f.toUpperCase().startsWith('EXEC-PLAN-' + actionId.replace(/^A-/, ''))
  );
  return match ? join(milestoneFolder, match) : null;
}

/**
 * Resolve which model ran (or will run) an action.
 * Priority: SUMMARY.md frontmatter `model` field → config.json modelAssignment.executor → null.
 *
 * @param {string} cwd
 * @param {string | null} summaryContent
 * @returns {string | null}
 */
function resolveActionModel(cwd, summaryContent) {
  try {
    // Check SUMMARY.md frontmatter for model field
    if (summaryContent) {
      const fmMatch = summaryContent.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fm = parseFrontmatter(fmMatch[1]);
        if (fm.model) return String(fm.model);
      }
    }
    // Fall back to config.json modelAssignment
    const configPath = join(cwd, '.planning', 'config.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return config.modelAssignment?.executor ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract git commits matching a specific action's M-XX-A-YY pattern.
 *
 * @param {string} cwd - Project root (for git log execution)
 * @param {string} actionId - e.g. 'A-59'
 * @param {string} milestoneId - e.g. 'M-28-commit-and-output-linking-per-action'
 * @returns {Array<{sha: string, shortSha: string, message: string, date: string}>}
 */
function getActionCommits(cwd, actionId, milestoneId) {
  try {
    const milestonePrefix = milestoneId.match(/^(M-\d+)/);
    if (!milestonePrefix) return [];

    const grepPattern = `(${milestonePrefix[1]}-${actionId})`;
    const output = execSync(
      `git log --all --oneline --format="%H|%s|%ai" --extended-regexp --grep="${grepPattern}"`,
      { cwd, encoding: 'utf-8', timeout: 5000 }
    );

    const lines = output.trim().split('\n').filter(Boolean);
    return lines.map(line => {
      const [sha, message, date] = line.split('|');
      return {
        sha: sha || '',
        shortSha: (sha || '').slice(0, 7),
        message: message || '',
        date: date || '',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Run the get-exec-plan command.
 *
 * @param {string} cwd
 * @param {string[]} args
 * @returns {object}
 */
function runGetExecPlan(cwd, args) {
  const actionId = parseFlag(args, 'action');
  if (!actionId) {
    return { error: 'Missing --action flag. Usage: get-exec-plan --action A-XX' };
  }

  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;
  const action = dag.getNode(actionId);
  if (!action) return { error: `Action not found: ${actionId}` };

  // Find which milestone this action causes
  const upstreamMilestones = dag.getUpstream(actionId).filter(n => n.type === 'milestone');
  if (upstreamMilestones.length === 0) return { error: `No milestone found for action ${actionId}` };

  const milestone = upstreamMilestones[0];
  const planningDir = join(cwd, '.planning');
  const milestoneFolder = findMilestoneFolder(planningDir, milestone.id);

  if (!milestoneFolder) {
    return { error: `Milestone folder not found for ${milestone.id}` };
  }

  const commits = getActionCommits(cwd, actionId, milestone.id);

  const execPlanPath = findExecPlan(milestoneFolder, actionId);
  if (!execPlanPath) {
    return {
      actionId,
      actionTitle: action.title,
      status: action.status,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      execPlan: null,
      summaryExists: false,
      model: resolveActionModel(cwd, null),
      commits,
    };
  }

  const raw = readFileSync(execPlanPath, 'utf-8');

  // Extract frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : {};

  // Extract body sections
  const objective = extractTag(raw, 'objective');
  const tasksRaw = extractTag(raw, 'tasks');
  const tasks = tasksRaw ? parseTasks(tasksRaw) : [];
  const successCriteria = extractTag(raw, 'success_criteria');
  const verification = extractTag(raw, 'verification');

  // Check if summary exists (action was executed)
  const summaryPath = join(milestoneFolder, `${actionId}-SUMMARY.md`);
  const summaryExists = existsSync(summaryPath);
  const summaryContent = summaryExists ? readFileSync(summaryPath, 'utf-8') : null;

  // Resolve model: prefer SUMMARY.md frontmatter, fall back to config.json
  const model = resolveActionModel(cwd, summaryContent);

  return {
    actionId,
    actionTitle: action.title,
    status: action.status,
    milestoneId: milestone.id,
    milestoneTitle: milestone.title,
    model,
    execPlan: {
      wave: frontmatter.wave ? Number(frontmatter.wave) : null,
      autonomous: frontmatter.autonomous === 'true' || frontmatter.autonomous === true,
      dependsOn: Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [],
      filesModified: Array.isArray(frontmatter.files_modified) ? frontmatter.files_modified : [],
      declarations: Array.isArray(frontmatter.declarations) ? frontmatter.declarations : [],
      mustHaves: frontmatter.must_haves || null,
      objective,
      tasks,
      successCriteria,
      verification,
    },
    summaryExists,
    summaryContent,
    commits,
  };
}

module.exports = { runGetExecPlan };
