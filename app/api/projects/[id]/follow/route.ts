import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const u = await getUser(req);
    const [p] = await sql`select id from projects where id = ${id}::uuid`;
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    await sql`insert into follows (user_id, project_id) values (${u.id}, ${id}::uuid)
              on conflict do nothing`;
    return NextResponse.json({ following: true });
  } catch (err) { return fail(err); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const u = await getUser(req);
    await sql`delete from follows where user_id = ${u.id} and project_id = ${id}::uuid`;
    return NextResponse.json({ following: false });
  } catch (err) { return fail(err); }
}
