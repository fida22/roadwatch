import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';
import { audit } from '@/lib/audit';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser(req, ['admin']);

    const [d] = await sql`
      update departments set approved = true
      where id = ${id}::uuid
      returning id, name, color, approved`;

    if (!d) throw new ApiError(404, 'NOT_FOUND', 'Department not found');

    await audit(sql, user.id, 'department_approve', 'department', id, {});
    return NextResponse.json(d);
  } catch (err) {
    return fail(err);
  }
}
