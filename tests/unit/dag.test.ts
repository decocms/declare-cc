import { describe, test, expect } from 'vitest';
import {
  DeclareDag,
  isCompleted,
  type NodeType,
  type NodeStatus,
  type Wholeness,
} from '../../src/core/dag';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal three-layer DAG: D-01 <- M-01 <- A-01, A-02 */
function buildMinimalDag(): DeclareDag {
  const dag = new DeclareDag();
  dag.addNode('D-01', 'declaration', 'Ship v1');
  dag.addNode('M-01', 'milestone', 'Backend done');
  dag.addNode('A-01', 'action', 'Write API');
  dag.addNode('A-02', 'action', 'Write tests');
  dag.addEdge('A-01', 'M-01');
  dag.addEdge('A-02', 'M-01');
  dag.addEdge('M-01', 'D-01');
  return dag;
}

// ---------------------------------------------------------------------------
// Node addition
// ---------------------------------------------------------------------------

describe('addNode', () => {
  test('adds a valid declaration node', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Test');
    expect(dag.getNode('D-01')).toEqual({
      id: 'D-01',
      type: 'declaration',
      title: 'Test',
      status: 'PENDING',
      metadata: {},
    });
  });

  test('adds nodes of each type', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Decl');
    dag.addNode('M-01', 'milestone', 'Mile');
    dag.addNode('A-01', 'action', 'Act');
    expect(dag.size).toBe(3);
  });

  test('rejects invalid node type', () => {
    const dag = new DeclareDag();
    expect(() => dag.addNode('D-01', 'bogus' as NodeType, 'Bad')).toThrow('Invalid node type');
  });

  test('rejects invalid status', () => {
    const dag = new DeclareDag();
    expect(() => dag.addNode('D-01', 'declaration', 'Bad', 'NOPE' as NodeStatus)).toThrow('Invalid status');
  });

  test('rejects mismatched prefix and type', () => {
    const dag = new DeclareDag();
    expect(() => dag.addNode('M-01', 'declaration', 'Bad')).toThrow("doesn't match type");
  });

  test('rejects malformed ID', () => {
    const dag = new DeclareDag();
    expect(() => dag.addNode('D01', 'declaration', 'Bad')).toThrow('Invalid ID format');
    expect(() => dag.addNode('D-', 'declaration', 'Bad')).toThrow('Invalid ID format');
    expect(() => dag.addNode('X-01', 'declaration', 'Bad')).toThrow('Invalid ID format');
  });

  test('rejects duplicate node', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'First');
    expect(() => dag.addNode('D-01', 'declaration', 'Second')).toThrow('already exists');
  });

  test('accepts all valid statuses', () => {
    const statuses: NodeStatus[] = ['PENDING', 'ACTIVE', 'DONE', 'KEPT', 'BROKEN', 'HONORED', 'RENEGOTIATED'];
    const dag = new DeclareDag();
    statuses.forEach((s, i) => {
      const id = `A-${String(i + 1).padStart(2, '0')}`;
      dag.addNode(id, 'action', `Action ${i}`, s);
      expect(dag.getNode(id)!.status).toBe(s);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge validation
// ---------------------------------------------------------------------------

describe('addEdge', () => {
  test('allows action -> milestone', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Act');
    dag.addNode('M-01', 'milestone', 'Mile');
    dag.addEdge('A-01', 'M-01');
    expect(dag.getUpstream('A-01').map(n => n.id)).toEqual(['M-01']);
    expect(dag.getDownstream('M-01').map(n => n.id)).toEqual(['A-01']);
  });

  test('allows milestone -> declaration', () => {
    const dag = new DeclareDag();
    dag.addNode('M-01', 'milestone', 'Mile');
    dag.addNode('D-01', 'declaration', 'Decl');
    dag.addEdge('M-01', 'D-01');
    expect(dag.getUpstream('M-01').map(n => n.id)).toEqual(['D-01']);
  });

  test('rejects action -> declaration (skip layer)', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Act');
    dag.addNode('D-01', 'declaration', 'Decl');
    expect(() => dag.addEdge('A-01', 'D-01')).toThrow('Invalid edge');
  });

  test('rejects action -> action (same layer)', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Act 1');
    dag.addNode('A-02', 'action', 'Act 2');
    expect(() => dag.addEdge('A-01', 'A-02')).toThrow('Invalid edge');
  });

  test('rejects milestone -> action (downward)', () => {
    const dag = new DeclareDag();
    dag.addNode('M-01', 'milestone', 'Mile');
    dag.addNode('A-01', 'action', 'Act');
    expect(() => dag.addEdge('M-01', 'A-01')).toThrow('Invalid edge');
  });

  test('rejects declaration -> milestone (downward)', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Decl');
    dag.addNode('M-01', 'milestone', 'Mile');
    expect(() => dag.addEdge('D-01', 'M-01')).toThrow('Invalid edge');
  });

  test('rejects edge with missing node', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Act');
    expect(() => dag.addEdge('A-01', 'M-99')).toThrow('Node not found');
    expect(() => dag.addEdge('M-99', 'A-01')).toThrow('Node not found');
  });
});

// ---------------------------------------------------------------------------
// Topological sort & cycle detection
// ---------------------------------------------------------------------------

describe('topologicalSort', () => {
  test('returns actions before milestones before declarations', () => {
    const dag = buildMinimalDag();
    const sorted = dag.topologicalSort();
    const indexOf = (id: string) => sorted.indexOf(id);

    // Actions must come before their milestone
    expect(indexOf('A-01')).toBeLessThan(indexOf('M-01'));
    expect(indexOf('A-02')).toBeLessThan(indexOf('M-01'));
    // Milestone must come before declaration
    expect(indexOf('M-01')).toBeLessThan(indexOf('D-01'));
  });

  test('handles empty graph', () => {
    const dag = new DeclareDag();
    expect(dag.topologicalSort()).toEqual([]);
  });

  test('handles single node', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Solo');
    expect(dag.topologicalSort()).toEqual(['D-01']);
  });

  test('detects cycle (via validation)', () => {
    // We cannot create a true cycle through addEdge since edge direction is constrained.
    // But topologicalSort should throw on incomplete graphs if there were one.
    // Test that a well-formed graph does NOT throw.
    const dag = buildMinimalDag();
    expect(() => dag.topologicalSort()).not.toThrow();
  });

  test('cycle detection by manually injecting a cycle', () => {
    // Simulate a cycle by directly mutating edges (bypassing addEdge validation)
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Act');
    dag.addNode('M-01', 'milestone', 'Mile');
    dag.addEdge('A-01', 'M-01');

    // Inject reverse edge to create cycle: M-01 -> A-01
    dag.upEdges.get('M-01')!.add('A-01');
    dag.downEdges.get('A-01')!.add('M-01');

    expect(() => dag.topologicalSort()).toThrow('Cycle detected');
  });
});

// ---------------------------------------------------------------------------
// Wholeness computation
// ---------------------------------------------------------------------------

describe('computeWholeness', () => {
  test('actions are whole when completed (DONE, KEPT, HONORED, RENEGOTIATED)', () => {
    const completedStatuses: NodeStatus[] = ['DONE', 'KEPT', 'HONORED', 'RENEGOTIATED'];
    for (const status of completedStatuses) {
      const dag = new DeclareDag();
      dag.addNode('A-01', 'action', 'Act', status);
      const w = dag.computeWholeness();
      expect(w.get('A-01')).toBe('whole');
    }
  });

  test('actions are broken when not completed (PENDING, ACTIVE, BROKEN)', () => {
    const incompleteStatuses: NodeStatus[] = ['PENDING', 'ACTIVE', 'BROKEN'];
    for (const status of incompleteStatuses) {
      const dag = new DeclareDag();
      dag.addNode('A-01', 'action', 'Act', status);
      const w = dag.computeWholeness();
      expect(w.get('A-01')).toBe('broken');
    }
  });

  test('milestone is whole when ALL children are whole', () => {
    const dag = buildMinimalDag();
    dag.updateNodeStatus('A-01', 'DONE');
    dag.updateNodeStatus('A-02', 'KEPT');
    const w = dag.computeWholeness();
    expect(w.get('M-01')).toBe('whole');
  });

  test('milestone is partial when SOME children are whole', () => {
    const dag = buildMinimalDag();
    dag.updateNodeStatus('A-01', 'DONE');
    // A-02 stays PENDING (broken)
    const w = dag.computeWholeness();
    expect(w.get('M-01')).toBe('partial');
  });

  test('milestone is broken when NO children are whole', () => {
    const dag = buildMinimalDag();
    // Both actions stay PENDING
    const w = dag.computeWholeness();
    expect(w.get('M-01')).toBe('broken');
  });

  test('milestone with no children is pending', () => {
    const dag = new DeclareDag();
    dag.addNode('M-01', 'milestone', 'Empty milestone');
    const w = dag.computeWholeness();
    expect(w.get('M-01')).toBe('pending');
  });

  test('declaration aggregates from milestones - whole', () => {
    const dag = buildMinimalDag();
    dag.updateNodeStatus('A-01', 'DONE');
    dag.updateNodeStatus('A-02', 'DONE');
    const w = dag.computeWholeness();
    expect(w.get('D-01')).toBe('whole');
  });

  test('declaration aggregates from milestones - partial', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Decl');
    dag.addNode('M-01', 'milestone', 'Mile 1');
    dag.addNode('M-02', 'milestone', 'Mile 2');
    dag.addNode('A-01', 'action', 'Done act', 'DONE');
    dag.addNode('A-02', 'action', 'Pending act');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('A-02', 'M-02');
    dag.addEdge('M-01', 'D-01');
    dag.addEdge('M-02', 'D-01');

    const w = dag.computeWholeness();
    expect(w.get('M-01')).toBe('whole');
    expect(w.get('M-02')).toBe('broken');
    expect(w.get('D-01')).toBe('partial');
  });

  test('declaration aggregates from milestones - broken', () => {
    const dag = buildMinimalDag();
    // All actions PENDING -> all broken
    const w = dag.computeWholeness();
    expect(w.get('D-01')).toBe('broken');
  });

  test('declaration with no milestones is pending', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Lonely decl');
    const w = dag.computeWholeness();
    expect(w.get('D-01')).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// isCompleted helper
// ---------------------------------------------------------------------------

describe('isCompleted', () => {
  test('returns true for completed statuses', () => {
    expect(isCompleted('DONE')).toBe(true);
    expect(isCompleted('KEPT')).toBe(true);
    expect(isCompleted('HONORED')).toBe(true);
    expect(isCompleted('RENEGOTIATED')).toBe(true);
  });

  test('returns false for non-completed statuses', () => {
    expect(isCompleted('PENDING')).toBe(false);
    expect(isCompleted('ACTIVE')).toBe(false);
    expect(isCompleted('BROKEN')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('validate', () => {
  test('valid graph passes', () => {
    const dag = buildMinimalDag();
    const result = dag.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('finds orphan milestone (no upward connection)', () => {
    const dag = new DeclareDag();
    dag.addNode('M-01', 'milestone', 'Orphan');
    const result = dag.validate();
    expect(result.valid).toBe(false);
    const orphans = result.errors.filter(e => e.type === 'orphan');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].node).toBe('M-01');
  });

  test('finds orphan action (no upward connection)', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Orphan action');
    const result = dag.validate();
    expect(result.valid).toBe(false);
    const orphans = result.errors.filter(e => e.type === 'orphan');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].node).toBe('A-01');
  });

  test('declarations are never orphans (top-level)', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Top level');
    const result = dag.validate();
    expect(result.errors.filter(e => e.type === 'orphan')).toHaveLength(0);
  });

  test('detects cycle via validation', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Act');
    dag.addNode('M-01', 'milestone', 'Mile');
    dag.addEdge('A-01', 'M-01');

    // Inject cycle
    dag.upEdges.get('M-01')!.add('A-01');
    dag.downEdges.get('A-01')!.add('M-01');

    const result = dag.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'cycle')).toBe(true);
  });

  test('multiple orphans reported', () => {
    const dag = new DeclareDag();
    dag.addNode('M-01', 'milestone', 'Orphan 1');
    dag.addNode('A-01', 'action', 'Orphan 2');
    dag.addNode('A-02', 'action', 'Orphan 3');
    const result = dag.validate();
    expect(result.errors.filter(e => e.type === 'orphan')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// nextId()
// ---------------------------------------------------------------------------

describe('nextId', () => {
  test('returns D-01 for empty graph', () => {
    const dag = new DeclareDag();
    expect(dag.nextId('declaration')).toBe('D-01');
  });

  test('auto-increments from existing nodes', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'First');
    dag.addNode('D-02', 'declaration', 'Second');
    expect(dag.nextId('declaration')).toBe('D-03');
  });

  test('works for each node type', () => {
    const dag = new DeclareDag();
    expect(dag.nextId('declaration')).toBe('D-01');
    expect(dag.nextId('milestone')).toBe('M-01');
    expect(dag.nextId('action')).toBe('A-01');
  });

  test('pads single-digit numbers', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'One');
    expect(dag.nextId('action')).toBe('A-02');
  });

  test('does not pad double-digit numbers', () => {
    const dag = new DeclareDag();
    // Add 10 actions
    for (let i = 1; i <= 10; i++) {
      const id = `A-${i < 10 ? `0${i}` : `${i}`}`;
      dag.addNode(id, 'action', `Action ${i}`);
    }
    expect(dag.nextId('action')).toBe('A-11');
  });

  test('rejects invalid type', () => {
    const dag = new DeclareDag();
    expect(() => dag.nextId('bogus' as NodeType)).toThrow('Invalid type');
  });
});

// ---------------------------------------------------------------------------
// Serialization roundtrip
// ---------------------------------------------------------------------------

describe('toJSON / fromJSON', () => {
  test('roundtrips a full graph', () => {
    const dag = buildMinimalDag();
    dag.updateNodeStatus('A-01', 'DONE');

    const json = dag.toJSON();
    const restored = DeclareDag.fromJSON(json);

    expect(restored.size).toBe(dag.size);
    expect(restored.getNode('A-01')!.status).toBe('DONE');
    expect(restored.getUpstream('A-01').map(n => n.id)).toEqual(['M-01']);
    expect(restored.getDownstream('M-01').map(n => n.id).sort()).toEqual(['A-01', 'A-02']);
  });
});

// ---------------------------------------------------------------------------
// removeNode / removeEdge
// ---------------------------------------------------------------------------

describe('removeNode', () => {
  test('removes node and its edges', () => {
    const dag = buildMinimalDag();
    dag.removeNode('A-02');
    expect(dag.size).toBe(3);
    expect(dag.getNode('A-02')).toBeUndefined();
    expect(dag.getDownstream('M-01').map(n => n.id)).toEqual(['A-01']);
  });

  test('throws for missing node', () => {
    const dag = new DeclareDag();
    expect(() => dag.removeNode('X-99')).toThrow('Node not found');
  });
});

describe('removeEdge', () => {
  test('removes edge without removing nodes', () => {
    const dag = buildMinimalDag();
    dag.removeEdge('A-02', 'M-01');
    expect(dag.size).toBe(4);
    expect(dag.getDownstream('M-01').map(n => n.id)).toEqual(['A-01']);
  });
});
