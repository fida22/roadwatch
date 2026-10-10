import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';
import { computeRoute } from '@/lib/route-service';

export async function POST(req: Request) {
  try {
    const u = await getUser(req);
    const b = await req.json();
    const { body, edgeIds } = await computeRoute(sql, {
      origin: b.origin,
      destination: b.destination,
      travel_date: b.travel_date,
    });
    const [row] = await sql`
      insert into saved_routes (
        user_id, name, origin_lat, origin_lng, dest_lat, dest_lng,
        travel_date, last_edge_ids, last_checked_at
      )
      values (
        ${u.id}, ${b.name ?? null}, ${b.origin.lat}, ${b.origin.lng},
        ${b.destination.lat}, ${b.destination.lng},
        ${b.travel_date ?? null}, ${sql.array(edgeIds[0] ?? [])}::uuid[], now()
      )
      returning *`;
    return NextResponse.json({ saved_route: row, route: body }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

export async function GET(req: Request) {
  try {
    const u = await getUser(req);
    const rows = await sql`select * from saved_routes where user_id = ${u.id} order by created_at desc`;
    return NextResponse.json(rows);
  } catch (e) {
    return fail(e);
  }
}
