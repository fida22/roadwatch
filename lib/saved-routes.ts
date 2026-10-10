import { sql, type DB } from './db';
import { computeRoute } from './route-service';

export async function recomputeSavedRoutes(db: DB = sql) {
  const rows = await db`select * from saved_routes`;
  for (const r of rows) {
    let ids: string[] = [];
    let msg = '';
    try {
      const { body, edgeIds } = await computeRoute(db, {
        origin: { lat: r.origin_lat, lng: r.origin_lng },
        destination: { lat: r.dest_lat, lng: r.dest_lng },
        travel_date: r.travel_date ?? undefined,
      });
      ids = edgeIds[0] ?? [];
      msg = (body as any).closures_avoided?.length
        ? `now avoids ${(body as any).closures_avoided.map((c: any) => c.title).join(', ')}`
        : 'is no longer affected by any logged closure';
    } catch (e: any) {
      if (e.code !== 'NO_ROUTE') continue;
      msg = 'has no closure-free route right now';
    }

    const before: string[] | null = r.last_edge_ids;
    const changed =
      before !== null &&
      (before.length !== ids.length || before.some((id, i) => id !== ids[i]));

    await db`update saved_routes set last_edge_ids = ${db.array(ids)}::uuid[], last_checked_at = now() where id = ${r.id}`;

    if (changed) {
      await db`insert into notifications (user_id, project_id, type, message)
        values (${r.user_id}, null, 'route_update', ${`Your saved route "${r.name ?? 'Route'}" ${msg}`})`;
    }
  }
}
