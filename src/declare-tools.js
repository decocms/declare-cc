#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * declare-tools.js - CLI entry point for Declare.
 *
 * Subcommand dispatch pattern forked from GSD's gsd-tools.cjs.
 * Bundled via esbuild into dist/declare-tools.cjs for distribution.
 *
 * Usage: node declare-tools.js <command> [args...]
 *
 * Commands:
 *   commit <message> --files <file1> [file2...]  - Atomic git commit for planning docs
 *   init [project-name]                           - Initialize Declare project
 *   status                                        - Show graph status and health
 *   add-declaration --title "..." --statement "." - Add declaration to FUTURE.md
 *   add-milestone --title "..." --realizes D-01   - Add milestone to MILESTONES.md
 *   add-action --title "..." --causes M-01        - Add action to MILESTONES.md
 *   load-graph                                    - Load full graph as JSON
 *   quick-task --description "..." [--slug "..."] - Create quick task folder
 *   add-todo --description "..."                  - Capture a todo
 *   check-todos                                   - List pending todos
 *   complete-todo --id NNN                        - Move todo to completed/
 *   help                                          - Show available commands
 */

const { commitPlanningDocs } = require('./git/commit');
const { readState, recordSession } = require('./artifacts/state');
const { runInit } = require('./commands/init');
const { runStatus } = require('./commands/status');
const { runHelp } = require('./commands/help');
const { runAddDeclaration } = require('./commands/add-declaration');
const { runAddMilestone } = require('./commands/add-milestone');
const { runAddMilestonesBatch } = require('./commands/add-milestones-batch');
const { runAddAction } = require('./commands/add-action');
const { runCreatePlan } = require('./commands/create-plan');
const { runLoadGraph } = require('./commands/load-graph');
const { runTrace } = require('./commands/trace');
const { runPrioritize } = require('./commands/prioritize');
const { runVisualize } = require('./commands/visualize');
const { runComputeWaves } = require('./commands/compute-waves');
const { runGenerateExecPlan } = require('./commands/generate-exec-plan');
const { runVerifyWave } = require('./commands/verify-wave');
const { runExecute } = require('./commands/execute');
const { runVerifyMilestone } = require('./commands/verify-milestone');
const { runCheckDrift } = require('./commands/check-drift');
const { runCheckOccurrence } = require('./commands/check-occurrence');
const { runComputePerformance } = require('./commands/compute-performance');
const { runRenegotiate } = require('./commands/renegotiate');
const { runCompleteMilestone } = require('./commands/complete-milestone');
const { runQuickTask } = require('./commands/quick-task');
const { runAddTodo, runCheckTodos, runCompleteTodo } = require('./commands/todo');
const { runConfigGet } = require('./commands/config-get');
const { runConfigSet } = require('./commands/config-set');
const { runHealthCheck, runHealthCheckRepair } = require('./commands/health-check');

/**
 * Parse --cwd flag from argv.
 * @param {string[]} argv
 * @returns {string | null}
 */
function parseCwdFlag(argv) {
  const idx = argv.indexOf('--cwd');
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

/**
 * Extract positional arguments from argv, stripping known flags and their values.
 * Strips: --cwd <value>, --files <values...>
 * @param {string[]} argv - Arguments after the subcommand (e.g., args.slice(1))
 * @returns {string[]}
 */
function parsePositionalArgs(argv) {
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--cwd') {
      i += 2; // skip flag and value
    } else if (argv[i] === '--files') {
      i++; // skip flag
      while (i < argv.length && !argv[i].startsWith('--')) i++; // skip file values
    } else if (argv[i].startsWith('--')) {
      i++; // skip unknown flag
    } else {
      positional.push(argv[i]);
      i++;
    }
  }
  return positional;
}

/**
 * Parse --files flag from argv.
 * Collects everything after --files until next flag (starts with --) or end.
 * @param {string[]} argv
 * @returns {string[]}
 */
function parseFilesFlag(argv) {
  const idx = argv.indexOf('--files');
  if (idx === -1) return [];

  const files = [];
  for (let i = idx + 1; i < argv.length; i++) {
    if (argv[i].startsWith('--')) break;
    files.push(argv[i]);
  }
  return files;
}

/**
 * Parse a named flag value from argv.
 * @param {string[]} argv
 * @param {string} flag - e.g. '--stopped-at'
 * @returns {string | null}
 */
function parseNamedFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

/**
 * Main entry point. Dispatches to subcommands.
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(JSON.stringify({ error: 'No command specified. Use: commit, init, status, add-declaration, add-milestone, add-milestones, create-plan, load-graph, trace, prioritize, visualize, compute-waves, generate-exec-plan, verify-wave, verify-milestone, execute, check-drift, check-occurrence, compute-performance, renegotiate, complete-milestone, record-session, get-state, quick-task, add-todo, check-todos, complete-todo, help' }));
    process.exit(1);
  }

  try {
    switch (command) {
      case 'commit': {
        const message = args[1];
        if (!message) {
          console.log(JSON.stringify({ error: 'commit requires a message argument' }));
          process.exit(1);
        }
        const files = parseFilesFlag(args);
        const cwd = process.cwd();
        const result = commitPlanningDocs(cwd, message, files);
        console.log(JSON.stringify(result));
        process.exit(result.committed || result.reason === 'nothing_to_commit' ? 0 : 1);
        break;
      }

      case 'init': {
        const cwdInit = parseCwdFlag(args) || process.cwd();
        const initArgs = parsePositionalArgs(args.slice(1));
        const result = runInit(cwdInit, initArgs);
        console.log(JSON.stringify(result));
        break;
      }

      case 'status': {
        const cwdStatus = parseCwdFlag(args) || process.cwd();
        const result = runStatus(cwdStatus);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'help': {
        const result = runHelp();
        console.log(JSON.stringify(result));
        break;
      }

      case 'add-declaration': {
        const cwdAddDecl = parseCwdFlag(args) || process.cwd();
        const result = runAddDeclaration(cwdAddDecl, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'add-milestone': {
        const cwdAddMs = parseCwdFlag(args) || process.cwd();
        const result = runAddMilestone(cwdAddMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'add-milestones': {
        const cwdAddMsBatch = parseCwdFlag(args) || process.cwd();
        const result = runAddMilestonesBatch(cwdAddMsBatch, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'add-action': {
        const cwdAddAct = parseCwdFlag(args) || process.cwd();
        const result = runAddAction(cwdAddAct, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'create-plan': {
        const cwdCreatePlan = parseCwdFlag(args) || process.cwd();
        const result = runCreatePlan(cwdCreatePlan, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'load-graph': {
        const cwdLoadGraph = parseCwdFlag(args) || process.cwd();
        const result = runLoadGraph(cwdLoadGraph);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'trace': {
        const cwdTrace = parseCwdFlag(args) || process.cwd();
        const result = runTrace(cwdTrace, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'prioritize': {
        const cwdPrioritize = parseCwdFlag(args) || process.cwd();
        const result = runPrioritize(cwdPrioritize, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'visualize': {
        const cwdVisualize = parseCwdFlag(args) || process.cwd();
        const result = runVisualize(cwdVisualize, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'compute-waves': {
        const cwdComputeWaves = parseCwdFlag(args) || process.cwd();
        const result = runComputeWaves(cwdComputeWaves, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'generate-exec-plan': {
        const cwdGenExecPlan = parseCwdFlag(args) || process.cwd();
        const result = runGenerateExecPlan(cwdGenExecPlan, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'verify-wave': {
        const cwdVerifyWave = parseCwdFlag(args) || process.cwd();
        const result = runVerifyWave(cwdVerifyWave, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'execute': {
        const cwdExecute = parseCwdFlag(args) || process.cwd();
        const result = runExecute(cwdExecute, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'verify-milestone': {
        const cwdVerifyMs = parseCwdFlag(args) || process.cwd();
        const result = runVerifyMilestone(cwdVerifyMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'check-drift': {
        const cwdCheckDrift = parseCwdFlag(args) || process.cwd();
        const result = runCheckDrift(cwdCheckDrift);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'check-occurrence': {
        const cwdCheckOcc = parseCwdFlag(args) || process.cwd();
        const result = runCheckOccurrence(cwdCheckOcc, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'compute-performance': {
        const cwdCompPerf = parseCwdFlag(args) || process.cwd();
        const result = runComputePerformance(cwdCompPerf);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'renegotiate': {
        const cwdReneg = parseCwdFlag(args) || process.cwd();
        const result = runRenegotiate(cwdReneg, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'complete-milestone': {
        const cwdCompMs = parseCwdFlag(args) || process.cwd();
        const result = runCompleteMilestone(cwdCompMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'record-session': {
        const cwdRecordSession = parseCwdFlag(args) || process.cwd();
        const stoppedAt = parseNamedFlag(args, '--stopped-at');
        const resumeFile = parseNamedFlag(args, '--resume-file');
        if (!stoppedAt) {
          console.log(JSON.stringify({ error: 'record-session requires --stopped-at argument' }));
          process.exit(1);
        }
        const result = recordSession(cwdRecordSession, stoppedAt, resumeFile || undefined);
        console.log(JSON.stringify(result));
        if (!result.ok) process.exit(1);
        break;
      }

      case 'get-state': {
        const cwdGetState = parseCwdFlag(args) || process.cwd();
        const result = readState(cwdGetState);
        if (result === null) {
          console.log(JSON.stringify({ error: 'STATE.md not found. Run /declare:new-project to initialize.' }));
          process.exit(1);
        }
        console.log(JSON.stringify(result));
        break;
      }

      case 'quick-task': {
        const cwdQuickTask = parseCwdFlag(args) || process.cwd();
        const result = runQuickTask(cwdQuickTask, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'add-todo': {
        const cwdAddTodo = parseCwdFlag(args) || process.cwd();
        const result = runAddTodo(cwdAddTodo, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'check-todos': {
        const cwdCheckTodos = parseCwdFlag(args) || process.cwd();
        const result = runCheckTodos(cwdCheckTodos);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      case 'complete-todo': {
        const cwdCompleteTodo = parseCwdFlag(args) || process.cwd();
        const result = runCompleteTodo(cwdCompleteTodo, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }

      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use: commit, init, status, add-declaration, add-milestone, add-milestones, create-plan, load-graph, trace, prioritize, visualize, compute-waves, generate-exec-plan, verify-wave, verify-milestone, execute, check-drift, check-occurrence, compute-performance, renegotiate, complete-milestone, record-session, get-state, quick-task, add-todo, check-todos, complete-todo, help` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
    process.exit(1);
  }
}

main();
