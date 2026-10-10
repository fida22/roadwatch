import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fail, ApiError } from '@/lib/errors';
import { getUser } from '@/lib/server-auth';

export async function POST(
  req: Request, { params }: { params: Promise<{ tracking_id: string }> }
) {
  try {
    const { tracking_id: id } = await params; // the uuid
    const u = await getUser(req);
    const upvotes = await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      const [exists] = await t`select id from complaints where id = ${id}::uuid`;
      if (!exists) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
      const ins = await t`
        insert into complaint_upvotes (complaint_id, user_id) values (${id}::uuid, ${u.id})
        on conflict do nothing returning complaint_id`;
      if (!ins.length) throw new ApiError(409, 'ALREADY_UPVOTED', 'You already upvoted this complaint');
      const [c] = await t`update complaints set upvotes = upvotes + 1 where id = ${id}::uuid returning upvotes`;
      return c.upvotes;
    });
    return NextResponse.json({ upvotes });
  } catch (err) { return fail(err); }
}
