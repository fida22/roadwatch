import { NextResponse, after } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';

import { getUser, assertOwnsProject } from '@/lib/server-auth';
import { audit } from '@/lib/audit';
import { notifyFollowers } from '@/lib/notify';
import { CLOSURE_TYPES } from '@/lib/constants';
import { recomputeSavedRoutes } from '@/lib/saved-routes';

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

// Edit details/status. Dates NOT allowed here (they go through /delays)
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getUser(req, ['department', 'admin']);
    await assertOwnsProject(user, id);
    const b = await req.json();
    if ('start_date' in b || 'end_date' in b)
      throw new ApiError(400, 'VALIDATION', 'Use the delays endpoint to change dates');
    if (b.closure_type && !(CLOSURE_TYPES as readonly string[]).includes(b.closure_type))
      throw new ApiError(400, 'VALIDATION', 'Invalid closure_type');

    const out = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      const [old] = await t`select status, title, closure_type from projects where id = ${id}::uuid`;
      if (!old) throw new ApiError(404, 'NOT_FOUND', 'Project not found');

      const [p] = await t`
        update projects set
          title = coalesce(${b.title ?? null}, title),
          purpose = coalesce(${b.purpose ?? null}, purpose),
          contractor = coalesce(${b.contractor ?? null}, contractor),
          budget = coalesce(${b.budget ?? null}, budget),
          status = coalesce(${b.status ?? null}::project_status, status),
          closure_type = coalesce(${b.closure_type ?? null}::closure_type, closure_type),
          updated_at = now()
        where id = ${id}::uuid returning id, title, status, closure_type`;

      if (b.status && b.status !== old.status) {
        await notifyFollowers(t, id, 'status_change', `${p.title} is now ${b.status}`);
        await audit(t, user.id, 'status_change', 'project', id, { from: old.status, to: b.status });
      }
      if (b.closure_type && b.closure_type !== old.closure_type) {
        await audit(t, user.id, 'closure_type_change', 'project', id, { from: old.closure_type, to: b.closure_type });
      }
      return p;
    });
    after(() => recomputeSavedRoutes().catch(console.error));
    return NextResponse.json(out);
  } catch (err) { return fail(err); }
}