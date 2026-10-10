import { describe, it, expect, afterAll } from 'vitest';
import { sql } from './db';
import { computeRoute, blockedEdges, LANDMARKS } from './route-service';

const pt = async (label: string) => {
  const [n] = await sql`select st_y(geom) as lat, st_x(geom) as lng from road_nodes where label = ${label}`;
  return { lat: Number(n.lat), lng: Number(n.lng) };
};
const AS2 = 'Anna Salai Jn 2', AS5 = 'Anna Salai Jn 5';
const PIPE = 'Water pipeline replacement, Anna Salai';
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe.skipIf(!process.env.DATABASE_URL)('route integration', () => {
  afterAll(() => sql.end());

  it('PAIR_DEMO: avoids the pipeline, detour longer than baseline, lane restriction listed', async () => {
    const { body } = await computeRoute(sql, {
      origin: await pt(AS2), destination: await pt(AS5), travel_date: '2026-10-12',
    });
    expect((body as any).closures_avoided!.map((c: any) => c.title)).toContain(PIPE);
    expect((body as any).baseline!.crosses_closures).toBe(true);
    expect((body as any).routes[0].distance_m).toBeGreaterThan((body as any).baseline!.distance_m);
    expect((body as any).routes[0].works_along_route.map((w: any) => w.closure_type)).toContain('lane_restriction');
  });

  it('AC8 date boundaries around 2026-10-01 .. 2026-11-15', async () => {
    const run = async (d: string) =>
      ((await computeRoute(sql, { origin: await pt(AS2), destination: await pt(AS5), travel_date: d }))
        .body as any).closures_avoided!.length;
    expect(await run('2026-09-30')).toBe(0);
    expect(await run('2026-10-01')).toBe(1);
    expect(await run('2026-11-15')).toBe(1);
    expect(await run('2026-11-16')).toBe(0);
  });

  it('PAIR_CLEAR crosses no closure', async () => {
    const { body } = await computeRoute(sql, {
      origin: await pt('GST Road Jn 1'), destination: await pt('GST Road Jn 3'), travel_date: '2026-10-12',
    });
    expect((body as any).closures_avoided).toEqual([]);
  });

  it('PAIR_NOROUTE returns NO_ROUTE', async () => {
    await expect(computeRoute(sql, {
      origin: await pt('Velachery Lane end'), destination: await pt('Velachery Main Rd Jn 1'),
      travel_date: '2026-10-12',
    })).rejects.toMatchObject({ code: 'NO_ROUTE' });
  });

  it('PAIR_FAR returns OUTSIDE_NETWORK', async () => {
    await expect(computeRoute(sql, {
      origin: { lat: 13.2, lng: 80.1 }, destination: await pt(AS5),
    })).rejects.toMatchObject({ code: 'OUTSIDE_NETWORK' });
  });

  it('same start and destination is a message, not an error', async () => {
    const p = await pt(AS2);
    const res = await computeRoute(sql, { origin: p, destination: p });
    expect(res.body.status).toBe('same_location');
  });

  it('a delay extension on a closure moves the blocked window', async () => {
    const [tempProj] = await sql`
      insert into projects (title, purpose, department_id, contractor, status, closure_type, start_date, end_date, original_end_date, geom)
      select 'Temp Delay Test', 'Testing', department_id, contractor, 'ongoing'::project_status, 'full_closure'::closure_type,
             '2026-12-01'::date, '2026-12-05'::date, '2026-12-05'::date, geom
      from projects where id = 'de7ea272-bf28-43ce-ae44-b362863e3eea'
      returning id`;
    try {
      const blocked1 = await blockedEdges(sql, '2026-12-06');
      const hasTemp1 = Array.from(blocked1.values()).flat().some((c) => c.project_id === tempProj.id);
      expect(hasTemp1).toBe(false);

      await sql`update projects set end_date = '2026-12-10'::date, status = 'delayed'::project_status where id = ${tempProj.id}`;
      const blocked2 = await blockedEdges(sql, '2026-12-06');
      const hasTemp2 = Array.from(blocked2.values()).flat().some((c) => c.project_id === tempProj.id);
      expect(hasTemp2).toBe(true);
    } finally {
      await sql`delete from projects where id = ${tempProj.id}`;
    }
  });

  it('AC11: planned closure blocks only from its start, completed and cancelled never block', async () => {
    const a = await pt('Mount Poonamallee Jn 1'), b = await pt('Mount Poonamallee Jn 3');
    // Planned closure window (+30..+60)
    // day(10) is before start -> should find a route
    const resBefore = await computeRoute(sql, { origin: a, destination: b, travel_date: day(10) });
    expect(resBefore.body.status).toBe('ok');

    // completed closure window (-120..-90) on Jn2-Jn3 must not block
    const c = await pt('Mount Poonamallee Jn 2');
    const resCompleted = await computeRoute(sql, { origin: c, destination: b, travel_date: day(-100) });
    expect(resCompleted.body.status).toBe('ok');
  });

  it('AC5: no route between landmarks ever uses a blocked edge', async () => {
    const date = '2026-10-12';
    const blocked = await blockedEdges(sql, date);
    for (const x of LANDMARKS) {
      for (const y of LANDMARKS) {
        if (x === y) continue;
        try {
          const { edgeIds } = await computeRoute(sql, {
            origin: await pt(x),
            destination: await pt(y),
            travel_date: date,
            alternatives: 3,
          });
          edgeIds.forEach((ids) => ids.forEach((id) => expect(blocked.has(id)).toBe(false)));
        } catch (e: any) {
          expect(e.code).toBe('NO_ROUTE');
        }
      }
    }
  }, 180_000);
});