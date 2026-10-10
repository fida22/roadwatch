import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { CLOSURE_TYPES } from '@/lib/constants';

export async function GET(req: Request) {
  try {
    const u = new URL(req.url).searchParams;
    const status = u.get('status');
    const dept = u.get('department_id');
    const closure = u.get('closure_type');
    const q = u.get('q');
    const from = u.get('from');
    const to = u.get('to');
    const bbox = u.get('bbox'); // west,south,east,north

    if (closure && !(CLOSURE_TYPES as readonly string[]).includes(closure))
      throw new ApiError(400, 'VALIDATION', 'Invalid closure_type');

    let box: number[] | null = null;
    if (bbox) {
      box = bbox.split(',').map(Number);
      if (box.length !== 4 || box.some((n) => !isFinite(n)))
        throw new ApiError(400, 'VALIDATION', 'bbox must be west,south,east,north');
    }

    const rows = await sql`
      select p.id, p.title, p.status, p.closure_type, p.contractor,
        p.start_date, p.end_date, p.road_id,
        (p.end_date - p.original_end_date)::int as delay_days,
        json_build_object('id', d.id, 'name', d.name, 'color', d.color) as department,
        st_asgeojson(p.geom)::json as geojson,
        (select count(*) from projects x
          where x.road_id = p.road_id and x.status <> 'cancelled'
            and x.start_date between current_date - interval '12 months' and current_date)::int as redig_count_12m
      from projects p
      join departments d on d.id = p.department_id
      where true
        ${status ? sql`and p.status = ${status}::project_status` : sql``}
        ${dept ? sql`and p.department_id = ${dept}::uuid` : sql``}
        ${closure ? sql`and p.closure_type = ${closure}::closure_type` : sql``}
        ${q ? sql`and (p.title ilike ${'%' + q + '%'} or p.contractor ilike ${'%' + q + '%'})` : sql``}
        ${from ? sql`and p.end_date >= ${from}::date` : sql``}
        ${to ? sql`and p.start_date <= ${to}::date` : sql``}
        ${box ? sql`and st_intersects(p.geom, st_makeenvelope(${box[0]}::float8, ${box[1]}::float8, ${box[2]}::float8, ${box[3]}::float8, 4326))` : sql``}
      order by p.start_date desc`;

    return NextResponse.json(rows);
  } catch (err) { return fail(err); }
}