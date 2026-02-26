import { describe, test, expect } from 'vitest';
import {
  parseFutureFile, writeFutureFile, type Declaration,
  parseMilestonesFile, writeMilestonesFile, type Milestone,
  parsePlanFile, writePlanFile, type Action,
} from '../../src/core/artifacts/index.js';

// ---------------------------------------------------------------------------
// FUTURE
// ---------------------------------------------------------------------------
describe('future parser', () => {
  test('empty content returns empty array', () => {
    expect(parseFutureFile('')).toEqual([]);
    expect(parseFutureFile('  \n  ')).toEqual([]);
  });

  test('parses a single declaration', () => {
    const md = `# Future: MyProject

## D-01: First declaration
**Statement:** The system shall do X.
**Why:** Because users need it.
**Review:** accepted
`;
    const result = parseFutureFile(md);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'D-01',
      title: 'First declaration',
      statement: 'The system shall do X.',
      why: 'Because users need it.',
      review: 'accepted',
    });
  });

  test('missing fields get sensible defaults', () => {
    const md = `## D-03: Minimal
`;
    const result = parseFutureFile(md);
    expect(result).toHaveLength(1);
    expect(result[0].statement).toBe('');
    expect(result[0].why).toBe('');
    expect(result[0].review).toBe('draft');
  });

  test('skips sections without valid ID', () => {
    const md = `## Not a declaration
Some text

## D-01: Valid
**Statement:** yes
`;
    expect(parseFutureFile(md)).toHaveLength(1);
    expect(parseFutureFile(md)[0].id).toBe('D-01');
  });

  test('round-trip: parse -> write -> parse yields same data', () => {
    const decls: Declaration[] = [
      { id: 'D-01', title: 'Auth', statement: 'Users can log in', why: 'Security', review: 'draft' },
      { id: 'D-02', title: 'Search', statement: 'Full-text search', why: 'Usability', review: 'accepted' },
    ];
    const written = writeFutureFile(decls, 'TestProject');
    const parsed = parseFutureFile(written);
    expect(parsed).toEqual(decls);
  });
});

// ---------------------------------------------------------------------------
// MILESTONES
// ---------------------------------------------------------------------------
describe('milestones parser', () => {
  test('empty content returns empty array', () => {
    expect(parseMilestonesFile('')).toEqual([]);
    expect(parseMilestonesFile('   ')).toEqual([]);
  });

  test('parses a milestone table', () => {
    const md = `# Milestones: TestProject

## Milestones

| ID   | Title       | Status  | Realizes   | Plan | Review  |
|------|-------------|---------|------------|------|---------|
| M-01 | Auth system | DONE    | D-01, D-02 | YES  | accepted|
| M-02 | Search      | PENDING | D-03       | NO   | draft   |
`;
    const result = parseMilestonesFile(md);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('M-01');
    expect(result[0].realizes).toEqual(['D-01', 'D-02']);
    expect(result[0].hasPlan).toBe(true);
    expect(result[0].status).toBe('DONE');
    expect(result[1].hasPlan).toBe(false);
  });

  test('multi-value realizes parses correctly', () => {
    const md = `## Milestones

| ID   | Title | Status  | Realizes          | Plan | Review |
|------|-------|---------|-------------------|------|--------|
| M-01 | Test  | PENDING | D-01, D-02, D-03  | NO   | draft  |
`;
    const result = parseMilestonesFile(md);
    expect(result[0].realizes).toEqual(['D-01', 'D-02', 'D-03']);
  });

  test('missing fields get defaults', () => {
    const md = `## Milestones

| ID   | Title |
|------|-------|
| M-01 | Bare  |
`;
    const result = parseMilestonesFile(md);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('PENDING');
    expect(result[0].realizes).toEqual([]);
    expect(result[0].hasPlan).toBe(false);
    expect(result[0].reviewState).toBe('draft');
    expect(result[0].classification).toBe('agent');
    expect(result[0].dependsOn).toEqual([]);
  });

  test('handles empty cells in table', () => {
    const md = `## Milestones

| ID   | Title | Description | Status  | Realizes | Plan | Review |
|------|-------|-------------|---------|----------|------|--------|
| M-01 | Test  |             | PENDING |          | NO   | draft  |
`;
    const result = parseMilestonesFile(md);
    expect(result[0].description).toBe('');
    expect(result[0].realizes).toEqual([]);
  });

  test('round-trip: parse -> write -> parse yields same data', () => {
    const milestones: Milestone[] = [
      { id: 'M-01', title: 'Auth', description: '', status: 'DONE', realizes: ['D-01'], hasPlan: true, reviewState: 'accepted', classification: 'agent', dependsOn: [] },
      { id: 'M-02', title: 'Search', description: '', status: 'PENDING', realizes: ['D-02', 'D-03'], hasPlan: false, reviewState: 'draft', classification: 'agent', dependsOn: [] },
    ];
    const written = writeMilestonesFile(milestones, 'TestProject');
    const parsed = parseMilestonesFile(written);
    expect(parsed).toEqual(milestones);
  });

  test('round-trip with dependsOn and classification', () => {
    const milestones: Milestone[] = [
      { id: 'M-01', title: 'Setup', description: '', status: 'DONE', realizes: ['D-01'], hasPlan: true, reviewState: 'draft', classification: 'human', dependsOn: [] },
      { id: 'M-02', title: 'Build', description: '', status: 'PENDING', realizes: ['D-02'], hasPlan: false, reviewState: 'draft', classification: 'agent', dependsOn: ['M-01'] },
    ];
    const written = writeMilestonesFile(milestones, 'Test');
    const parsed = parseMilestonesFile(written);
    expect(parsed).toEqual(milestones);
  });
});

// ---------------------------------------------------------------------------
// PLAN
// ---------------------------------------------------------------------------
describe('plan parser', () => {
  test('empty content returns empty array', () => {
    expect(parsePlanFile('')).toEqual([]);
    expect(parsePlanFile('  \n  ')).toEqual([]);
  });

  test('parses actions from a plan file', () => {
    const md = `# Plan: M-01 -- Auth system

## Actions

### A-01: Create login page
**Status:** DONE
**Produces:** src/login.tsx

Login page with email/password form.

### A-02: Add session middleware
**Status:** PENDING
**Depends On:** A-01

Middleware for session management.
`;
    const result = parsePlanFile(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'A-01',
      title: 'Create login page',
      description: 'Login page with email/password form.',
      status: 'DONE',
      produces: 'src/login.tsx',
      dependsOn: [],
    });
    expect(result[1].dependsOn).toEqual(['A-01']);
    expect(result[1].status).toBe('PENDING');
  });

  test('missing fields get defaults', () => {
    const md = `### A-01: Bare action
`;
    const result = parsePlanFile(md);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('PENDING');
    expect(result[0].description).toBe('');
    expect(result[0].produces).toBeUndefined();
    expect(result[0].dependsOn).toEqual([]);
  });

  test('multi-value dependsOn parses correctly', () => {
    const md = `### A-03: Final step
**Status:** PENDING
**Depends On:** A-01, A-02
`;
    const result = parsePlanFile(md);
    expect(result[0].dependsOn).toEqual(['A-01', 'A-02']);
  });

  test('round-trip: parse -> write -> parse yields same data', () => {
    const actions: Action[] = [
      { id: 'A-01', title: 'Setup DB', description: 'Initialize database', status: 'DONE', produces: 'schema.sql', dependsOn: [] },
      { id: 'A-02', title: 'Write API', description: 'REST endpoints', status: 'PENDING', dependsOn: ['A-01'] },
    ];
    const written = writePlanFile(actions, 'M-05', 'Backend');
    const parsed = parsePlanFile(written);
    expect(parsed).toEqual(actions);
  });

  test('round-trip with no produces field', () => {
    const actions: Action[] = [
      { id: 'A-01', title: 'Research', description: '', status: 'PENDING', dependsOn: [] },
    ];
    const written = writePlanFile(actions, 'M-01', 'Spike');
    const parsed = parsePlanFile(written);
    expect(parsed).toEqual(actions);
    expect(parsed[0].produces).toBeUndefined();
  });
});
