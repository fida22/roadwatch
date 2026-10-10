import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    const u = new URL(req.url).searchParams;
    const includePending = u.get('include_pending') === 'true';
    const rows = await sql`
      select id, name, color, approved
      from departments
      ${includePending ? sql`` : sql`where approved = true`}
      order by name`;
    return NextResponse.json(rows);
  } catch (err) {
    return fail(err);
  }
}