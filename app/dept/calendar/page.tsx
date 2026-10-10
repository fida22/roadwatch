"use client";
// Coordination calendar (A8): Gantt-style view of every department's works so planners see overlaps before they happen.
import { useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import DeptShell from "@/components/dept/DeptShell";
import { DeptChip, EmptyState, ErrorState, Loading, useAsync } from "@/components/dept/ui";
import { api, qs } from "@/lib/api";
import { iso, prettyShort, todayIso } from "@/lib/dates";
import { STATUS_COLOR, STATUS_LABEL, type ProjectSummary } from "@/lib/types";

const MONTHS = 6;

function Gantt() {
  const [anchor, setAnchor] = useState(() => startOfMonth(addMonths(new Date(), -1)));
  const [dept, setDept] = useState<string>("all");
  const from = iso(anchor), to = iso(endOfMonth(addMonths(anchor, MONTHS - 1)));
  const { data, error, loading, reload } = useAsync(() => api<ProjectSummary[]>(`/api/dept/calendar${qs({ from, to })}`), [from, to]);

  const total = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  const pct = (d: string) => (differenceInCalendarDays(parseISO(d), parseISO(from)) / total) * 100;

  const rows = useMemo(() => [...(data ?? [])].filter((p) => dept === "all" || p.department.id === dept).sort((a, b) => a.start_date.localeCompare(b.start_date)), [data, dept]);
  const depts = useMemo(() => Array.from(new Map((data ?? []).map((p) => [p.department.id, p.department])).values()), [data]);

  // overlap = same road and date ranges intersect (works from any department)
  const overlaps = useMemo(() => {
    const ids = new Set<string>(); const pairs: [ProjectSummary, ProjectSummary][] = [];
    const list = data ?? [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.road_id && a.road_id === b.road_id && a.start_date <= b.end_date && b.start_date <= a.end_date) { ids.add(a.id); ids.add(b.id); pairs.push([a, b]); }
    }
    return { ids, pairs };
  }, [data]);

  const months = Array.from({ length: MONTHS }, (_, i) => addMonths(anchor, i));
  const today = todayIso();
  const todayPct = today >= from && today <= to ? pct(today) : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Coordination calendar</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setAnchor(addMonths(anchor, -3))}>Earlier</button>
          <button className="btn-secondary" onClick={() => setAnchor(startOfMonth(addMonths(new Date(), -1)))}>Today</button>
          <button className="btn-secondary" onClick={() => setAnchor(addMonths(anchor, 3))}>Later</button>
        </div>
      </div>

      {loading && !data ? <Loading label="Loading works" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          {overlaps.pairs.length > 0 && (
            <div className="mb-4 rounded-md border border-st-delayed/40 bg-red-50 p-3 text-sm" role="status">
              <p className="font-medium">{overlaps.pairs.length} overlapping {overlaps.pairs.length === 1 ? "dig" : "digs"} on the same road in this window</p>
              <ul className="mt-1 list-disc pl-5">{overlaps.pairs.map(([a, b]) => <li key={a.id + b.id}>{a.title} ({a.department.name}) and {b.title} ({b.department.name})</li>)}</ul>
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by department">
            <button aria-pressed={dept === "all"} onClick={() => setDept("all")} className={`rounded-full border px-3 py-1.5 text-sm ${dept === "all" ? "border-brand bg-brand-soft font-medium" : "border-line bg-white"}`}>All departments</button>
            {depts.map((d) => (
              <button key={d.id} aria-pressed={dept === d.id} onClick={() => setDept(d.id)} className={`rounded-full border px-3 py-1.5 ${dept === d.id ? "border-brand bg-brand-soft" : "border-line bg-white"}`}><DeptChip name={d.name} color={d.color} /></button>
            ))}
          </div>

          {rows.length === 0 ? <EmptyState title="No works in this window" hint="Use Earlier or Later to move the calendar." /> : (
            <div className="panel overflow-x-auto !p-0">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[200px_1fr] border-b border-line text-xs text-ink/70">
                  <div className="p-2">Work</div>
                  <div className="relative h-8">
                    {months.map((m) => <span key={m.toISOString()} className="absolute top-2 border-l border-line pl-1" style={{ left: `${pct(iso(m))}%` }}>{format(m, "MMM yyyy")}</span>)}
                  </div>
                </div>
                {rows.map((p) => {
                  const left = Math.max(0, pct(p.start_date));
                  const right = Math.min(100, pct(p.end_date) + 100 / total);
                  const clash = overlaps.ids.has(p.id);
                  return (
                    <div key={p.id} className="grid grid-cols-[200px_1fr] items-center border-b border-line/60 last:border-0">
                      <Link href={`/dept/projects/${p.id}`} className="truncate p-2 text-sm hover:underline" title={p.title}>{p.title}</Link>
                      <div className="relative h-10">
                        {months.map((m) => <span key={m.toISOString()} className="absolute inset-y-0 border-l border-line/60" style={{ left: `${pct(iso(m))}%` }} />)}
                        {todayPct !== null && <span className="absolute inset-y-0 w-px bg-ink/60" style={{ left: `${todayPct}%` }} aria-hidden />}
                        <div className="absolute top-2 h-6 overflow-hidden rounded px-1.5 text-xs leading-6 text-white"
                          style={{ left: `${left}%`, width: `${Math.max(1, right - left)}%`, background: p.department.color, outline: clash ? "3px solid #dc2626" : `2px solid ${STATUS_COLOR[p.status]}`, outlineOffset: clash ? 1 : -2 }}
                          title={`${p.title}: ${prettyShort(p.start_date)} to ${prettyShort(p.end_date)} (${STATUS_LABEL[p.status]})`}>
                          {p.closure_type === "full_closure" ? "Closed · " : ""}{prettyShort(p.start_date)} to {prettyShort(p.end_date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-ink/70">Bar colour is the department. Border colour is status. A red border marks works that overlap on the same road. “Closed” marks a full road closure. The dark line is today.</p>
        </>
      )}
    </>
  );
}

export default function CalendarPage() {
  return <DeptShell><Gantt /></DeptShell>;
}
