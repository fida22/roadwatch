import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    const u = new URL(req.url).searchParams;
    const from = u.get('from');
    const to = u.get('to');

    const rows = await sql`
      select p.id, p.title, p.status, p.closure_type, p.contractor,
        p.start_date, p.end_date, p.road_id,
        (p.end_date - p.original_end_date)::int as delay_days,
        json_build_object('id', d.id, 'name', d.name, 'color', d.color) as department
      from projects p
      join departments d on d.id = p.department_id
      where p.status <> 'cancelled'
        ${from ? sql`and p.end_date >= ${from}::date` : sql``}
        ${to ? sql`and p.start_date <= ${to}::date` : sql``}
      order by p.start_date asc`;

    return NextResponse.json(rows);
  } catch (err) {
    return fail(err);
  }
}
