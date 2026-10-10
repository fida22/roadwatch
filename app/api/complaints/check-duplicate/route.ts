import { NextResponse } from 'next/server';
import { fail, ApiError } from '@/lib/errors';
import { nearestProject, findDuplicate } from '@/lib/geo-server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body.lat), lng = Number(body.lng), category = body.category;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !category)
      throw new ApiError(400, 'VALIDATION', 'lat, lng and category are required');
    const [duplicate, nearest_project] = await Promise.all([
      findDuplicate(lat, lng, category),
      nearestProject(lat, lng),
    ]);
    return NextResponse.json({ duplicate, nearest_project });
  } catch (err) { return fail(err); }
}
