"use client";
// Conflict warning UI (A3). Shows who, where and when, then three actions per clash:
// merge schedules, shift my dates, or proceed with a written justification (min 20 chars).
import { pretty } from "@/lib/dates";
import type { Conflict, Decision, Resolution, Severity } from "@/lib/types";

export const MIN_JUSTIFICATION = 20;

export type ResolutionMap = Record<string, Resolution>;

export function isResolved(r?: Resolution) {
  if (!r) return false;
  return r.decision !== "proceed_with_justification" || (r.justification ?? "").trim().length >= MIN_JUSTIFICATION;
}
export const allResolved = (conflicts: Conflict[], map: ResolutionMap) => conflicts.every((c) => isResolved(map[c.project_id]));

const SEV: Record<Severity, { label: string; cls: string; msg: (internal: boolean) => string }> = {
  high: { label: "High", cls: "bg-red-100 text-red-800 border-red-300", msg: (i) => (i ? "Overlaps with another project of your own department" : "Overlaps with a project by another department") },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-900 border-amber-300", msg: () => "Starts or ends within 30 days of another dig" },
  low: { label: "Low", cls: "bg-sky-100 text-sky-900 border-sky-300", msg: () => "Road was or will be dug within 6 months" },
};

const OPTIONS: { value: Decision; title: string }[] = [
  { value: "merge_schedules", title: "Merge schedules" },
  { value: "shift_dates", title: "Shift my dates" },
  { value: "proceed_with_justification", title: "Proceed with justification" },
];

interface Props {
  conflicts: Conflict[];
  resolutions: ResolutionMap;
  ownDepartment?: string;
  onResolve: (conflict: Conflict, r: Resolution | null) => void;
  /** Called when merge/shift is picked so the form can adopt the suggested dates. */
  onApplyDates: (start: string, end: string) => void;
  /** Delay flow: start date is fixed, so shifting dates is not offered. */
  lockStart?: boolean;
}

export default function ConflictPanel({ conflicts, resolutions, ownDepartment, onResolve, onApplyDates, lockStart }: Props) {
  const open = conflicts.filter((c) => !isResolved(resolutions[c.project_id])).length;
  return (
    <section aria-label="Clashes with other works" className="rounded-lg border-2 border-st-delayed/50 bg-red-50/60 p-4">
      <h2 className="text-base font-semibold">
        {conflicts.length === 1 ? "This work clashes with 1 other project" : `This work clashes with ${conflicts.length} other projects`}
      </h2>
      <p className="mt-0.5 text-sm" role="status">
        {open === 0 ? "Every clash has a decision. You can save now." : `${open} still need a decision before you can save.`}
      </p>
      <ul className="mt-3 space-y-3">
        {conflicts.map((c) => {
          const r = resolutions[c.project_id];
          const internal = !!ownDepartment && c.department === ownDepartment;
          const sev = SEV[c.severity];
          const options = lockStart ? OPTIONS.filter((o) => o.value !== "shift_dates") : OPTIONS;
          return (
            <li key={c.project_id} className="rounded-md border border-line bg-white p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sev.cls}`}>{sev.label}</span>
                <span className="font-medium">{c.title}</span>
              </div>
              <p className="mt-1 text-sm text-ink/80">
                {c.department} · {pretty(c.start_date)} to {pretty(c.end_date)} · {c.distance_m} m away
              </p>
              <p className="text-sm text-ink/80">{sev.msg(internal)}.</p>

              <fieldset className="mt-3">
                <legend className="mb-1 text-sm font-medium">How will you handle this?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {options.map((o) => {
                    const checked = r?.decision === o.value;
                    return (
                      <label key={o.value} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${checked ? "border-brand bg-brand-soft font-medium" : "border-line"}`}>
                        <input type="radio" name={`res-${c.project_id}`} checked={checked} className="accent-[#0e5a6b]"
                          onChange={() => {
                            const base: Resolution = { conflicting_project_id: c.project_id, severity: c.severity, decision: o.value };
                            if (o.value === "merge_schedules") onApplyDates(c.suggestions.merge.start_date, c.suggestions.merge.end_date);
                            if (o.value === "shift_dates") onApplyDates(c.suggestions.shift.start_date, c.suggestions.shift.end_date);
                            onResolve(c, o.value === "proceed_with_justification" ? { ...base, justification: r?.justification ?? "" } : base);
                          }} />
                        {o.title}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {r?.decision === "merge_schedules" && (
                <p className="mt-2 text-sm text-ink/80">
                  Proposed joint window: {pretty(c.suggestions.merge.start_date)} to {pretty(c.suggestions.merge.end_date)}. Both departments confirm it. Your dates were updated to match.
                </p>
              )}
              {r?.decision === "shift_dates" && (
                <p className="mt-2 text-sm text-ink/80">
                  New dates: {pretty(c.suggestions.shift.start_date)} to {pretty(c.suggestions.shift.end_date)} (starts the day after the other work ends, plus a 7-day buffer). Your dates were updated to match.
                </p>
              )}
              {r?.decision === "proceed_with_justification" && (
                <div className="mt-2">
                  <label className="label" htmlFor={`just-${c.project_id}`}>Written justification</label>
                  <textarea id={`just-${c.project_id}`} rows={3} className="field" value={r.justification ?? ""}
                    placeholder="Why does this work need to go ahead as planned?"
                    onChange={(e) => onResolve(c, { ...r, justification: e.target.value })} />
                  <p className={`mt-1 text-xs ${(r.justification ?? "").trim().length >= MIN_JUSTIFICATION ? "text-st-completed" : "text-ink/70"}`}>
                    {(r.justification ?? "").trim().length}/{MIN_JUSTIFICATION} characters minimum. Admins can read this, and the project gets a visible “Clash acknowledged” tag.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
