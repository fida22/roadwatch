import { describe, it, expect, afterAll } from 'vitest';
import { sql } from './db';
import { computeRoute } from './route-service';

const pt = async (label: string) => {
  const [n] = await sql`select st_y(geom) as lat, st_x(geom) as lng from road_nodes where label = ${label}`;
  return { lat: Number(n.lat), lng: Number(n.lng) };
};
const AS2 = 'Anna Salai Jn 2', AS5 = 'Anna Salai Jn 5';
const PIPE = 'Water pipeline replacement, Anna Salai';

describe.skipIf(!process.env.DATABASE_URL)('route integration', () => {
  afterAll(() => sql.end());

  it('PAIR_DEMO avoids the pipeline with a longer detour', async () => {
    const { body } = await computeRoute(sql, {
      origin: await pt(AS2), destination: await pt(AS5), travel_date: '2026-10-12',
    });
    expect(body.closures_avoided!.map((c: any) => c.title)).toContain(PIPE);
    expect(body.baseline!.crosses_closures).toBe(true);
    expect(body.routes[0].distance_m).toBeGreaterThan(body.baseline!.distance_m);
  });

  it('date boundaries', async () => {
    const run = async (d: string) =>
      (await computeRoute(sql, { origin: await pt(AS2), destination: await pt(AS5), travel_date: d }))
        .body.closures_avoided!.length;
    expect(await run('2026-09-30')).toBe(0);
    expect(await run('2026-10-01')).toBe(1);
    expect(await run('2026-11-15')).toBe(1);
    expect(await run('2026-11-16')).toBe(0);
  });

  it('PAIR_CLEAR crosses no closure', async () => {
    const { body } = await computeRoute(sql, {
      origin: await pt('GST Road Jn 1'), destination: await pt('GST Road Jn 3'), travel_date: '2026-10-12',
    });
    expect(body.closures_avoided).toEqual([]);
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
});