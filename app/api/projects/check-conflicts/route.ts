import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { getUser } from '@/lib/auth';
import { assertDates, assertGeometry } from '@/lib/validate';
import { findConflicts } from '@/lib/conflicts';

export async function POST(req: Request) {
  try {
    const user = await getUser(req, ['department', 'admin']);
    const b = await req.json();
    assertDates(b.start_date, b.end_date); // INVALID_DATES before any DB work
    assertGeometry(b.geojson);
    const conflicts = await findConflicts(sql, {
      geojson: b.geojson,
      start: b.start_date,
      end: b.end_date,
      selfId: b.self_id,
      departmentId: user.department_id,
    });
    return NextResponse.json({ conflicts });
  } catch (err) { return fail(err); }
}