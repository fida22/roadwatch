// Shared shapes. Source of truth: build doc section 6. Fields marked "ASK P1" are things P3 screens need
// that the doc does not spell out yet; see docs/P3_NOTES_FOR_P1.md.

export type Role = "resident" | "department" | "admin";
export type ProjectStatus = "planned" | "ongoing" | "delayed" | "completed" | "cancelled";
export type ClosureType = "none" | "lane_restriction" | "full_closure"; // v2: only full_closure is avoided by routing
export type Severity = "high" | "medium" | "low";
export type Decision = "merge_schedules" | "shift_dates" | "proceed_with_justification";
export type DelayReason =
  | "weather" | "material_shortage" | "permit_pending" | "utility_clash" | "funds" | "contractor_issue" | "other";
export type ComplaintCategory = "pothole" | "unfinished_work" | "no_barricade" | "debris" | "other";
export type ComplaintStatus = "submitted" | "acknowledged" | "in_progress" | "resolved";

export interface LineStringGeoJSON { type: "LineString"; coordinates: [number, number][] } // [lng, lat]

export interface Department { id: string; name: string; color: string; approved?: boolean }

export interface AppUser {
  id: string; email: string; full_name: string | null; role: Role;
  department_id: string | null; department: Department | null;
}

export interface ProjectSummary {
  id: string; title: string;
  department: { id: string; name: string; color: string };
  contractor: string | null; status: ProjectStatus; closure_type: ClosureType;
  start_date: string; end_date: string; delay_days: number;
  road_id: string | null; geojson: LineStringGeoJSON; redig_count_12m: number;
}

export interface ProjectUpdate { id: string; note: string; photo_url: string | null; created_at: string; author_name?: string | null }
export interface DelayRecord {
  id: string; old_end_date: string; new_end_date: string; reason_category: DelayReason; note: string | null; created_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  purpose: string | null; budget: number | null; original_end_date: string;
  updates: ProjectUpdate[]; delays: DelayRecord[];
  redig_count: number; follower_count: number;
  verifications: { happening: number; not_happening: number };
}

export interface ConflictSuggestions {
  merge: { start_date: string; end_date: string };
  shift: { start_date: string; end_date: string };
}
export interface Conflict {
  project_id: string; title: string; department: string; severity: Severity; distance_m: number;
  start_date: string; end_date: string; suggestions: ConflictSuggestions;
}

/** One entry of resolutions[] sent with POST /api/projects and POST /api/projects/:id/delays. ASK P1: confirm shape. */
export interface Resolution {
  conflicting_project_id: string; severity: Severity; decision: Decision; justification?: string;
}

export interface Complaint {
  id: string; tracking_id: string; category: ComplaintCategory; description: string | null; photo_url: string | null;
  lat: number; lng: number; project_id: string | null; status: ComplaintStatus; response: string | null;
  upvotes: number; created_at: string;
}

export interface Road { id: string; name: string; ward: string | null; geojson: LineStringGeoJSON }

export interface AuditEntry {
  id: string; actor_name: string | null; action: string; entity: string; entity_id: string | null;
  details: Record<string, unknown> | null; created_at: string;
}

export interface ApiErrorBody { error: string; code: string; conflicts?: Conflict[] }

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: "Planned", ongoing: "Ongoing", delayed: "Delayed", completed: "Completed", cancelled: "Cancelled",
};
export const CLOSURE_LABEL: Record<ClosureType, string> = {
  none: "No traffic impact", lane_restriction: "Lane restriction", full_closure: "Full closure",
};
export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planned: "#2563eb", ongoing: "#f97316", delayed: "#dc2626", completed: "#16a34a", cancelled: "#6b7280",
};
export const DELAY_REASON_LABEL: Record<DelayReason, string> = {
  weather: "Weather", material_shortage: "Material shortage", permit_pending: "Permit pending",
  utility_clash: "Utility clash", funds: "Funds", contractor_issue: "Contractor issue", other: "Other",
};
export const COMPLAINT_CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  pothole: "Pothole", unfinished_work: "Unfinished work", no_barricade: "No barricade", debris: "Debris", other: "Other",
};
export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  submitted: "Submitted", acknowledged: "Acknowledged", in_progress: "In progress", resolved: "Resolved",
};
export const COMPLAINT_STATUS_ORDER: ComplaintStatus[] = ["submitted", "acknowledged", "in_progress", "resolved"];
