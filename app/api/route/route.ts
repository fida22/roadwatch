import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail } from '@/lib/errors';
import { computeRoute } from '@/lib/route-service';

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { body } = await computeRoute(sql, {
      origin: b.origin, destination: b.destination, travel_date: b.travel_date,
      avoid_closures: b.avoid_closures, alternatives: b.alternatives,
    });
    return NextResponse.json(body);
  } catch (e) { return fail(e); }
}