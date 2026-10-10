import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const projects = await sql`
      select id, title, status, start_date, end_date from projects
      where road_id = ${id}::uuid and status <> 'cancelled'
        and start_date between current_date - interval '12 months' and current_date
      order by start_date`;
    return NextResponse.json({ count_12m: projects.length, projects });
  } catch (err) { return fail(err); }
}