import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';

export async function GET() {
  try {
    return NextResponse.json(
      await sql`select id, name, color from departments where approved = true order by name`
    );
  } catch (err) { return fail(err); }
}