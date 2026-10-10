import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const u = await getUser(req);
    const unread = new URL(req.url).searchParams.get('unread') === 'true';
    return NextResponse.json(await sql`
      select id, project_id, type, message, is_read, created_at
      from notifications
      where user_id = ${u.id} ${unread ? sql`and not is_read` : sql``}
      order by created_at desc limit 50`);
  } catch (err) { return fail(err); }
}
