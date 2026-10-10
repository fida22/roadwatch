import type { DB } from './db';
import { ApiError } from './errors';
import { isDate } from './validate';
import { CLOSURE_MATCH_M, SNAP_MAX_M, WORKS_ALONG_M } from './constants';
import { buildGraph, findRoute, findAlternatives, type Graph, type RouteResult } from './routing';

export const todayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

let cache: { at: number; graph: Graph } | null = null;

async function loadGraph(db: DB): Promise<Graph> {
  if (cache && Date.now() - cache.at < 60_000) return cache.graph;
  const rows = await db`
    select id, from_node as "from", to_node as "to",
           length_m::float as length_m, speed_kmph::float as speed_kmph, oneway,
           (st_asgeojson(geom)::json -> 'coordinates') as coords
    from road_edges`;
  const graph = buildGraph(rows as any);
  cache = { at: Date.now(), graph };
  return graph;
}

async function snap(db: DB, p: { lat: number; lng: number }) {
  const [n] = await db`
    select id,
           st_distance(geom::geography,
             st_setsrid(st_makepoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography) as m
    from road_nodes
    order by geom <-> st_setsrid(st_makepoint(${p.lng}::float8, ${p.lat}::float8), 4326)
    limit 1`;
  if (!n) throw new ApiError(400, 'OUTSIDE_NETWORK', 'Routing covers the demo area only');
  return { node_id: n.id as string, snap_distance_m: Math.round(Number(n.m)) };
}

export type Closure = {
  project_id: string; title: string; department: string;
  closure_type: string; end_date: string;
};

export function groupClosuresByEdge(
  rows: Array<{ edge_id: string; project_id: string; title: string; department: string; closure_type: string; end_date: string }>
) {
  const m = new Map<string, Closure[]>();
  for (const r of rows) {
    const c: Closure = {
      project_id: r.project_id, title: r.title, department: r.department,
      closure_type: r.closure_type, end_date: r.end_date,
    };
    m.set(r.edge_id, [...(m.get(r.edge_id) ?? []), c]);
  }
  return m;
}

// edge_id -> closures blocking that edge
export async function blockedEdges(db: DB, date: string) {
  const rows = await db`
    select e.id as edge_id, p.id as project_id, p.title, d.name as department,
           p.closure_type, p.end_date
    from projects p
    join departments d on d.id = p.department_id
    join road_edges e on st_dwithin(e.geom::geography, p.geom::geography, ${CLOSURE_MATCH_M})
    where p.closure_type = 'full_closure'
      and p.status not in ('cancelled', 'completed')
      and p.start_date <= ${date}::date and p.end_date >= ${date}::date`;
  return groupClosuresByEdge(rows as any);
}

const uniqueClosures = (edgeIds: string[], by: Map<string, Closure[]>) => {
  const seen = new Map<string, Closure>();
  for (const id of edgeIds) for (const c of by.get(id) ?? []) seen.set(c.project_id, c);
  return [...seen.values()];
};

const NOTE = 'Road network and closures are simulated. Not for real navigation.';
const gj = (r: { coordinates: any }) => ({ type: 'LineString', coordinates: r.coordinates });

export type RouteInput = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  travel_date?: string;
  avoid_closures?: boolean;
  alternatives?: number;
};

export async function computeRoute(db: DB, input: RouteInput) {
  const { origin, destination } = input;
  const okCoord = (p: any) =>
    p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  if (!okCoord(origin) || !okCoord(destination))
    throw new ApiError(400, 'INVALID_COORDINATES', 'origin and destination need numeric lat and lng');

  const travel_date = input.travel_date ?? todayIST();
  if (!isDate(travel_date))
    throw new ApiError(400, 'INVALID_DATES', 'travel_date must be YYYY-MM-DD');

  const avoid = input.avoid_closures !== false;
  const nAlt = Math.min(3, Math.max(1, Math.floor(input.alternatives ?? 1)));

  const [o, d] = await Promise.all([snap(db, origin), snap(db, destination)]);
  if (o.snap_distance_m > SNAP_MAX_M || d.snap_distance_m > SNAP_MAX_M)
    throw new ApiError(400, 'OUTSIDE_NETWORK', 'Routing covers the demo area only');

  const head = {
    travel_date, avoid_closures: avoid,
    origin: { ...origin, snapped_node_id: o.node_id, snap_distance_m: o.snap_distance_m },
    destination: { ...destination, snapped_node_id: d.node_id, snap_distance_m: d.snap_distance_m },
  };

  if (o.node_id === d.node_id)
    return {
      body: { status: 'same_location', message: 'Start and destination are the same place', ...head, routes: [], warnings: [NOTE] },
      edgeIds: [] as string[][],
    };

  const [graph, by] = await Promise.all([loadGraph(db), blockedEdges(db, travel_date)]);
  const blocked = new Set(by.keys());

  // 1) baseline: closures ignored
  const base = findRoute(graph, o.node_id, d.node_id, new Set());
  if (!base) throw new ApiError(404, 'NO_ROUTE', 'No route exists in the demo network');
  const onBase = uniqueClosures(base.edgeIds, by);
  const baseline = {
    geojson: gj({ coordinates: base.coordinates }),
    distance_m: Math.round(base.distance_m),
    duration_s: Math.round(base.duration_s),
    crosses_closures: onBase.length > 0,
  };

  // 2) closure-aware route(s)
  let routes: RouteResult[];
  if (!avoid) routes = [base];
  else {
    routes =
      nAlt > 1
        ? findAlternatives(graph, o.node_id, d.node_id, blocked, nAlt)
        : [findRoute(graph, o.node_id, d.node_id, blocked)].filter((r): r is RouteResult => !!r);
    if (!routes.length)
      throw new ApiError(404, 'NO_ROUTE', 'No closure-free route found for this date',
        { blocking_closures: onBase, baseline });
  }

  // 3) works along each route (informational, never "avoided")
  const out = [];
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    const line = JSON.stringify(gj({ coordinates: r.coordinates }));
    const works = await db`
      select p.id as project_id, p.title, dep.name as department, p.closure_type, p.end_date
      from projects p join departments dep on dep.id = p.department_id
      where p.status <> 'cancelled' and p.closure_type <> 'full_closure'
        and p.start_date <= ${travel_date}::date and p.end_date >= ${travel_date}::date
        and st_dwithin(p.geom::geography,
              st_setsrid(st_geomfromgeojson(${line}), 4326)::geography, ${WORKS_ALONG_M})`;
    out.push({
      id: `r${i + 1}`,
      geojson: gj({ coordinates: r.coordinates }),
      distance_m: Math.round(r.distance_m),
      duration_s: Math.round(r.duration_s),
      works_along_route: works,
    });
  }

  const best = routes[0];
  const warnings = [NOTE];
  if (!avoid)
    onBase.forEach((c) => warnings.push(`This route crosses a full closure: ${c.title}`));

  return {
    body: {
      status: 'ok', ...head, routes: out, baseline,
      closures_avoided: avoid ? onBase : [],
      extra_distance_m: avoid ? Math.round(best.distance_m - base.distance_m) : 0,
      extra_duration_s: avoid ? Math.round(best.duration_s - base.duration_s) : 0,
      warnings,
    },
    edgeIds: routes.map((r) => r.edgeIds),
  };
}

// 10 seeded picks for the planner
export const LANDMARKS = [
  'Anna Salai Jn 1 (west)', 'Anna Salai Jn 2', 'Anna Salai Jn 5', 'Anna Salai Jn 6 (east)',
  'GST Road Jn 1', 'GST Road Jn 3', 'Adyar Main Rd Jn 1', 'Velachery Main Rd Jn 1',
  'Velachery Lane end', 'Mount Poonamallee Jn 1',
];