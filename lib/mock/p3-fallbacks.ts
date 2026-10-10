// In-memory stand-in for P1's API so P3 screens work before the backend is live.
// Shapes follow build doc section 6. Everything here is SIMULATED data (Chennai, hackathon demo).
import { ApiError } from "../errors";
import { addDaysIso, daysBetween } from "../dates";
import { lineDistanceM } from "../geo";
import { ls } from "../store";
import type {
  AuditEntry, ClosureType, Complaint, Conflict, Department, ProjectDetail, ProjectStatus, ProjectSummary, Resolution, Road, Severity,
} from "../types";

/** Endpoints that are live on the real backend. Add e.g. "GET /api/projects" as P1 finishes each one. */
export const LIVE_ENDPOINTS: string[] = [];

export function isMocked(method: string, path: string) {
  const clean = path.split("?")[0].replace(/\/[0-9a-f-]{8,}(?=\/|$)/g, "/:id");
  return !LIVE_ENDPOINTS.includes(`${method} ${clean}`);
}

// ---------- seed ----------
const DEPTS: Department[] = [
  { id: "d-water", name: "Water Board", color: "#2563eb", approved: true },
  { id: "d-elec", name: "Electricity Board", color: "#d97706", approved: true },
  { id: "d-roads", name: "Roads Department", color: "#4b5563", approved: true },
  { id: "d-sewer", name: "Sewerage Board", color: "#7c3aed", approved: true },
  { id: "d-tel", name: "Telecom Provider", color: "#059669", approved: false },
];
const line = (c: [number, number][]) => ({ type: "LineString" as const, coordinates: c });
const ROADS: Road[] = [
  { id: "r-anna", name: "Anna Salai", ward: "Ward 112", geojson: line([[80.2707, 13.0827], [80.2750, 13.0850]]) },
  { id: "r-gst", name: "GST Road", ward: "Ward 170", geojson: line([[80.2100, 12.9900], [80.2180, 12.9990]]) },
  { id: "r-adyar", name: "Adyar Main Road", ward: "Ward 173", geojson: line([[80.2570, 13.0067], [80.2610, 13.0120]]) },
  { id: "r-vel", name: "Velachery Main Road", ward: "Ward 179", geojson: line([[80.2180, 12.9750], [80.2240, 12.9810]]) },
];
const sum = (id: string, title: string, d: Department, status: ProjectStatus, s: string, e: string, road: Road,
  contractor: string, delay = 0, redig = 1, closure: ClosureType = "none"): ProjectSummary => ({
  id, title, department: { id: d.id, name: d.name, color: d.color }, contractor, status, closure_type: closure, start_date: s, end_date: e,
  delay_days: delay, road_id: road.id, geojson: road.geojson, redig_count_12m: redig,
});
const SEED_PROJECTS: ProjectSummary[] = [
  sum("p-water-anna", "Water pipeline replacement, Anna Salai", DEPTS[0], "ongoing", "2026-10-01", "2026-11-15", ROADS[0], "ABC Infra", 0, 2, "full_closure"),
  sum("p-roads-gst", "Resurfacing, GST Road", DEPTS[2], "delayed", "2026-08-10", "2026-10-30", ROADS[1], "Metro Builders", 20, 3, "lane_restriction"),
  sum("p-sewer-adyar", "Sewer line repair, Adyar Main Road", DEPTS[3], "planned", "2026-12-01", "2027-01-10", ROADS[2], "CityFlow Works"),
  sum("p-elec-vel", "Cable laying, Velachery Main Road", DEPTS[1], "ongoing", "2026-09-20", "2026-11-05", ROADS[3], "Volt Civil"),
  sum("p-roads-adyar", "Footpath rebuild, Adyar Main Road", DEPTS[2], "completed", "2026-05-01", "2026-06-20", ROADS[2], "Metro Builders"),
];
const SEED_DETAIL_EXTRA: Record<string, Partial<ProjectDetail>> = {
  "p-water-anna": { purpose: "Replace 40-year-old cast iron mains to cut leakage.", budget: 24000000, original_end_date: "2026-11-15",
    updates: [{ id: "u1", note: "Trenching complete on the north side.", photo_url: null, created_at: "2026-10-05T10:30:00Z", author_name: "Water Board" }],
    delays: [], follower_count: 14, verifications: { happening: 9, not_happening: 1 } },
  "p-roads-gst": { purpose: "Resurface 2 km after monsoon damage.", budget: 8500000, original_end_date: "2026-10-10",
    delays: [
      { id: "dl1", old_end_date: "2026-10-10", new_end_date: "2026-10-20", reason_category: "weather", note: "Heavy rain for a week.", created_at: "2026-10-02T08:00:00Z" },
      { id: "dl2", old_end_date: "2026-10-20", new_end_date: "2026-10-30", reason_category: "material_shortage", note: "Bitumen delivery late.", created_at: "2026-10-09T08:00:00Z" },
    ], follower_count: 6, verifications: { happening: 2, not_happening: 4 } },
};
const SEED_COMPLAINTS: Complaint[] = [
  { id: "c1", tracking_id: "RW-2026-0001", category: "pothole", description: "Deep pothole next to the trench.", photo_url: null, lat: 13.0835, lng: 80.2715, project_id: "p-water-anna", status: "submitted", response: null, upvotes: 5, created_at: "2026-10-08T09:00:00Z" },
  { id: "c2", tracking_id: "RW-2026-0002", category: "no_barricade", description: "Open trench with no barricade at night.", photo_url: null, lat: 13.0840, lng: 80.2730, project_id: "p-water-anna", status: "acknowledged", response: "Barricades being fitted today.", upvotes: 3, created_at: "2026-10-07T18:00:00Z" },
  { id: "c3", tracking_id: "RW-2026-0003", category: "debris", description: "Rubble left on the footpath.", photo_url: null, lat: 12.9950, lng: 80.2140, project_id: null, status: "submitted", response: null, upvotes: 1, created_at: "2026-10-09T07:30:00Z" },
  { id: "c4", tracking_id: "RW-2026-0004", category: "unfinished_work", description: "Half-finished patch on the road.", photo_url: null, lat: 12.9960, lng: 80.2150, project_id: "p-roads-gst", status: "resolved", response: "Patch completed on 8 Oct.", upvotes: 2, created_at: "2026-10-01T12:00:00Z" },
];
const SEED_AUDIT: AuditEntry[] = [
  { id: "a1", actor_name: "Water Board demo", action: "project.create", entity: "project", entity_id: "p-water-anna", details: { title: "Water pipeline replacement, Anna Salai" }, created_at: "2026-09-25T10:00:00Z" },
  { id: "a2", actor_name: "Roads Department demo", action: "project.delay", entity: "project", entity_id: "p-roads-gst", details: { from: "2026-10-20", to: "2026-10-30", reason: "material_shortage" }, created_at: "2026-10-09T08:00:00Z" },
];

export function getStoredProjects(): ProjectSummary[] {
  return ls.get<ProjectSummary[]>("mock_projects", SEED_PROJECTS);
}
export function saveProjects(p: ProjectSummary[]) {
  ls.set("mock_projects", p);
}

export function getStoredDetailExtra(): Record<string, Partial<ProjectDetail>> {
  return ls.get<Record<string, Partial<ProjectDetail>>>("mock_detail_extra", SEED_DETAIL_EXTRA);
}
export function saveDetailExtra(d: Record<string, Partial<ProjectDetail>>) {
  ls.set("mock_detail_extra", d);
}

export function getStoredComplaints(): Complaint[] {
  return ls.get<Complaint[]>("mock_complaints", SEED_COMPLAINTS);
}
export function saveComplaints(c: Complaint[]) {
  ls.set("mock_complaints", c);
}

export function getStoredAudit(): AuditEntry[] {
  return ls.get<AuditEntry[]>("mock_audit", SEED_AUDIT);
}
export function saveAudit(a: AuditEntry[]) {
  ls.set("mock_audit", a);
}

export function getStoredDepts(): Department[] {
  return ls.get<Department[]>("mock_depts", DEPTS);
}
export function saveDepts(d: Department[]) {
  ls.set("mock_depts", d);
}

/** Set by the auth layer so mock writes know who is acting. */
let mockUser: { id: string; dept: Department | null; name: string } | null = null;
export const setMockUser = (u: typeof mockUser) => { mockUser = u; };
export const MOCK_DEPARTMENTS = DEPTS;
const uid = () => Math.random().toString(36).slice(2, 10);
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const audit = (action: string, entity: string, entity_id: string, details: Record<string, unknown>) => {
  const cur = getStoredAudit();
  const entry: AuditEntry = { id: uid(), actor_name: mockUser?.name ?? "demo", action, entity, entity_id, details, created_at: new Date().toISOString() };
  saveAudit([entry, ...cur]);
};

// ---------- conflict engine mock (spec section 5; real one is P1's) ----------
function checkConflicts(geojson: ProjectSummary["geojson"], start: string, end: string, selfId?: string): Conflict[] {
  const out: Conflict[] = [];
  const projects = getStoredProjects();
  for (const p of projects) {
    if (p.status === "cancelled" || p.id === selfId) continue;
    const dist = lineDistanceM(geojson, p.geojson);
    if (dist > 20) continue;
    if (!(p.start_date <= addDaysIso(end, 180) && p.end_date >= addDaysIso(start, -180))) continue;
    const intersects = start <= p.end_date && p.start_date <= end;
    const gap = intersects ? 0 : Math.max(daysBetween(p.end_date, start), daysBetween(end, p.start_date));
    const severity: Severity = intersects ? "high" : gap <= 30 ? "medium" : "low";
    const shiftStart = addDaysIso(p.end_date, 8);
    const duration = daysBetween(start, end);
    out.push({
      project_id: p.id, title: p.title, department: p.department.name, severity, distance_m: Math.round(dist * 10) / 10,
      start_date: p.start_date, end_date: p.end_date,
      suggestions: {
        merge: { start_date: start < p.start_date ? start : p.start_date, end_date: end > p.end_date ? end : p.end_date },
        shift: { start_date: shiftStart, end_date: addDaysIso(shiftStart, duration) },
      },
    });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function requireResolved(conflicts: Conflict[], resolutions: Resolution[] = []) {
  const unresolved = conflicts.filter((c) => !resolutions.some((r) => r.conflicting_project_id === c.project_id &&
    (r.decision !== "proceed_with_justification" || (r.justification ?? "").trim().length >= 20)));
  if (unresolved.length) throw new ApiError("Resolve every clash before saving.", "CONFLICT_UNRESOLVED", 409, conflicts);
}

const detail = (p: ProjectSummary): ProjectDetail => {
  const extra = getStoredDetailExtra();
  return {
    purpose: null, budget: null, original_end_date: addDaysIso(p.end_date, -p.delay_days), updates: [], delays: [],
    redig_count: p.redig_count_12m, follower_count: 0, verifications: { happening: 0, not_happening: 0 },
    ...p, ...(extra[p.id] ?? {}),
  } as ProjectDetail;
};

// ---------- router ----------
type Body = any; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function mockRoute(method: string, path: string, rawBody?: Body): Promise<unknown> {
  await wait();
  const url = new URL(path, "http://x");
  const p = url.pathname;
  const q = url.searchParams;
  const body: Body = rawBody instanceof FormData ? Object.fromEntries(rawBody.entries()) : rawBody ?? {};
  let m: RegExpMatchArray | null;

  if (method === "GET" && p === "/api/departments")
    return getStoredDepts().filter((d) => d.approved || q.get("include_pending") === "true");
  if (method === "GET" && p === "/api/roads") return ROADS;

  if (method === "POST" && p === "/api/projects/check-conflicts") {
    if (!body.geojson?.coordinates || body.geojson.coordinates.length < 2) throw new ApiError("Draw the road segment on the map.", "INVALID_GEOMETRY", 400);
    if (body.end_date < body.start_date) throw new ApiError("End date must be on or after the start date.", "INVALID_DATES", 400);
    return { conflicts: checkConflicts(body.geojson, body.start_date, body.end_date, body.self_id) };
  }
  if (method === "GET" && p === "/api/projects") {
    let list = getStoredProjects();
    if (q.get("department_id")) list = list.filter((x) => x.department.id === q.get("department_id"));
    if (q.get("status")) list = list.filter((x) => x.status === q.get("status"));
    if (q.get("closure_type")) list = list.filter((x) => x.closure_type === q.get("closure_type"));
    if (q.get("q")) {
      const query = q.get("q")!.toLowerCase();
      list = list.filter((x) => (x.title + " " + x.department.name + " " + (x.contractor ?? "")).toLowerCase().includes(query));
    }
    if (q.get("from")) list = list.filter((x) => x.end_date >= q.get("from")!);
    if (q.get("to")) list = list.filter((x) => x.start_date <= q.get("to")!);
    return list;
  }
  if (method === "POST" && p === "/api/projects") {
    for (const f of ["title", "start_date", "end_date"]) if (!body[f]) throw new ApiError(`${f} is required.`, "VALIDATION", 400);
    if (!body.geojson?.coordinates || body.geojson.coordinates.length < 2) throw new ApiError("Draw the road segment on the map.", "INVALID_GEOMETRY", 400);
    if (body.end_date < body.start_date) throw new ApiError("End date must be on or after the start date.", "INVALID_DATES", 400);
    const conflicts = checkConflicts(body.geojson, body.start_date, body.end_date);
    requireResolved(conflicts, body.resolutions);
    const allDepts = getStoredDepts();
    const dept = (body.department_id ? allDepts.find((d) => d.id === body.department_id) : null) ?? mockUser?.dept ?? allDepts[0];
    const np: ProjectSummary = {
      id: `p-${uid()}`, title: body.title, department: { id: dept.id, name: dept.name, color: dept.color },
      contractor: body.contractor ?? null, status: "planned", closure_type: (body.closure_type as ClosureType) ?? "none", start_date: body.start_date, end_date: body.end_date,
      delay_days: 0, road_id: body.road_id ?? null, geojson: body.geojson, redig_count_12m: 1,
    };
    const currentProjects = getStoredProjects();
    saveProjects([np, ...currentProjects]);
    const currentDetails = getStoredDetailExtra();
    currentDetails[np.id] = { purpose: body.purpose ?? null, budget: body.budget ?? null, original_end_date: body.end_date };
    saveDetailExtra(currentDetails);
    (body.resolutions ?? []).forEach((r: Resolution) => audit("conflict.resolve", "project", np.id, { ...r }));
    audit("project.create", "project", np.id, { title: np.title, department: np.department.name });
    return np;
  }
  if ((m = p.match(/^\/api\/projects\/([^/]+)$/))) {
    const projects = getStoredProjects();
    const idx = projects.findIndex((x) => x.id === m![1]);
    if (idx < 0) throw new ApiError("Project not found.", "NOT_FOUND", 404);
    if (method === "GET") return detail(projects[idx]);
    if (method === "PATCH") {
      if (body.start_date || body.end_date) throw new ApiError("Dates change through the delay flow.", "VALIDATION", 400);
      const cur = projects[idx];
      if (body.status === "cancelled" && !(body.note ?? "").trim()) throw new ApiError("A cancellation reason is required.", "VALIDATION", 400);
      const updated = {
        ...cur,
        ...(body.title ? { title: body.title } : {}),
        ...(body.contractor !== undefined ? { contractor: body.contractor } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.closure_type ? { closure_type: body.closure_type } : {}),
      };
      projects[idx] = updated;
      saveProjects(projects);
      const details = getStoredDetailExtra();
      details[cur.id] = {
        ...details[cur.id],
        ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
        ...(body.budget !== undefined ? { budget: body.budget } : {}),
      };
      saveDetailExtra(details);
      if (body.closure_type && body.closure_type !== cur.closure_type) audit("project.closure_type", "project", cur.id, { from: cur.closure_type, to: body.closure_type });
      if (body.status && body.status !== cur.status) audit("project.status", "project", cur.id, { from: cur.status, to: body.status, note: body.note });
      return updated;
    }
  }
  if ((m = p.match(/^\/api\/projects\/([^/]+)\/delays$/)) && method === "POST") {
    const projects = getStoredProjects();
    const idx = projects.findIndex((x) => x.id === m![1]);
    if (idx < 0) throw new ApiError("Project not found.", "NOT_FOUND", 404);
    const cur = projects[idx];
    if (!body.reason_category) throw new ApiError("A delay reason is required.", "DELAY_REASON_REQUIRED", 400);
    if (!body.new_end_date || body.new_end_date <= cur.end_date) throw new ApiError("The new end date must be after the current end date.", "INVALID_DATES", 400);
    const conflicts = checkConflicts(cur.geojson, cur.start_date, body.new_end_date, cur.id);
    requireResolved(conflicts, body.resolutions);
    const rec = { id: uid(), old_end_date: cur.end_date, new_end_date: body.new_end_date, reason_category: body.reason_category, note: body.note ?? null, created_at: new Date().toISOString() };
    const details = getStoredDetailExtra();
    const base = details[cur.id] ?? {};
    details[cur.id] = { ...base, original_end_date: base.original_end_date ?? cur.end_date, delays: [...(base.delays ?? []), rec] };
    saveDetailExtra(details);
    projects[idx] = { ...cur, end_date: body.new_end_date, status: "delayed", delay_days: daysBetween(details[cur.id].original_end_date!, body.new_end_date) };
    saveProjects(projects);
    audit("project.delay", "project", cur.id, { from: cur.end_date, to: body.new_end_date, reason: body.reason_category });
    return { project: projects[idx], delay: rec };
  }
  if ((m = p.match(/^\/api\/projects\/([^/]+)\/updates$/)) && method === "POST") {
    if (!(body.note ?? "").trim()) throw new ApiError("Write a short note for the update.", "VALIDATION", 400);
    const details = getStoredDetailExtra();
    const base = details[m![1]] ?? {};
    const u = { id: uid(), note: body.note, photo_url: null, created_at: new Date().toISOString(), author_name: mockUser?.name ?? null };
    details[m![1]] = { ...base, updates: [u, ...(base.updates ?? [])] };
    saveDetailExtra(details);
    return u;
  }
  if ((m = p.match(/^\/api\/projects\/([^/]+)\/merge$/)) && method === "POST") {
    const projects = getStoredProjects();
    const idx = projects.findIndex((x) => x.id === m![1]);
    if (idx < 0 || !projects.some((x) => x.id === body.into_id)) throw new ApiError("Project not found.", "NOT_FOUND", 404);
    projects[idx] = { ...projects[idx], status: "cancelled" };
    saveProjects(projects);
    audit("project.merge", "project", m[1], { into: body.into_id, note: body.note });
    return projects[idx];
  }

  if (method === "GET" && p === "/api/complaints") {
    let list = getStoredComplaints();
    if (q.get("status")) list = list.filter((c) => c.status === q.get("status"));
    if (q.get("project_id")) list = list.filter((c) => c.project_id === q.get("project_id"));
    return list;
  }
  if ((m = p.match(/^\/api\/complaints\/([^/]+)$/))) {
    const complaints = getStoredComplaints();
    const idx = complaints.findIndex((c) => c.id === m![1]);
    if (idx < 0) throw new ApiError("Complaint not found.", "NOT_FOUND", 404);
    if (method === "PATCH") {
      complaints[idx] = { ...complaints[idx], ...(body.status ? { status: body.status } : {}), ...(body.response !== undefined ? { response: body.response } : {}), ...(body.project_id !== undefined ? { project_id: body.project_id } : {}) };
      saveComplaints(complaints);
      return complaints[idx];
    }
    if (method === "DELETE") {
      const id = complaints[idx].id;
      const updated = complaints.filter((c) => c.id !== id);
      saveComplaints(updated);
      audit("complaint.delete", "complaint", id, {});
      return { ok: true };
    }
  }
  if (method === "GET" && p === "/api/dept/calendar") {
    const from = q.get("from") ?? "0000-01-01", to = q.get("to") ?? "9999-12-31";
    return getStoredProjects().filter((x) => x.status !== "cancelled" && x.end_date >= from && x.start_date <= to);
  }
  if ((m = p.match(/^\/api\/departments\/([^/]+)\/approve$/)) && method === "PATCH") {
    const depts = getStoredDepts();
    const d = depts.find((x) => x.id === m![1]);
    if (!d) throw new ApiError("Department not found.", "NOT_FOUND", 404);
    d.approved = true;
    saveDepts(depts);
    audit("department.approve", "department", d.id, { name: d.name });
    return d;
  }
  if (method === "GET" && p === "/api/audit-log") return getStoredAudit();
  throw new ApiError(`No mock for ${method} ${p}`, "NOT_FOUND", 404);
}
