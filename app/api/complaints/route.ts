import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { tryGetUser, supabaseAdmin } from '@/lib/server-auth';
import { nearestProject, pointSql } from '@/lib/geo-server';

const CATS = ['pothole', 'unfinished_work', 'no_barricade', 'debris', 'other'];
const STATUSES = ['submitted', 'acknowledged', 'in_progress', 'resolved'];

export async function GET(req: Request) {
  try {
    const u = new URL(req.url).searchParams;
    const pid = u.get('project_id'), st = u.get('status');
    if (st && !STATUSES.includes(st)) throw new ApiError(400, 'VALIDATION', 'Invalid status');
    const rows = await sql`
      select id, tracking_id, category, description, photo_url, lat, lng,
             project_id, status, upvotes, created_at
      from complaints where true
      ${pid ? sql`and project_id = ${pid}::uuid` : sql``}
      ${st ? sql`and status = ${st}::complaint_status` : sql``}
      order by upvotes desc, created_at desc limit 200`;
    return NextResponse.json(rows);
  } catch (err) { return fail(err); }
}

export async function POST(req: Request) {
  try {
    const user = await tryGetUser(req);
    const f = await req.formData();
    const category = String(f.get('category') ?? '');
    const latRaw = f.get('lat'), lngRaw = f.get('lng');
    const lat = Number(latRaw), lng = Number(lngRaw);

    if (!CATS.includes(category)) throw new ApiError(400, 'VALIDATION', 'Invalid category');
    if (!latRaw || !lngRaw || !Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180)
      throw new ApiError(400, 'VALIDATION', 'lat and lng are required');

    let photo_url: string | null = null;
    const photo = f.get('photo');
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > 5_000_000) throw new ApiError(400, 'VALIDATION', 'Photo must be under 5 MB');
      const path = `complaints/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabaseAdmin.storage.from('photos')
        .upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type });
      if (!error) photo_url = supabaseAdmin.storage.from('photos').getPublicUrl(path).data.publicUrl;
      // if the upload fails we continue without a photo (photos are optional)
    }

    const near = await nearestProject(lat, lng);
    const tracking_id = 'RW-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const description = String(f.get('description') ?? '') || null;
    const contact = String(f.get('contact') ?? '') || null;

    const [c] = await sql`
      insert into complaints (tracking_id, category, description, photo_url, lat, lng, geom,
                              project_id, reporter_id, contact)
      values (${tracking_id}, ${category}::complaint_category, ${description}, ${photo_url},
              ${lat}, ${lng}, ${pointSql(lat, lng)}, ${near?.id ?? null}::uuid,
              ${user?.id ?? null}::uuid, ${contact})
      returning tracking_id, project_id`;

    return NextResponse.json(
      { tracking_id: c.tracking_id, linked_project_id: c.project_id }, { status: 201 });
  } catch (err) { return fail(err); }
}
