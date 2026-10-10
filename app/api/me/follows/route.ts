import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const u = await getUser(req);
    return NextResponse.json(await sql`
      select p.id, p.title, p.status, p.closure_type, p.start_date, p.end_date,
             d.name as department
      from follows f
      join projects p on p.id = f.project_id
      join departments d on d.id = p.department_id
      where f.user_id = ${u.id} order by p.end_date`);
  } catch (err) { return fail(err); }
}
