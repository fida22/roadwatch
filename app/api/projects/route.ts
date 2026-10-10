import { NextResponse, after } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';
import { assertDates, assertGeometry, required } from '@/lib/validate';
import { findConflicts, checkResolutions, saveResolutions } from '@/lib/conflicts';
import { audit } from '@/lib/audit';
import { CLOSURE_TYPES } from '@/lib/constants';
import { recomputeSavedRoutes } from '@/lib/saved-routes';

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

export async function POST(req: Request) {
  try {
    const user = await getUser(req, ['department']);
    const b = await req.json();
    required(b, ['title', 'start_date', 'end_date', 'geojson']);

    const closure = b.closure_type ?? 'none';
    if (!(CLOSURE_TYPES as readonly string[]).includes(closure))
      throw new ApiError(400, 'VALIDATION', 'Invalid closure_type');

    assertDates(b.start_date, b.end_date);
    assertGeometry(b.geojson);

    const g = JSON.stringify(b.geojson);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const status = b.start_date <= today ? 'ongoing' : 'planned';

    const project = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      // serialize clashing submissions: the second submitter sees the first
      await t`select pg_advisory_xact_lock(hashtext('project-conflicts'))`;

      const conflicts = await findConflicts(t, {
        geojson: b.geojson, start: b.start_date, end: b.end_date,
        departmentId: user.department_id,
      });
      const res = b.resolutions ?? [];
      checkResolutions(conflicts, res); // throws 409 CONFLICT_UNRESOLVED

      const [p] = await t`
        insert into projects (title, purpose, department_id, contractor, status, closure_type,
          start_date, end_date, original_end_date, budget, road_id, geom, created_by)
        values (${b.title}, ${b.purpose ?? null}, ${user.department_id}, ${b.contractor ?? null},
          ${status}::project_status, ${closure}::closure_type,
          ${b.start_date}::date, ${b.end_date}::date, ${b.end_date}::date,
          ${b.budget ?? null}, ${b.road_id ?? null}::uuid,
          st_setsrid(st_geomfromgeojson(${g}::text), 4326), ${user.id})
        returning id, title, status, closure_type`;

      await saveResolutions(t, p.id, user.id, conflicts, res);
      await audit(t, user.id, 'create_project', 'project', p.id,
        { conflicts: conflicts.length, closure_type: closure });
      return p;
    });

    after(() => recomputeSavedRoutes().catch(console.error));
    return NextResponse.json(project, { status: 201 });
  } catch (err) { return fail(err); }
}