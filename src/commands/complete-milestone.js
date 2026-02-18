// @ts-check
'use strict';

/**
 * complete-milestone command logic.
 *
 * Archives the current Declare graph snapshot to .planning/milestones/vX.Y/
 * when a milestone version ships. Copies FUTURE.md, MILESTONES.md, and
 * milestone PLAN.md folders to the archive directory.
 *
 * Zero runtime dependencies. CJS module.
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } = require('node:fs');
const { join, basename } = require('node:path');
const { parseFlag } = require('./parse-args');

/**
 * Normalize version string — accepts "1.0" or "v1.0", always returns "v1.0".
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeVersion(raw) {
  return raw.startsWith('v') ? raw : `v${raw}`;
}

/**
 * Recursively copy a directory tree from src to dest.
 *
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {string[]} - List of files copied (relative to src)
 */
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      const subCopied = copyDir(srcPath, destPath);
      for (const f of subCopied) copied.push(join(entry, f));
    } else {
      copyFileSync(srcPath, destPath);
      copied.push(entry);
    }
  }
  return copied;
}

/**
 * Run the complete-milestone command.
 *
 * Accepts:
 *   --version vX.Y  (e.g., --version v1.0 or --version 1.0)
 *
 * Produces:
 *   .planning/milestones/vX.Y/FUTURE.md
 *   .planning/milestones/vX.Y/MILESTONES.md
 *   .planning/milestones/vX.Y/<milestone-folder>/PLAN.md  (for each M-XX folder)
 *
 * Returns:
 *   { version, archivedFiles, gitTagReady }
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string[]} args - CLI arguments (--version vX.Y)
 * @returns {{ version: string, archivedFiles: string[], gitTagReady: boolean } | { error: string }}
 */
function runCompleteMilestone(cwd, args) {
  const versionRaw = parseFlag(args, 'version');

  if (!versionRaw) {
    return { error: 'Missing required flag: --version (e.g., --version v1.0)' };
  }

  const version = normalizeVersion(versionRaw);

  const planningDir = join(cwd, '.planning');
  const milestonesDir = join(planningDir, 'milestones');
  const archiveDir = join(milestonesDir, version);

  // Validate project is initialized
  if (!existsSync(planningDir)) {
    return { error: '.planning/ directory not found. Run /declare:init first.' };
  }

  // Reject if archive already exists for this version
  if (existsSync(archiveDir)) {
    return { error: `Archive already exists for ${version} at .planning/milestones/${version}/. Delete it first to re-archive.` };
  }

  const futurePath = join(planningDir, 'FUTURE.md');
  const milestonesFilePath = join(planningDir, 'MILESTONES.md');

  // Validate required source files exist
  if (!existsSync(futurePath)) {
    return { error: 'FUTURE.md not found in .planning/. Cannot archive.' };
  }
  if (!existsSync(milestonesFilePath)) {
    return { error: 'MILESTONES.md not found in .planning/. Cannot archive.' };
  }

  // Create archive directory
  mkdirSync(archiveDir, { recursive: true });

  const archivedFiles = [];

  // Copy FUTURE.md
  const archiveFuture = join(archiveDir, 'FUTURE.md');
  copyFileSync(futurePath, archiveFuture);
  archivedFiles.push(`milestones/${version}/FUTURE.md`);

  // Copy MILESTONES.md
  const archiveMilestones = join(archiveDir, 'MILESTONES.md');
  copyFileSync(milestonesFilePath, archiveMilestones);
  archivedFiles.push(`milestones/${version}/MILESTONES.md`);

  // Copy milestone PLAN.md folders from .planning/milestones/M-XX-* directories
  const milestonesFolderBase = milestonesDir;
  if (existsSync(milestonesFolderBase)) {
    const entries = readdirSync(milestonesFolderBase);
    for (const entry of entries) {
      // Match M-XX-* folders (not version archive dirs)
      if (/^M-\d+/.test(entry)) {
        const srcFolder = join(milestonesFolderBase, entry);
        const stat = statSync(srcFolder);
        if (stat.isDirectory()) {
          const destFolder = join(archiveDir, entry);
          const copied = copyDir(srcFolder, destFolder);
          for (const f of copied) {
            archivedFiles.push(`milestones/${version}/${entry}/${f}`);
          }
        }
      }
    }
  }

  return {
    version,
    archivedFiles,
    gitTagReady: true,
  };
}

module.exports = { runCompleteMilestone };
