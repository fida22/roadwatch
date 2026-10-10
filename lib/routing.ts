export type Coord = [number, number];

export type Edge = {
  id: string;
  from: string;
  to: string;
  length_m: number;
  speed_kmph: number;
  oneway: boolean;
  coords: Coord[];
};

type Arc = { edgeId: string; to: string; length_m: number; cost_s: number; coords: Coord[] };
export type Graph = { adj: Map<string, Arc[]> };

export type RouteResult = {
  nodeIds: string[];
  edgeIds: string[];
  edgeLengths: number[];
  distance_m: number;
  duration_s: number;
  coordinates: Coord[];
};

// Two-way edges become two directed arcs; one-way edges only one.
export function buildGraph(edges: Edge[]): Graph {
  const adj = new Map<string, Arc[]>();
  const add = (from: string, a: Arc) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(a);
  };
  for (const e of edges) {
    const cost_s = e.length_m / (e.speed_kmph / 3.6);
    add(e.from, { edgeId: e.id, to: e.to, length_m: e.length_m, cost_s, coords: e.coords });
    if (!e.oneway)
      add(e.to, { edgeId: e.id, to: e.from, length_m: e.length_m, cost_s, coords: [...e.coords].reverse() });
  }
  return { adj };
}

// minimal binary heap
class MinHeap {
  private a: [number, string][] = [];
  get size() { return this.a.length; }
  push(k: number, v: string) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, string] | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// Dijkstra. Blocked edges are skipped inside the search, so a blocked edge can never appear in a result.
// `penalty` (edgeId -> multiplier) is only used for alternatives (R10b).
export function findRoute(
  graph: Graph,
  origin: string,
  dest: string,
  blocked: Set<string>,
  penalty?: Map<string, number>
): RouteResult | null {
  if (origin === dest)
    return { nodeIds: [origin], edgeIds: [], edgeLengths: [], distance_m: 0, duration_s: 0, coordinates: [] };

  const dist = new Map<string, number>([[origin, 0]]);
  const prev = new Map<string, { node: string; arc: Arc }>();
  const done = new Set<string>();
  const heap = new MinHeap();
  heap.push(0, origin);

  while (heap.size) {
    const [d, u] = heap.pop()!;
    if (done.has(u)) continue;
    done.add(u);
    if (u === dest) break;
    for (const arc of graph.adj.get(u) ?? []) {
      if (blocked.has(arc.edgeId)) continue;
      const nd = d + arc.cost_s * (penalty?.get(arc.edgeId) ?? 1);
      if (nd < (dist.get(arc.to) ?? Infinity)) {
        dist.set(arc.to, nd);
        prev.set(arc.to, { node: u, arc });
        heap.push(nd, arc.to);
      }
    }
  }
  if (!prev.has(dest)) return null;

  const arcs: Arc[] = [];
  const nodeIds: string[] = [dest];
  for (let cur = dest; cur !== origin; ) {
    const p = prev.get(cur)!;
    arcs.push(p.arc);
    nodeIds.push(p.node);
    cur = p.node;
  }
  arcs.reverse();
  nodeIds.reverse();

  const coordinates: Coord[] = [];
  arcs.forEach((a, i) => coordinates.push(...(i === 0 ? a.coords : a.coords.slice(1))));

  return {
    nodeIds,
    edgeIds: arcs.map((a) => a.edgeId),
    edgeLengths: arcs.map((a) => a.length_m),
    distance_m: arcs.reduce((s, a) => s + a.length_m, 0),
    duration_s: arcs.reduce((s, a) => s + a.cost_s, 0), // real cost, penalties not included
    coordinates,
  };
}

// Mirrors the SQL rules, used by unit tests: only an ACTIVE full closure blocks.
export function blocksOn(
  p: { closure_type: string; status: string; start_date: string; end_date: string },
  date: string
) {
  return (
    p.closure_type === 'full_closure' &&
    !['cancelled', 'completed'].includes(p.status) &&
    p.start_date <= date && date <= p.end_date // end date inclusive
  );
}

// R10b: up to n closure-free routes, each >= minDiff (20%) different from the ones already chosen.
export function findAlternatives(
  graph: Graph, o: string, d: string, blocked: Set<string>, n = 3, minDiff = 0.2
): RouteResult[] {
  const routes: RouteResult[] = [];
  const penalty = new Map<string, number>();
  const diff = (a: RouteResult, b: RouteResult) => {
    const inB = new Set(b.edgeIds);
    const other = a.edgeIds.reduce((s, id, i) => s + (inB.has(id) ? 0 : a.edgeLengths[i]), 0);
    return a.distance_m ? other / a.distance_m : 0;
  };
  for (let i = 0; i < n * 4 && routes.length < n; i++) {
    const r = findRoute(graph, o, d, blocked, penalty);
    if (!r) break;
    if (routes.every((p) => diff(r, p) >= minDiff)) routes.push(r);
    r.edgeIds.forEach((id) => penalty.set(id, (penalty.get(id) ?? 1) * 3));
  }
  return routes; // may be fewer than n: that is honest, don't pad
}