import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

export async function POST(
  req: Request, { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const u = await getUser(req);
    const b = await req.json();
    if (!['happening', 'not_happening'].includes(b.value))
      throw new ApiError(400, 'VALIDATION', 'value must be happening or not_happening');
    const [p] = await sql`select id from projects where id = ${id}::uuid`;
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    await sql`insert into verifications (project_id, user_id, value)
              values (${id}::uuid, ${u.id}, ${b.value}::verification_value)`;
    const [c] = await sql`
      select count(*) filter (where value = 'happening')::int as happening,
             count(*) filter (where value = 'not_happening')::int as not_happening
      from verifications where project_id = ${id}::uuid`;
    return NextResponse.json(c);
  } catch (err) { return fail(err); }
}
