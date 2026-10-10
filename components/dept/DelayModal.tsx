"use client";
// Delay reasons (A4): extending an end date always goes through this mandatory modal.
// It stores old + new end date, flips status to delayed (server side), and re-runs conflict detection on the new end date.
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysIso, daysBetween, pretty } from "@/lib/dates";
import { DELAY_REASON_LABEL, type DelayReason, type ProjectDetail } from "@/lib/types";
import ConflictPanel from "./ConflictPanel";
import { Modal } from "./ui";
import { useConflicts } from "./useConflicts";

export default function DelayModal({ project, onClose, onDone }: { project: ProjectDetail; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [newEnd, setNewEnd] = useState("");
  const [reason, setReason] = useState<DelayReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  const minEnd = addDaysIso(project.end_date, 1);
  const validDate = !!newEnd && newEnd > project.end_date;
  const cf = useConflicts({ geojson: project.geojson, start: project.start_date, end: validDate ? newEnd : "", selfId: project.id, enabled: validDate });

  const noteOk = note.trim().length >= 5;
  const ready = validDate && !!reason && noteOk && !cf.checking && (cf.conflicts.length === 0 || cf.resolved);
  const extra = validDate ? daysBetween(project.end_date, newEnd) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError(null);
    try {
      await api(`/api/projects/${project.id}/delays`, {
        method: "POST", json: { new_end_date: newEnd, reason_category: reason, note: note.trim(), resolutions: cf.resolutionList },
      });
      onDone();
    } catch (err) {
      const ae = err as ApiError;
      if (ae.code === "CONFLICT_UNRESOLVED" && ae.conflicts) { cf.adopt(ae.conflicts); setError("The new date clashes with other works. Review them below."); }
      else setError(ae.message);
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Extend end date" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink/80">
          {project.title} is planned to end on <strong>{pretty(project.end_date)}</strong>. Residents and followers will see the new date and your reason.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="newEnd">New end date</label>
            <input ref={first} id="newEnd" type="date" className="field" min={minEnd} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reason">Reason for the delay</label>
            <select id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value as DelayReason)}>
              <option value="">Choose a reason…</option>
              {(Object.keys(DELAY_REASON_LABEL) as DelayReason[]).map((k) => <option key={k} value={k}>{DELAY_REASON_LABEL[k]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="delayNote">Explain for residents</label>
          <textarea id="delayNote" rows={3} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened and what is the new plan?" />
          <p className="mt-1 text-xs text-ink/70">At least 5 characters.</p>
        </div>
        {project.closure_type === "full_closure" && (
          <p className="rounded-md border border-line bg-brand-soft p-2 text-sm">This work is a full closure. The new end date keeps the road closed in the route planner until then.</p>
        )}
        {validDate && (
          <p className="text-sm">
            Adds {extra} {extra === 1 ? "day" : "days"}. Total delay will be {daysBetween(project.original_end_date, newEnd)} days against the original end date of {pretty(project.original_end_date)}.
          </p>
        )}
        {newEnd && !validDate && <p role="alert" className="text-sm text-st-delayed">The new end date must be after {pretty(project.end_date)}.</p>}
        {validDate && cf.checking && <p className="text-sm text-ink/70">Checking the new dates for clashes…</p>}
        {cf.checkError && <p role="alert" className="text-sm text-st-delayed">{cf.checkError}</p>}
        {cf.conflicts.length > 0 && (
          <ConflictPanel conflicts={cf.conflicts} resolutions={cf.resolutions} ownDepartment={user?.department?.name ?? project.department.name}
            onResolve={cf.resolve} onApplyDates={() => {}} lockStart />
        )}
        {error && <p role="alert" className="text-sm text-st-delayed">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={!ready || busy}>{busy ? "Saving…" : "Save new end date"}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
