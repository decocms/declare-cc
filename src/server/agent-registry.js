// @ts-check
'use strict';

/**
 * Agent registry -- in-memory registry tracking every agent through its
 * full lifecycle (spawn -> running -> complete/fail/interrupted).
 *
 * Single source of truth for "what is the system doing right now."
 * Persists state to .planning/agent-state.json on every lifecycle transition.
 *
 * Zero runtime dependencies. CJS module.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @typedef {{
 *   id: string,
 *   type: string,
 *   target: string,
 *   milestoneId: string,
 *   status: string,
 *   startedAt: string,
 *   updatedAt: string,
 *   completedAt: string|null,
 *   exitCode: number|null,
 *   error: string|null,
 *   result: object|null
 * }} AgentRecord
 */

/** Maximum number of recent agents to keep */
const RECENT_MAX = 50;

/** Maximum age (ms) for recent agents before pruning */
const RECENT_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Create an agent registry that tracks agents through their lifecycle.
 *
 * @param {string} cwd - Project root directory
 * @param {(event: string, data: object) => void} broadcastFn - SSE broadcast callback
 * @returns {{
 *   spawn: (type: string, target: string, milestoneId: string) => AgentRecord,
 *   update: (agentId: string, patch: object) => AgentRecord|null,
 *   complete: (agentId: string, result: object|null) => AgentRecord|null,
 *   fail: (agentId: string, exitCode: number, errorMessage: string) => AgentRecord|null,
 *   get: (agentId: string) => AgentRecord|null,
 *   getActive: () => AgentRecord[],
 *   getRecent: (limit?: number) => AgentRecord[],
 *   getAll: () => { active: AgentRecord[], recent: AgentRecord[] },
 *   markInterrupted: (agentIds: string[]) => void,
 *   loadFromDisk: () => { agents: Record<string, AgentRecord>, recentAgents: AgentRecord[], persistedAt: string }|null
 * }}
 */
function createAgentRegistry(cwd, broadcastFn) {
  /** @type {Map<string, AgentRecord>} */
  const agents = new Map();

  /** @type {AgentRecord[]} */
  let recentAgents = [];

  const statePath = path.join(cwd, '.planning', 'agent-state.json');

  /**
   * Prune recent agents older than RECENT_MAX_AGE_MS.
   */
  function pruneRecent() {
    const cutoff = Date.now() - RECENT_MAX_AGE_MS;
    recentAgents = recentAgents.filter((a) => {
      const ts = a.completedAt || a.updatedAt;
      return new Date(ts).getTime() > cutoff;
    });
  }

  /**
   * Move an agent from active map to recent array.
   * @param {string} agentId
   */
  function moveToRecent(agentId) {
    const record = agents.get(agentId);
    if (!record) return;
    agents.delete(agentId);
    recentAgents.push(record);
    // Enforce max size
    if (recentAgents.length > RECENT_MAX) {
      recentAgents = recentAgents.slice(recentAgents.length - RECENT_MAX);
    }
  }

  /**
   * Persist current state to .planning/agent-state.json.
   * Never throws -- write failures are swallowed.
   */
  function persistState() {
    try {
      const state = {
        agents: Object.fromEntries(agents),
        recentAgents,
        persistedAt: new Date().toISOString(),
      };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (_) {
      // Intentionally swallowed -- persistence must never crash the server
    }
  }

  /**
   * Register a new agent and start tracking it.
   *
   * @param {string} type - "execution" | "derivation" | "action-derivation" | "revision" | "pipeline"
   * @param {string} target - What it operates on: "A-119", "D-16", "M-43", etc.
   * @param {string} milestoneId - Parent milestone if applicable, empty string otherwise
   * @returns {AgentRecord}
   */
  function spawn(type, target, milestoneId) {
    const now = new Date().toISOString();
    const id = `${type.slice(0, 4)}-${target}-${Date.now()}`;

    /** @type {AgentRecord} */
    const record = {
      id,
      type,
      target,
      milestoneId: milestoneId || '',
      status: 'running',
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      exitCode: null,
      error: null,
      result: null,
    };

    agents.set(id, record);
    broadcastFn('agent-start', record);
    persistState();
    return record;
  }

  /**
   * Update an active agent record with a partial patch.
   *
   * @param {string} agentId
   * @param {object} patch - Fields to merge into the record
   * @returns {AgentRecord|null}
   */
  function update(agentId, patch) {
    const record = agents.get(agentId);
    if (!record) return null;

    Object.assign(record, patch, { updatedAt: new Date().toISOString() });
    broadcastFn('agent-update', record);
    persistState();
    return record;
  }

  /**
   * Mark an agent as successfully completed.
   *
   * @param {string} agentId
   * @param {object|null} result - Structured result metadata
   * @returns {AgentRecord|null}
   */
  function complete(agentId, result) {
    const record = agents.get(agentId);
    if (!record) return null;

    const now = new Date().toISOString();
    record.status = 'complete';
    record.completedAt = now;
    record.updatedAt = now;
    record.exitCode = 0;
    record.result = result;

    moveToRecent(agentId);
    broadcastFn('agent-complete', record);
    persistState();
    return record;
  }

  /**
   * Mark an agent as failed.
   *
   * @param {string} agentId
   * @param {number} exitCode
   * @param {string} errorMessage
   * @returns {AgentRecord|null}
   */
  function fail(agentId, exitCode, errorMessage) {
    const record = agents.get(agentId);
    if (!record) return null;

    const now = new Date().toISOString();
    record.status = 'failed';
    record.completedAt = now;
    record.updatedAt = now;
    record.exitCode = exitCode;
    record.error = errorMessage;

    moveToRecent(agentId);
    broadcastFn('agent-complete', record);
    persistState();
    return record;
  }

  /**
   * Get an agent record by ID (from active or recent).
   *
   * @param {string} agentId
   * @returns {AgentRecord|null}
   */
  function get(agentId) {
    const active = agents.get(agentId);
    if (active) return active;
    return recentAgents.find((a) => a.id === agentId) || null;
  }

  /**
   * Return all currently active (running) agents.
   *
   * @returns {AgentRecord[]}
   */
  function getActive() {
    return [...agents.values()];
  }

  /**
   * Return recent completed/failed agents, pruned for staleness.
   *
   * @param {number} [limit=20]
   * @returns {AgentRecord[]}
   */
  function getRecent(limit = 20) {
    pruneRecent();
    return recentAgents.slice(-limit);
  }

  /**
   * Return both active and recent agents.
   *
   * @returns {{ active: AgentRecord[], recent: AgentRecord[] }}
   */
  function getAll() {
    return { active: getActive(), recent: getRecent() };
  }

  /**
   * Mark agents as interrupted (used by restart logic).
   *
   * @param {string[]} agentIds
   */
  function markInterrupted(agentIds) {
    for (const id of agentIds) {
      const record = agents.get(id);
      if (!record) continue;

      const now = new Date().toISOString();
      record.status = 'interrupted';
      record.completedAt = now;
      record.updatedAt = now;

      moveToRecent(id);
    }
    persistState();
  }

  /**
   * Read persisted state from disk. Does NOT modify in-memory state.
   * Never throws.
   *
   * @returns {{ agents: Record<string, AgentRecord>, recentAgents: AgentRecord[], persistedAt: string }|null}
   */
  function loadFromDisk() {
    try {
      const raw = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  return {
    spawn,
    update,
    complete,
    fail,
    get,
    getActive,
    getRecent,
    getAll,
    markInterrupted,
    loadFromDisk,
  };
}

// Self-test when run directly
if (require.main === module) {
  const reg = createAgentRegistry('.', () => {});
  const a = reg.spawn('execution', 'A-01', 'M-01');
  console.log('spawned:', a.id, a.status);
  reg.complete(a.id, { path: 'test.md' });
  console.log('completed:', reg.get(a.id).status);
  console.log('active:', reg.getActive().length);
  console.log('recent:', reg.getRecent().length);
  console.log('OK');
}

module.exports = { createAgentRegistry };
