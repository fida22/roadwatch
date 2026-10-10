import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';

export async function GET() {
  try {
    const [s] = await sql`
      select
        (select count(*) from projects where status in ('ongoing','delayed'))::int as active,
        (select count(*) from projects where status = 'delayed')::int as delayed,
        coalesce((select round(avg(end_date - original_end_date), 1) from projects
                  where end_date > original_end_date), 0)::float as avg_delay_days,
        (select count(*) from complaints where status <> 'resolved')::int as open_complaints,
        (select count(*) from projects
          where closure_type = 'full_closure'
            and status not in ('cancelled','completed')
            and (now() at time zone 'Asia/Kolkata')::date between start_date and end_date)::int as active_closures`;

    const most_dug_roads = await sql`
      select r.id as road_id, r.name, count(*)::int as count_12m
      from projects p join roads r on r.id = p.road_id
      where p.status <> 'cancelled'
        and p.start_date between current_date - interval '12 months' and current_date
      group by r.id, r.name
      order by count_12m desc, r.name
      limit 5`;

    return NextResponse.json({ ...s, most_dug_roads });
  } catch (err) { return fail(err); }
}