import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { LANDMARKS } from '@/lib/route-service';

export async function GET() {
  try {
    const rows = await sql`
      select id as node_id, label, st_y(geom) as lat, st_x(geom) as lng
      from road_nodes where label = any(${sql.array(LANDMARKS)}) order by label`;
    return NextResponse.json(rows);
  } catch (e) { return fail(e); }
}