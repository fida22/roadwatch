import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const u = await getUser(req);
    await sql`delete from saved_routes where id = ${id}::uuid and user_id = ${u.id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
