/**
 * DeclareDag - Three-layer directed acyclic graph for Declare.
 *
 * Nodes: declarations (D-XX), milestones (M-XX), actions (A-XX)
 * Edges: upward causation only (action->milestone, milestone->declaration)
 *
 * Status state machine:
 *   PENDING -> ACTIVE -> DONE -> KEPT          (verified true)
 *   PENDING -> ACTIVE -> DONE -> BROKEN -> HONORED       (remediation)
 *   PENDING -> ACTIVE -> DONE -> BROKEN -> RENEGOTIATED  (adjusted)
 *
 * Zero runtime dependencies. ES module.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeType = 'declaration' | 'milestone' | 'action';
export type NodeStatus = 'PENDING' | 'ACTIVE' | 'DONE' | 'KEPT' | 'BROKEN' | 'HONORED' | 'RENEGOTIATED';
export type Wholeness = 'whole' | 'partial' | 'broken' | 'pending';

export interface DagNode {
  id: string;
  type: NodeType;
  title: string;
  status: NodeStatus;
  metadata: Record<string, unknown>;
}

export interface DagEdge {
  from: string;
  to: string;
}

export interface ValidationError {
  type: 'orphan' | 'cycle' | 'broken_edge';
  node?: string;
  from?: string;
  to?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFIX_TO_TYPE: Record<string, NodeType> = { D: 'declaration', M: 'milestone', A: 'action' };
const TYPE_TO_PREFIX: Record<NodeType, string> = { declaration: 'D', milestone: 'M', action: 'A' };

const VALID_TYPES = new Set<NodeType>(['declaration', 'milestone', 'action']);
const VALID_STATUSES = new Set<NodeStatus>([
  'PENDING', 'ACTIVE', 'DONE', 'KEPT', 'BROKEN', 'HONORED', 'RENEGOTIATED',
]);

/** Statuses where the node's work is considered completed. */
const COMPLETED_STATUSES = new Set<NodeStatus>(['DONE', 'KEPT', 'HONORED', 'RENEGOTIATED']);

/** Valid upward-causation edges: from-type -> to-type. */
const VALID_EDGE_DIRECTIONS: Partial<Record<NodeType, NodeType>> = {
  action: 'milestone',
  milestone: 'declaration',
};

const ID_PATTERN = /^[DMA]-\d+$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isCompleted(status: NodeStatus): boolean {
  return COMPLETED_STATUSES.has(status);
}

/**
 * Compute wholeness for a group of children.
 * Returns 'pending' if no children, then whole/partial/broken based on child counts.
 */
function aggregateWholeness(children: Set<string>, wholenessMap: Map<string, Wholeness>): Wholeness {
  if (children.size === 0) return 'pending';
  let wholeCount = 0;
  for (const id of children) {
    if (wholenessMap.get(id) === 'whole') wholeCount++;
  }
  if (wholeCount === children.size) return 'whole';
  if (wholeCount > 0) return 'partial';
  return 'broken';
}

// ---------------------------------------------------------------------------
// DeclareDag
// ---------------------------------------------------------------------------

export class DeclareDag {
  readonly nodes = new Map<string, DagNode>();
  /** id -> Set of IDs this node causes/realizes (upward) */
  readonly upEdges = new Map<string, Set<string>>();
  /** id -> Set of IDs that cause/realize this node (downward) */
  readonly downEdges = new Map<string, Set<string>>();

  // ---- Node operations ----------------------------------------------------

  addNode(
    id: string,
    type: NodeType,
    title: string,
    status: NodeStatus = 'PENDING',
    metadata: Record<string, unknown> = {},
  ): this {
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Invalid node type: ${type}. Must be one of: declaration, milestone, action`);
    }
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    if (!ID_PATTERN.test(id)) {
      throw new Error(`Invalid ID format: ${id}. Expected format: D-01, M-01, A-01`);
    }
    const prefix = id.split('-')[0];
    if (PREFIX_TO_TYPE[prefix] !== type) {
      throw new Error(
        `ID prefix '${prefix}' doesn't match type '${type}'. Expected prefix '${TYPE_TO_PREFIX[type]}'`,
      );
    }
    if (this.nodes.has(id)) {
      throw new Error(`Node already exists: ${id}`);
    }

    this.nodes.set(id, { id, type, title, status, metadata });
    this.upEdges.set(id, new Set());
    this.downEdges.set(id, new Set());
    return this;
  }

  getNode(id: string): DagNode | undefined {
    return this.nodes.get(id);
  }

  updateNodeStatus(id: string, status: NodeStatus): this {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    node.status = status;
    return this;
  }

  removeNode(id: string): this {
    if (!this.nodes.has(id)) throw new Error(`Node not found: ${id}`);

    for (const target of this.upEdges.get(id)!) {
      this.downEdges.get(target)?.delete(id);
    }
    for (const source of this.downEdges.get(id)!) {
      this.upEdges.get(source)?.delete(id);
    }

    this.upEdges.delete(id);
    this.downEdges.delete(id);
    this.nodes.delete(id);
    return this;
  }

  // ---- Edge operations ----------------------------------------------------

  addEdge(from: string, to: string): this {
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    if (!fromNode) throw new Error(`Node not found: ${from}`);
    if (!toNode) throw new Error(`Node not found: ${to}`);

    const expectedTo = VALID_EDGE_DIRECTIONS[fromNode.type];
    if (expectedTo !== toNode.type) {
      throw new Error(
        `Invalid edge: ${fromNode.type} -> ${toNode.type}. ` +
        `Only action->milestone and milestone->declaration edges are allowed`,
      );
    }

    this.upEdges.get(from)!.add(to);
    this.downEdges.get(to)!.add(from);
    return this;
  }

  removeEdge(from: string, to: string): this {
    this.upEdges.get(from)?.delete(to);
    this.downEdges.get(to)?.delete(from);
    return this;
  }

  // ---- Queries ------------------------------------------------------------

  getDeclarations(): DagNode[] { return this.nodesByType('declaration'); }
  getMilestones(): DagNode[]   { return this.nodesByType('milestone'); }
  getActions(): DagNode[]      { return this.nodesByType('action'); }

  getUpstream(id: string): DagNode[] {
    return [...(this.upEdges.get(id) ?? [])].map(t => this.nodes.get(t)!).filter(Boolean);
  }

  getDownstream(id: string): DagNode[] {
    return [...(this.downEdges.get(id) ?? [])].map(s => this.nodes.get(s)!).filter(Boolean);
  }

  get size(): number { return this.nodes.size; }

  private nodesByType(type: NodeType): DagNode[] {
    return [...this.nodes.values()].filter(n => n.type === type);
  }

  // ---- Topological sort (Kahn's algorithm) --------------------------------

  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const adj = new Map<string, Set<string>>();

    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
      adj.set(id, new Set());
    }

    for (const [from, targets] of this.upEdges) {
      for (const to of targets) {
        if (!this.nodes.has(to)) continue;
        adj.get(from)!.add(to);
        inDegree.set(to, inDegree.get(to)! + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      sorted.push(node);
      for (const neighbor of adj.get(node)!) {
        const newDeg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new Error('Cycle detected: topological sort incomplete');
    }
    return sorted;
  }

  // ---- Validation ---------------------------------------------------------

  validate(): ValidationResult {
    const errors: ValidationError[] = [];

    // Orphan check: milestones/actions must have at least one upward edge
    for (const [id, node] of this.nodes) {
      if (node.type === 'declaration') continue;
      if (this.upEdges.get(id)!.size === 0) {
        errors.push({ type: 'orphan', node: id, message: `${id} has no upward connection` });
      }
    }

    // Cycle check
    try { this.topologicalSort(); } catch {
      errors.push({ type: 'cycle', message: 'Graph contains a cycle' });
    }

    // Broken edge check
    for (const [from, targets] of this.upEdges) {
      for (const to of targets) {
        if (!this.nodes.has(to)) {
          errors.push({ type: 'broken_edge', from, to, message: `Edge target ${to} not found` });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ---- Wholeness computation (bottom-up) ----------------------------------

  computeWholeness(): Map<string, Wholeness> {
    const w = new Map<string, Wholeness>();

    // Pass 1: Actions (leaf nodes)
    for (const [id, node] of this.nodes) {
      if (node.type === 'action') {
        w.set(id, isCompleted(node.status) ? 'whole' : 'broken');
      }
    }

    // Pass 2: Milestones (aggregate from actions)
    for (const [id, node] of this.nodes) {
      if (node.type === 'milestone') {
        w.set(id, aggregateWholeness(this.downEdges.get(id)!, w));
      }
    }

    // Pass 3: Declarations (aggregate from milestones)
    for (const [id, node] of this.nodes) {
      if (node.type === 'declaration') {
        w.set(id, aggregateWholeness(this.downEdges.get(id)!, w));
      }
    }

    return w;
  }

  // ---- Auto-increment ID --------------------------------------------------

  nextId(type: NodeType): string {
    if (!VALID_TYPES.has(type)) throw new Error(`Invalid type: ${type}`);
    const prefix = TYPE_TO_PREFIX[type];
    let max = 0;

    for (const [id, node] of this.nodes) {
      if (node.type === type) {
        const num = parseInt(id.split('-')[1], 10);
        if (num > max) max = num;
      }
    }

    const next = max + 1;
    return `${prefix}-${next < 10 ? `0${next}` : `${next}`}`;
  }

  // ---- Serialization ------------------------------------------------------

  toJSON(): { nodes: DagNode[]; edges: DagEdge[] } {
    return {
      nodes: [...this.nodes.values()].map(n => ({ ...n })),
      edges: [...this.upEdges.entries()].flatMap(([from, tos]) =>
        [...tos].map(to => ({ from, to })),
      ),
    };
  }

  static fromJSON(data: { nodes: DagNode[]; edges: DagEdge[] }): DeclareDag {
    const dag = new DeclareDag();
    for (const n of data.nodes) dag.addNode(n.id, n.type, n.title, n.status, n.metadata ?? {});
    for (const e of data.edges) dag.addEdge(e.from, e.to);
    return dag;
  }
}
