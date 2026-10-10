import { NextResponse, after } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser, assertOwnsProject } from '@/lib/server-auth';
import { required } from '@/lib/validate';
import { audit } from '@/lib/audit';
import { notifyFollowers } from '@/lib/notify';
import { recomputeSavedRoutes } from '@/lib/saved-routes';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getUser(req, ['department', 'admin']);
    await assertOwnsProject(user, id);

    const b = await req.json();
    required(b, ['into_id']);

    const result = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      const [source] = await t`
        select id, title, status, closure_type, department_id
        from projects where id = ${id}::uuid`;
      if (!source) throw new ApiError(404, 'NOT_FOUND', 'Project not found');

      const [target] = await t`
        select id, title, status, closure_type, department_id
        from projects where id = ${b.into_id}::uuid`;
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Target project not found');

      // Old project becomes cancelled with merged_into_id
      await t`
        update projects set
          status = 'cancelled',
          merged_into_id = ${b.into_id}::uuid,
          updated_at = now()
        where id = ${id}::uuid`;

      // Survivor inherits full_closure if source was full_closure
      const newClosure = source.closure_type === 'full_closure' ? 'full_closure' : target.closure_type;
      const [survivor] = await t`
        update projects set
          closure_type = ${newClosure}::closure_type,
          updated_at = now()
        where id = ${b.into_id}::uuid
        returning id, title, status, closure_type, start_date, end_date, road_id`;

      // Add update note on target
      const noteText = b.note && String(b.note).trim() ? String(b.note).trim() : `Merged with ${source.title}`;
      await t`
        insert into project_updates (project_id, author_id, note)
        values (${b.into_id}::uuid, ${user.id}, ${noteText})`;

      // Audit the merge
      await audit(t, user.id, 'project_merge', 'project', id, {
        into_id: b.into_id,
        note: b.note ?? null,
        inherited_closure: newClosure,
      });

      // Notify followers of both projects
      await notifyFollowers(t, id, 'status_change', `${source.title} was cancelled and merged into ${target.title}`);
      await notifyFollowers(t, b.into_id, 'update', `${target.title} merged with ${source.title}`);

      return survivor;
    });

    after(() => recomputeSavedRoutes().catch(console.error));
    return NextResponse.json(result);
  } catch (err) {
    return fail(err);
  }
}
