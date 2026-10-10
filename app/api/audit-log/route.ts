import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    await getUser(req, ['admin']);
    const rows = await sql`
      select a.id, a.actor_id, a.action, a.entity, a.entity_id, a.details, a.created_at,
             u.email, coalesce(u.full_name, u.email) as actor_name
      from audit_log a
      left join users u on u.id = a.actor_id
      order by a.created_at desc
      limit 200`;
    return NextResponse.json(rows);
  } catch (err) {
    return fail(err);
  }
}
