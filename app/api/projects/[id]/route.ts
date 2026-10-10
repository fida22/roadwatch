import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const [p] = await sql`
      select p.*,
        (p.end_date - p.original_end_date)::int as delay_days,
        json_build_object('id', d.id, 'name', d.name, 'color', d.color) as department,
        st_asgeojson(p.geom)::json as geojson,
        (select count(*) from projects x
          where x.road_id = p.road_id and x.status <> 'cancelled'
            and x.start_date between current_date - interval '12 months' and current_date)::int as redig_count_12m,
        (select count(*) from follows f where f.project_id = p.id)::int as follower_count,
        (select count(*) from verifications v where v.project_id = p.id and v.value = 'happening')::int as verified_happening,
        (select count(*) from verifications v where v.project_id = p.id and v.value = 'not_happening')::int as verified_not_happening
      from projects p
      join departments d on d.id = p.department_id
      where p.id = ${id}::uuid`;
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    delete (p as any).geom; // don't send the raw hex geometry

    const [updates, delays, complaints] = await Promise.all([
      sql`select * from project_updates where project_id = ${id}::uuid order by created_at desc`,
      sql`select * from delays where project_id = ${id}::uuid order by created_at asc`,
      sql`select id, tracking_id, category, status, upvotes, lat, lng, created_at
          from complaints where project_id = ${id}::uuid order by upvotes desc`,
    ]);

    return NextResponse.json({ ...p, updates, delays, complaints });
  } catch (err) { return fail(err); }
}
// PATCH (A5) is added later with the department endpoints.