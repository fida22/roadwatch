import projectsMock from './mock/projects.json';
import landmarksMock from './mock/landmarks.json';
import routeMock from './mock/route.json';
import complaintsMock from './mock/complaints.json';
import notifMock from './mock/notifications.json';
import { ls } from './store';
import { distToLine, distM } from './geo';
import { ApiError } from './errors';
import { getSupabase } from './supabase';
import { isMocked, mockRoute } from './mock/p3-fallbacks';

export { ApiError };

export const MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
export type Project = any;
export type Landmark = { node_id: string; label: string; lat: number; lng: number };

const ok = async (r: Response) => {
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { code: j.code });
  }
  return r.json();
};

export const qs = (params: Record<string, any>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

interface Opts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  json?: unknown;
  form?: FormData;
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  if (MOCK && isMocked(method, path))
    return (await mockRoute(method, path, opts.json ?? opts.form)) as T;

  const headers: Record<string, string> = {};
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const e = (data ?? {}) as { error?: string; code?: string; conflicts?: any };
    throw new ApiError(
      res.status,
      e.code ?? 'UNKNOWN',
      e.error ?? `Request failed (${res.status})`,
      e.conflicts ? { conflicts: e.conflicts } : {}
    );
  }
  return data as T;
}

const wait = () => new Promise((r) => setTimeout(r, 300));
const err = (m: string, code: string) => Object.assign(new Error(m), { code });
const P = projectsMock as Project[];
const allComplaints = () =>
  [...(complaintsMock as any[]), ...ls.get<any[]>('extra_complaints', [])].map((c) => ({
    ...c,
    upvotes: c.upvotes + (ls.get<string[]>('upv', []).includes(c.id) ? 1 : 0),
  }));

// ---- projects
export async function getProjects(q: Record<string, string> = {}): Promise<Project[]> {
  if (!MOCK) return ok(await fetch('/api/projects' + qs(q)));
  return (await mockRoute('GET', '/api/projects' + qs(q))) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!MOCK) return ok(await fetch('/api/projects/' + id));
  try {
    const p = (await mockRoute('GET', '/api/projects/' + id)) as any;
    if (!p) return null;
    const v = ls.get<any>('ver:' + id, { happening: 0, not_happening: 0 });
    return {
      ...p,
      complaints: allComplaints().filter((c) => c.project_id === id),
      follower_count: (p.follower_count ?? 12) + (ls.get<string[]>('follows', []).includes(id) ? 1 : 0),
      verifications: v,
    };
  } catch {
    return null;
  }
}

export async function getDepartments(): Promise<{ id: string; name: string; color: string }[]> {
  if (!MOCK) return ok(await fetch('/api/departments'));
  return (await mockRoute('GET', '/api/departments')) as any[];
}

export async function getStats(): Promise<any> {
  if (!MOCK) return ok(await fetch('/api/stats'));
  const all = (await mockRoute('GET', '/api/projects')) as any[];
  const act = all.filter((p) => ['ongoing', 'delayed'].includes(p.status)),
    del = all.filter((p) => p.delay_days > 0);
  const roads = new Map<string, any>();
  all.forEach((p) =>
    roads.set(p.road_id, { road_id: p.road_id, name: p.title, count: p.redig_count_12m ?? 1 })
  );
  return {
    active: act.length,
    delayed: del.length,
    avg_delay_days: del.length
      ? Math.round(del.reduce((s, p: any) => s + p.delay_days, 0) / del.length)
      : 0,
    open_complaints: allComplaints().filter((c) => c.status !== 'resolved').length,
    active_closures: act.filter((p) => p.closure_type === 'full_closure').length,
    most_dug_roads: [...roads.values()].sort((a, b) => b.count - a.count),
  };
}

// ---- complaints
export async function checkDuplicate(
  lat: number,
  lng: number,
  category: string
): Promise<{ duplicate: any | null; nearest_project: any | null }> {
  if (!MOCK)
    return ok(
      await fetch('/api/complaints/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, category }),
      })
    );
  const dup =
    allComplaints().find(
      (c) => c.category === category && c.status !== 'resolved' && distM([lat, lng], [c.lat, c.lng]) <= 30
    ) || null;
  const allProjects = await getProjects();
  const np = allProjects
    .filter((p) => !['cancelled', 'completed'].includes(p.status))
    .map((p) => ({ p, d: distToLine([lat, lng], p.geojson.coordinates) }))
    .filter((x) => x.d <= 50)
    .sort((a, b) => a.d - b.d)[0];
  return { duplicate: dup, nearest_project: np ? { id: np.p.id, title: np.p.title } : null };
}

export async function postComplaint(f: {
  category: string;
  description: string;
  lat: number;
  lng: number;
  contact?: string;
  photo?: File | null;
}) {
  if (!MOCK) {
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => {
      if (v != null && v !== '') fd.append(k, v as any);
    });
    return ok(await fetch('/api/complaints', { method: 'POST', body: fd }));
  }
  await wait();
  const np = (await checkDuplicate(f.lat, f.lng, f.category)).nearest_project;
  const tid = 'RW-' + Math.floor(2000 + Math.random() * 7000);
  let photo: string | null = null;
  if (f.photo && f.photo.size < 400000)
    photo = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result as string);
      fr.readAsDataURL(f.photo!);
    });
  ls.set('extra_complaints', [
    ...ls.get<any[]>('extra_complaints', []),
    {
      id: 'x' + tid,
      tracking_id: tid,
      category: f.category,
      description: f.description,
      photo_url: photo,
      lat: f.lat,
      lng: f.lng,
      project_id: np?.id || null,
      status: 'submitted',
      response: null,
      upvotes: 0,
      created_at: new Date().toISOString().slice(0, 10),
    },
  ]);
  return { tracking_id: tid, linked_project_id: np?.id || null };
}

export async function getComplaint(tid: string): Promise<any | null> {
  if (!MOCK) {
    try {
      return await ok(await fetch('/api/complaints/' + encodeURIComponent(tid)));
    } catch (e: any) {
      if (e.code === 'NOT_FOUND') return null;
      throw e;
    }
  }
  return (
    allComplaints().find((c) => c.tracking_id.toLowerCase() === tid.trim().toLowerCase()) || null
  );
}

export async function upvote(c: any): Promise<number> {
  if (!MOCK) {
    const r = await fetch(`/api/complaints/${c.id}/upvote`, { method: 'POST' });
    return (await ok(r)).upvotes;
  }
  const u = ls.get<string[]>('upv', []);
  if (u.includes(c.id)) throw err('You already upvoted this complaint.', 'ALREADY_UPVOTED');
  ls.set('upv', [...u, c.id]);
  return c.upvotes + 1;
}

export const myComplaintIds = () => ls.get<string[]>('mine', []);
export const rememberComplaint = (t: string) =>
  ls.set('mine', [...new Set([t, ...myComplaintIds()])]);

// ---- follow, notifications, verification
export async function getFollows(): Promise<Project[]> {
  if (!MOCK) return ok(await fetch('/api/me/follows'));
  const f = ls.get<string[]>('follows', []);
  const allProjects = await getProjects();
  return allProjects.filter((p) => f.includes(p.id));
}

export const isFollowing = (id: string) => ls.get<string[]>('follows', []).includes(id);

export async function setFollow(id:string, on: boolean) {
  if (!MOCK) {
    await ok(await fetch(`/api/projects/${id}/follow`, { method: on ? 'POST' : 'DELETE' }));
    return;
  }
  const f = ls.get<string[]>('follows', []).filter((x) => x !== id);
  ls.set('follows', on ? [...f, id] : f);
}

export async function getNotifications(): Promise<any[]> {
  if (!MOCK) return ok(await fetch('/api/me/notifications'));
  const r = ls.get<string[]>('nread', []);
  return (notifMock as any[]).map((n) => ({
    ...n,
    is_read: n.is_read || r.includes(n.id),
  }));
}

export async function markRead(id: string) {
  if (!MOCK) {
    await ok(await fetch(`/api/notifications/${id}/read`, { method: 'POST' }));
    return;
  }
  ls.set('nread', [...ls.get<string[]>('nread', []), id]);
}

export async function verify(
  id: string,
  value: 'happening' | 'not_happening',
  photo?: File | null
) {
  if (!MOCK) {
    const fd = new FormData();
    fd.append('value', value);
    if (photo) fd.append('photo', photo);
    return ok(await fetch(`/api/projects/${id}/verifications`, { method: 'POST', body: fd }));
  }
  const k = 'ver:' + id,
    v = ls.get<any>(k, { happening: 0, not_happening: 0 });
  if (v.mine) throw err('You already verified this work.', 'ALREADY_VERIFIED');
  const n = { ...v, [value]: v[value] + 1, mine: value };
  ls.set(k, n);
  return n;
}

// ---- routing
export async function getLandmarks(): Promise<Landmark[]> {
  return MOCK ? landmarksMock : ok(await fetch('/api/route/landmarks'));
}

export async function postRoute(body: any): Promise<{ data?: any; error?: any }> {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      data: {
        ...routeMock,
        travel_date: body.travel_date,
        routes: routeMock.routes.slice(0, body.alternatives || 1),
      },
    };
  }
  const r = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return r.ok ? { data: j } : { error: j };
}

export async function getSavedRoutes(): Promise<any[]> {
  return MOCK ? ls.get<any[]>('saved', []) : ok(await fetch('/api/me/routes'));
}

export async function saveRoute(b: any) {
  if (!MOCK)
    return ok(
      await fetch('/api/me/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      })
    );
  const s = {
    ...b,
    id: 's' + Date.now(),
    last_checked_at: new Date().toISOString(),
    status: 'No change since saved',
  };
  ls.set('saved', [...ls.get<any[]>('saved', []), s]);
  return s;
}

export async function deleteRoute(id: string) {
  if (!MOCK) {
    await ok(await fetch('/api/me/routes/' + id, { method: 'DELETE' }));
    return;
  }
  ls.set('saved', ls.get<any[]>('saved', []).filter((s) => s.id !== id));
}
