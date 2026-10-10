import { createClient } from '@supabase/supabase-js';
import { sql } from './db';
import { ApiError } from './errors';

let _admin: ReturnType<typeof createClient> | null = null;
export function getSupabaseAdmin() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
    _admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return _admin;
}

export const supabaseAdmin = new Proxy({} as any, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop];
  },
});

export type Role = 'resident' | 'department' | 'admin';
export type AppUser = { id: string; email: string; role: Role; department_id: string | null };

// Frontend sends: Authorization: Bearer <supabase access_token>
export async function getUser(req: Request, roles?: Role[]): Promise<AppUser> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Not logged in');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired session');

  const [u] = await sql<AppUser[]>`
    select u.id, u.email, u.role, u.department_id, d.approved
    from users u left join departments d on d.id = u.department_id
    where u.id = ${data.user.id}`;
  if (!u) throw new ApiError(401, 'UNAUTHENTICATED', 'User profile missing');

  if (roles && !roles.includes(u.role)) throw new ApiError(403, 'FORBIDDEN', 'Not allowed');
  if (u.role === 'department' && !(u as any).approved)
    throw new ApiError(403, 'FORBIDDEN', 'Department not approved yet');
  return u;
}

// optional login (complaints can be anonymous)
export async function tryGetUser(req: Request) {
  try { return await getUser(req); } catch { return null; }
}

export async function assertOwnsProject(user: AppUser, projectId: string) {
  if (user.role === 'admin') return;
  const [p] = await sql`select department_id from projects where id = ${projectId}`;
  if (!p) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  if (p.department_id !== user.department_id)
    throw new ApiError(403, 'FORBIDDEN', 'Not your project');
}