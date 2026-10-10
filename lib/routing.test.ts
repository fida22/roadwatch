import { describe, it, expect } from 'vitest';
import { buildGraph, findRoute, findAlternatives, blocksOn, Edge } from './routing';

//  A --e1-- B --e2-- C     direct path A-B-C (200 m)
//   \__e3__ D __e4__/       detour A-D-C (300 m)
const ln = (n: number): Edge['coords'] => [[0, 0], [n, 0]];
const edges: Edge[] = [
  { id: 'e1', from: 'A', to: 'B', length_m: 100, speed_kmph: 36, oneway: false, coords: ln(1) },
  { id: 'e2', from: 'B', to: 'C', length_m: 100, speed_kmph: 36, oneway: false, coords: ln(2) },
  { id: 'e3', from: 'A', to: 'D', length_m: 150, speed_kmph: 36, oneway: false, coords: ln(3) },
  { id: 'e4', from: 'D', to: 'C', length_m: 150, speed_kmph: 36, oneway: false, coords: ln(4) },
];
const g = buildGraph(edges);

describe('findRoute', () => {
  it('baseline uses the direct path', () =>
    expect(findRoute(g, 'A', 'C', new Set())!.edgeIds).toEqual(['e1', 'e2']));

  it('AC5: blocked edge never appears, detour is longer', () => {
    const r = findRoute(g, 'A', 'C', new Set(['e2']))!;
    expect(r.edgeIds).not.toContain('e2');
    expect(r.distance_m).toBeGreaterThan(200);
  });

  it('NO_ROUTE when the only connection is closed', () =>
    expect(findRoute(buildGraph(edges.slice(0, 2)), 'A', 'C', new Set(['e2']))).toBeNull());

  it('same node returns an empty route, not an error', () => {
    const r = findRoute(g, 'A', 'A', new Set())!;
    expect(r.edgeIds).toEqual([]);
    expect(r.distance_m).toBe(0);
  });

  it('two-way edges work in both directions', () =>
    expect(findRoute(g, 'C', 'A', new Set())).not.toBeNull());

  it('one-way edges are respected', () => {
    const og = buildGraph([{ ...edges[0], oneway: true }]);
    expect(findRoute(og, 'A', 'B', new Set())).not.toBeNull();
    expect(findRoute(og, 'B', 'A', new Set())).toBeNull();
  });

  it('R10b: alternatives never contain blocked edges and may be fewer than asked', () => {
    const alts = findAlternatives(g, 'A', 'C', new Set(['e2']), 3);
    expect(alts.length).toBe(1);
    alts.forEach((r) => expect(r.edgeIds).not.toContain('e2'));
  });

  it('R10b: two different routes when the network has two', () => {
    const alts = findAlternatives(g, 'A', 'C', new Set(), 3);
    expect(alts.length).toBe(2);
  });
});

describe('blocksOn (lifecycle and date boundaries)', () => {
  const p = { closure_type: 'full_closure', status: 'ongoing', start_date: '2026-10-01', end_date: '2026-11-15' };

  it('day before start does not block', () => expect(blocksOn(p, '2026-09-30')).toBe(false));
  it('start day blocks', () => expect(blocksOn(p, '2026-10-01')).toBe(true));
  it('end day blocks (inclusive)', () => expect(blocksOn(p, '2026-11-15')).toBe(true));
  it('day after end does not block', () => expect(blocksOn(p, '2026-11-16')).toBe(false));

  it('cancelled and completed never block', () => {
    expect(blocksOn({ ...p, status: 'cancelled' }, '2026-10-20')).toBe(false);
    expect(blocksOn({ ...p, status: 'completed' }, '2026-10-20')).toBe(false);
  });

  it('planned blocks only from its start date', () => {
    expect(blocksOn({ ...p, status: 'planned' }, '2026-09-30')).toBe(false);
    expect(blocksOn({ ...p, status: 'planned' }, '2026-10-01')).toBe(true);
  });

  it('lane_restriction and none never block', () => {
    expect(blocksOn({ ...p, closure_type: 'lane_restriction' }, '2026-10-20')).toBe(false);
    expect(blocksOn({ ...p, closure_type: 'none' }, '2026-10-20')).toBe(false);
  });
});