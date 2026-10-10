import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { DB } from './db';
import { ApiError } from './errors';
import { CLASH_DISTANCE_M } from './constants';

export type Severity = 'high' | 'medium' | 'low';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export const MAX_DISTANCE_M = CLASH_DISTANCE_M;
export const WINDOW_DAYS = 180;
export const BUFFER_DAYS = 7;

// Pure: severity from two date ranges (inclusive ends). null = outside the 180-day window.
export function classify(newStart: string, newEnd: string, oStart: string, oEnd: string) {
  const intersects = newStart <= oEnd && oStart <= newEnd; // ISO strings compare correctly
  if (intersects) return { severity: 'high' as Severity, gap: 0 };
  const gap = Math.max(
    differenceInCalendarDays(parseISO(newStart), parseISO(oEnd)),
    differenceInCalendarDays(parseISO(oStart), parseISO(newEnd))
  );
  if (gap <= 30) return { severity: 'medium' as Severity, gap };
  if (gap <= WINDOW_DAYS) return { severity: 'low' as Severity, gap };
  return null;
}

// Pure: the two suggested fixes
export function suggest(newStart: string, newEnd: string, oStart: string, oEnd: string) {
  const durationDays = differenceInCalendarDays(parseISO(newEnd), parseISO(newStart));
  const shiftStart = addDays(parseISO(oEnd), 1 + BUFFER_DAYS);
  return {
    merge: {
      start_date: oStart < newStart ? oStart : newStart,
      end_date: oEnd > newEnd ? oEnd : newEnd,
    },
    shift: {
      start_date: fmt(shiftStart),
      end_date: fmt(addDays(shiftStart, durationDays)),
    },
  };
}

export type Conflict = {
  project_id: string;
  title: string;
  department: string;
  severity: Severity;
  distance_m: number;
  start_date: string;
  end_date: string;
  status: string;
  internal: boolean;
  suggestions: ReturnType<typeof suggest>;
};

const ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export async function findConflicts(
  db: DB,
  a: { geojson: object; start: string; end: string; selfId?: string | null; departmentId?: string | null }
): Promise<Conflict[]> {
  const g = JSON.stringify(a.geojson);
  const rows = await db`
    select p.id, p.title, d.name as department, p.department_id, p.start_date, p.end_date, p.status,
      st_distance(p.geom::geography, st_setsrid(st_geomfromgeojson(${g}::text), 4326)::geography) as meters
    from projects p join departments d on d.id = p.department_id
    where p.status <> 'cancelled'
      and p.id is distinct from ${a.selfId ?? null}::uuid
      and st_dwithin(p.geom::geography, st_setsrid(st_geomfromgeojson(${g}::text), 4326)::geography, ${MAX_DISTANCE_M}::float8)
      and p.start_date <= ${a.end}::date + interval '180 days'
      and p.end_date >= ${a.start}::date - interval '180 days'`;

  const out: Conflict[] = [];
  for (const r of rows) {
    const c = classify(a.start, a.end, r.start_date, r.end_date);
    if (!c) continue;
    out.push({
      project_id: r.id,
      title: r.title,
      department: r.department,
      severity: c.severity,
      distance_m: Math.round(Number(r.meters) * 10) / 10,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      internal: !!a.departmentId && r.department_id === a.departmentId, // same-department overlap
      suggestions: suggest(a.start, a.end, r.start_date, r.end_date),
    });
  }
  return out.sort((x, y) => ORDER[x.severity] - ORDER[y.severity] || x.distance_m - y.distance_m);
}

// ---- resolutions ----
export type Resolution = {
  conflicting_project_id: string;
  decision: 'merge_schedules' | 'shift_dates' | 'proceed_with_justification';
  justification?: string;
  severity?: Severity;
};

const DECISIONS = ['merge_schedules', 'shift_dates', 'proceed_with_justification'];

export function checkResolutions(conflicts: Conflict[], res: Resolution[]) {
  for (const r of res) {
    if (!DECISIONS.includes(r.decision))
      throw new ApiError(400, 'VALIDATION', 'Invalid decision');
    if (r.decision === 'proceed_with_justification' && (r.justification ?? '').trim().length < 20)
      throw new ApiError(400, 'VALIDATION', 'Justification must be at least 20 characters');
  }
  const missing = conflicts.filter((c) => !res.some((r) => r.conflicting_project_id === c.project_id));
  if (missing.length)
    throw new ApiError(409, 'CONFLICT_UNRESOLVED', 'Resolve all clashes before saving', { conflicts });
}

export async function saveResolutions(
  db: DB, projectId: string, userId: string, conflicts: Conflict[], res: Resolution[]
) {
  for (const r of res) {
    const sev = conflicts.find((c) => c.project_id === r.conflicting_project_id)?.severity ?? r.severity ?? 'low';
    await db`
      insert into conflict_resolutions (project_id, conflicting_project_id, severity, decision, justification, decided_by)
      values (${projectId}, ${r.conflicting_project_id}, ${sev}::conflict_severity,
              ${r.decision}::conflict_decision, ${r.justification ?? null}, ${userId})`;
  }
}