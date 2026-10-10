import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ tracking_id: string }> };
const STATUSES = ['submitted', 'acknowledged', 'in_progress', 'resolved'];

// public tracking: param is the tracking ID (e.g. RW-DEMO01)
export async function GET(_: Request, { params }: Ctx) {
  try {
    const { tracking_id } = await params;
    const [c] = await sql`
      select c.id, c.tracking_id, c.category, c.description, c.photo_url, c.lat, c.lng,
             c.status, c.response, c.upvotes, c.created_at, c.updated_at,
             p.title as project_title
      from complaints c left join projects p on p.id = c.project_id
      where c.tracking_id = ${tracking_id.toUpperCase()}`;
    if (!c) throw new ApiError(404, 'NOT_FOUND', 'No complaint with that tracking ID');
    return NextResponse.json(c);
  } catch (err) { return fail(err); }
}

// A7: department/admin changes status or responds. Param is the UUID here.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { tracking_id: id } = await params;
    const user = await getUser(req, ['department', 'admin']);
    const b = await req.json();
    if (b.status && !STATUSES.includes(b.status))
      throw new ApiError(400, 'VALIDATION', 'Invalid status');

    const c = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      const rows = await t`
        update complaints set
          status = coalesce(${b.status ?? null}::complaint_status, status),
          response = coalesce(${b.response ?? null}, response),
          updated_at = now()
        where id = ${id}::uuid
        returning id, tracking_id, project_id, reporter_id, status, response`;
      const row = rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
      if (row.reporter_id)
        await t`insert into notifications (user_id, project_id, type, message)
                values (${row.reporter_id}, ${row.project_id}, 'complaint_response',
                        ${'Your complaint ' + row.tracking_id + ' is now ' + row.status.replace('_', ' ')})`;
      await audit(t, user.id, 'complaint_update', 'complaint', id,
        { status: b.status ?? null, responded: !!b.response });
      return row;
    });
    return NextResponse.json(c);
  } catch (err) { return fail(err); }
}

// admin removes spam
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { tracking_id: id } = await params;
    const user = await getUser(req, ['admin']);
    const rows = await sql`delete from complaints where id = ${id}::uuid returning id`;
    if (!rows.length) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
    await audit(sql, user.id, 'complaint_delete', 'complaint', id, {});
    return NextResponse.json({ ok: true });
  } catch (err) { return fail(err); }
}
