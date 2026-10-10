"use client";
// Edit project and change status (A5), progress updates with photos (A6), merge or cancel (A11), delay flow (A4).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import DelayModal from "@/components/dept/DelayModal";
import DeptShell from "@/components/dept/DeptShell";
import { ClosureBadge, DeptChip, EmptyState, ErrorState, Loading, StatusBadge, useAsync } from "@/components/dept/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pretty, prettyTime } from "@/lib/dates";
import { CLOSURE_LABEL, DELAY_REASON_LABEL, STATUS_LABEL, type ClosureType, type ProjectDetail, type ProjectStatus, type ProjectSummary } from "@/lib/types";

const SETTABLE: ProjectStatus[] = ["planned", "ongoing", "completed", "cancelled"]; // "delayed" is set only by the delay flow

function Page() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: p, error, loading, reload } = useAsync(() => api<ProjectDetail>(`/api/projects/${id}`), [id]);
  const [delayOpen, setDelayOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  if (loading && !p) return <Loading label="Loading project" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!p) return <EmptyState title="Project not found" />;

  const mine = user?.role === "admin" || user?.department_id === p.department.id;
  if (!mine)
    return (
      <div className="panel" role="alert">
        <h1 className="text-lg font-semibold">This project belongs to {p.department.name}</h1>
        <p className="mt-1 text-sm text-ink/70">You can only edit your own department&apos;s works. Open the calendar to see everyone&apos;s plans.</p>
        <Link className="btn-primary mt-3" href="/dept/calendar">Open calendar</Link>
      </div>
    );

  const locked = p.status === "cancelled";
  const done = (msg: string) => { setFlash(msg); reload(); };

  return (
    <div className="space-y-5">
      <Link href="/dept" className="text-sm text-brand underline">Back to projects</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{p.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3"><StatusBadge status={p.status} /><ClosureBadge type={p.closure_type} /><DeptChip name={p.department.name} color={p.department.color} /></div>
        </div>
      </div>
      {flash && <p role="status" className="rounded-md border border-st-completed/40 bg-green-50 p-3 text-sm">{flash}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailsCard p={p} locked={locked} onSaved={() => done("Details saved.")} />
        <div className="space-y-5">
          <DatesCard p={p} locked={locked} onExtend={() => setDelayOpen(true)} />
          <StatusCard key={p.status} p={p} locked={locked} onSaved={() => done("Status updated.")} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <UpdatesCard p={p} locked={locked} onPosted={() => done("Update posted to the public timeline.")} />
        <DelayHistory p={p} />
      </div>
      {!locked && p.status !== "completed" && <MergeCard p={p} onMerged={() => done("Project merged. This row is now cancelled and points at the joint project.")} />}

      {delayOpen && <DelayModal project={p} onClose={() => setDelayOpen(false)} onDone={() => { setDelayOpen(false); done("End date extended. Followers will be notified."); }} />}
    </div>
  );
}

function DetailsCard({ p, locked, onSaved }: { p: ProjectDetail; locked: boolean; onSaved: () => void }) {
  const [title, setTitle] = useState(p.title);
  const [purpose, setPurpose] = useState(p.purpose ?? "");
  const [contractor, setContractor] = useState(p.contractor ?? "");
  const [budget, setBudget] = useState(p.budget?.toString() ?? "");
  const [closure, setClosure] = useState<ClosureType>(p.closure_type);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setErr("The title can't be empty.");
    if (budget && (isNaN(Number(budget)) || Number(budget) < 0)) return setErr("Budget must be a positive number.");
    setBusy(true); setErr(null);
    try { await api(`/api/projects/${p.id}`, { method: "PATCH", json: { title: title.trim(), purpose: purpose.trim() || null, contractor: contractor.trim() || null, budget: budget ? Number(budget) : null, closure_type: closure } }); onSaved(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="panel space-y-3" noValidate>
      <h2 className="font-semibold">Details</h2>
      <fieldset disabled={locked} className="space-y-3">
        <div><label className="label" htmlFor="e-title">Title</label><input id="e-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label" htmlFor="e-purpose">Purpose</label><textarea id="e-purpose" rows={3} className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="e-con">Contractor</label><input id="e-con" className="field" value={contractor} onChange={(e) => setContractor(e.target.value)} /></div>
          <div><label className="label" htmlFor="e-bud">Budget in ₹</label><input id="e-bud" inputMode="numeric" className="field" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        </div>
        <div>
          <label className="label" htmlFor="e-closure">Traffic impact</label>
          <select id="e-closure" className="field" value={closure} onChange={(e) => setClosure(e.target.value as ClosureType)} aria-describedby="e-closure-help">
            {(Object.keys(CLOSURE_LABEL) as ClosureType[]).map((k) => <option key={k} value={k}>{CLOSURE_LABEL[k]}</option>)}
          </select>
          <p id="e-closure-help" className="mt-1 text-xs text-ink/70">Full closures are avoided by the public route planner. Changing this is recorded in the audit log.</p>
        </div>
      </fieldset>
      {err && <p role="alert" className="text-sm text-st-delayed">{err}</p>}
      <button className="btn-primary" disabled={busy || locked}>{busy ? "Saving…" : "Save details"}</button>
    </form>
  );
}

function DatesCard({ p, locked, onExtend }: { p: ProjectDetail; locked: boolean; onExtend: () => void }) {
  return (
    <div className="panel space-y-2">
      <h2 className="font-semibold">Dates</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-ink/70">Start</dt><dd>{pretty(p.start_date)}</dd></div>
        <div><dt className="text-ink/70">End</dt><dd>{pretty(p.end_date)}</dd></div>
        <div><dt className="text-ink/70">Original end</dt><dd>{pretty(p.original_end_date)}</dd></div>
        <div><dt className="text-ink/70">Delay so far</dt><dd className={p.delay_days > 0 ? "font-medium text-st-delayed" : ""}>{p.delay_days} days</dd></div>
      </dl>
      <p className="text-sm text-ink/70">Dates only change here, with a reason that residents can read.</p>
      <button className="btn-secondary" onClick={onExtend} disabled={locked || p.status === "completed"}>Extend end date</button>
    </div>
  );
}

function StatusCard({ p, locked, onSaved }: { p: ProjectDetail; locked: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState<ProjectStatus>(p.status === "delayed" ? "ongoing" : p.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cancelling = status === "cancelled";
  const unchanged = status === p.status;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (cancelling && reason.trim().length < 10) return setErr("Give a cancellation reason of at least 10 characters. Residents will see it.");
    setBusy(true); setErr(null);
    try { await api(`/api/projects/${p.id}`, { method: "PATCH", json: { status, ...(cancelling ? { note: reason.trim() } : {}) } }); onSaved(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="panel space-y-3" noValidate>
      <h2 className="font-semibold">Status</h2>
      {p.status === "delayed" && <p className="text-sm text-ink/70">This project is marked delayed. Pick Ongoing once work is back on track, or Completed when finished.</p>}
      <div>
        <label className="label" htmlFor="status">Change status to</label>
        <select id="status" className="field" value={status} disabled={locked} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          {SETTABLE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {p.closure_type === "full_closure" && (status === "completed" || cancelling) && !locked && (
        <p className="rounded-md border border-line bg-brand-soft p-2 text-sm">This work is a full closure. {cancelling ? "Cancelling" : "Completing"} it reopens the road to the route planner straight away.</p>
      )}
      {cancelling && !locked && (
        <div>
          <label className="label" htmlFor="why">Reason for cancelling</label>
          <textarea id="why" rows={2} className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {err && <p role="alert" className="text-sm text-st-delayed">{err}</p>}
      <button className={cancelling ? "btn-danger" : "btn-primary"} disabled={busy || locked || (unchanged && p.status !== "delayed")}>
        {busy ? "Saving…" : cancelling ? "Cancel this project" : "Update status"}
      </button>
    </form>
  );
}

function UpdatesCard({ p, locked, onPosted }: { p: ProjectDetail; locked: boolean; onPosted: () => void }) {
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return setErr("Write a short note for residents.");
    if (photo && photo.size > 5 * 1024 * 1024) return setErr("Photo is larger than 5 MB. Pick a smaller one.");
    setBusy(true); setErr(null);
    try {
      const form = new FormData(); form.set("note", note.trim()); if (photo) form.set("photo", photo);
      await api(`/api/projects/${p.id}/updates`, { method: "POST", form });
      setNote(""); setPhoto(null); onPosted();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="panel space-y-3">
      <h2 className="font-semibold">Progress updates</h2>
      <form onSubmit={post} className="space-y-3" noValidate>
        <fieldset disabled={locked} className="space-y-3">
          <div><label className="label" htmlFor="note">What is the latest?</label><textarea id="note" rows={2} className="field" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div><label className="label" htmlFor="photo">Photo (optional)</label><input id="photo" type="file" accept="image/*" className="field" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
        </fieldset>
        {err && <p role="alert" className="text-sm text-st-delayed">{err}</p>}
        <button className="btn-primary" disabled={busy || locked}>{busy ? "Posting…" : "Post update"}</button>
      </form>
      {p.updates.length === 0 ? <p className="text-sm text-ink/70">No updates yet. Residents see these on the public timeline.</p> : (
        <ol className="space-y-3 border-t border-line pt-3">
          {p.updates.map((u) => (
            <li key={u.id} className="text-sm">
              <p className="text-xs text-ink/70">{prettyTime(u.created_at)}{u.author_name ? ` · ${u.author_name}` : ""}</p>
              <p>{u.note}</p>
              {u.photo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={u.photo_url} alt="Progress photo" className="mt-2 max-h-48 rounded-md border border-line" />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DelayHistory({ p }: { p: ProjectDetail }) {
  return (
    <div className="panel space-y-3">
      <h2 className="font-semibold">Delay history</h2>
      {p.delays.length === 0 ? <p className="text-sm text-ink/70">No delays recorded.</p> : (
        <ol className="space-y-3">
          {p.delays.map((d) => (
            <li key={d.id} className="text-sm">
              <p className="font-medium">{DELAY_REASON_LABEL[d.reason_category]}: {pretty(d.old_end_date)} to {pretty(d.new_end_date)}</p>
              {d.note && <p className="text-ink/80">{d.note}</p>}
              <p className="text-xs text-ink/70">{prettyTime(d.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MergeCard({ p, onMerged }: { p: ProjectDetail; onMerged: () => void }) {
  const { data } = useAsync(() => api<ProjectSummary[]>("/api/projects"), []);
  const [into, setInto] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const options = (data ?? []).filter((x) => x.id !== p.id && x.status !== "cancelled" && x.status !== "completed");
  async function merge() {
    setBusy(true); setErr(null);
    try { await api(`/api/projects/${p.id}/merge`, { method: "POST", json: { into_id: into, note: note.trim() } }); onMerged(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); setConfirm(false); }
  }
  return (
    <div className="panel space-y-3">
      <h2 className="font-semibold">Merge into another project</h2>
      <p className="text-sm text-ink/70">Use this when two departments agree to dig once. This project is cancelled and linked to the joint project.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="into">Joint project</label>
          <select id="into" className="field" value={into} onChange={(e) => { setInto(e.target.value); setConfirm(false); }}>
            <option value="">Choose a project…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.department.name})</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="mnote">Note</label><input id="mnote" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agreed with the other department on…" /></div>
      </div>
      {err && <p role="alert" className="text-sm text-st-delayed">{err}</p>}
      {!confirm
        ? <button className="btn-secondary" disabled={!into || note.trim().length < 5} onClick={() => setConfirm(true)}>Merge…</button>
        : <div className="flex flex-wrap items-center gap-3"><p className="text-sm">This cannot be undone. Merge this project?</p>
            <button className="btn-danger" disabled={busy} onClick={merge}>{busy ? "Merging…" : "Yes, merge"}</button>
            <button className="btn-secondary" onClick={() => setConfirm(false)}>Keep both</button></div>}
    </div>
  );
}

export default function ProjectEditPage() {
  return <DeptShell><Page /></DeptShell>;
}
