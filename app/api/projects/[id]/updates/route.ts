import { NextResponse, after } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser, assertOwnsProject, supabaseAdmin } from '@/lib/server-auth';
import { required } from '@/lib/validate';
import { audit } from '@/lib/audit';
import { notifyFollowers } from '@/lib/notify';
import { recomputeSavedRoutes } from '@/lib/saved-routes';

// Dynamic route params are Promises as per project conventions
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const user = await getUser(req, ['department', 'admin']);
    await assertOwnsProject(user, id);

    const b = await req.json();
    // Expected fields: note (string) and optional photo (base64 or URL) – we store placeholder only
    required(b, ['note']);
    const note = String(b.note).trim();
    if (!note) throw new ApiError(400, 'VALIDATION', 'Note cannot be empty');

    const result = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      // Insert project update
      await t`
        insert into project_updates (project_id, author_id, note, photo_url)
        values (${id}::uuid, ${user.id}, ${note}, ${b.photo ?? null})
        returning id`;

      // Audit the addition
      await audit(t, user.id, 'add_project_update', 'project', id, { note });

      await notifyFollowers(t, id, 'update', `${user.role === 'admin' ? 'Admin' : user.email} added an update`);
    });

    // Re‑compute saved routes – it may affect users' saved routes if the update changes closures later
    after(() => recomputeSavedRoutes().catch(console.error));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
