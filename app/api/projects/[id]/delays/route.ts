import { NextResponse, after } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser, assertOwnsProject } from '@/lib/server-auth';
import { isDate } from '@/lib/validate';
import { findConflicts, checkResolutions, saveResolutions } from '@/lib/conflicts';
import { audit } from '@/lib/audit';
import { notifyFollowers } from '@/lib/notify';
import { recomputeSavedRoutes } from '@/lib/saved-routes';

const REASONS = [
  'weather', 'material_shortage', 'permit_pending', 'utility_clash',
  'funds', 'contractor_issue', 'other',
];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getUser(req, ['department', 'admin']);
    await assertOwnsProject(user, id);
    const b = await req.json();

    if (!b.reason_category || !REASONS.includes(b.reason_category))
      throw new ApiError(400, 'DELAY_REASON_REQUIRED', 'A reason is required to extend the end date');
    if (!isDate(b.new_end_date))
      throw new ApiError(400, 'VALIDATION', 'new_end_date must be YYYY-MM-DD');

    const result = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      await t`select pg_advisory_xact_lock(hashtext('project-conflicts'))`;

      const [p] = await t`
        select *, st_asgeojson(geom)::json as gj from projects where id = ${id}::uuid for update`;
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
      if (['completed', 'cancelled'].includes(p.status))
        throw new ApiError(400, 'VALIDATION', 'Cannot extend a completed or cancelled project');
      if (b.new_end_date <= p.end_date)
        throw new ApiError(400, 'INVALID_DATES', 'New end date must be after the current end date');

      // re-run the clash check on the extended range
      let conflicts = await findConflicts(t, {
        geojson: p.gj, start: p.start_date, end: b.new_end_date,
        selfId: id, departmentId: user.department_id,
      });

      // ignore clashes that already existed at the same severity before the extension
      const before = await findConflicts(t, {
        geojson: p.gj, start: p.start_date, end: p.end_date,
        selfId: id, departmentId: user.department_id,
      });
      // ... and pairs whose decision was already recorded at that severity
      const prior = await t`
        select conflicting_project_id as other, project_id as me, severity
        from conflict_resolutions
        where project_id = ${id}::uuid or conflicting_project_id = ${id}::uuid`;

      conflicts = conflicts.filter(
        (c) =>
          !before.some((x) => x.project_id === c.project_id && x.severity === c.severity) &&
          !prior.some((r) => (r.other === c.project_id || r.me === c.project_id) && r.severity === c.severity)
      );

      const res = b.resolutions ?? [];
      checkResolutions(conflicts, res); // 409 CONFLICT_UNRESOLVED until every new clash is decided

      const [delay] = await t`
        insert into delays (project_id, old_end_date, new_end_date, reason_category, note, created_by)
        values (${id}::uuid, ${p.end_date}::date, ${b.new_end_date}::date,
                ${b.reason_category}::delay_reason, ${b.note ?? null}, ${user.id})
        returning *`;

      const [np] = await t`
        update projects set end_date = ${b.new_end_date}::date, status = 'delayed', updated_at = now()
        where id = ${id}::uuid returning id, title, status, end_date`;

      await saveResolutions(t, id, user.id, conflicts, res);
      await notifyFollowers(t, id, 'delay',
        `${np.title} is delayed to ${np.end_date}. Reason: ${String(b.reason_category).replace(/_/g, ' ')}`);
      await audit(t, user.id, 'delay', 'project', id,
        { from: p.end_date, to: b.new_end_date, reason: b.reason_category });

      return { project: np, delay };
    });

    after(() => recomputeSavedRoutes().catch(console.error));
    return NextResponse.json(result, { status: 201 });
  } catch (err) { return fail(err); }
}