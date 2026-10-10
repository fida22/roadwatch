"use client";
// Complaint management panel (A7): change status, add a public response, assign to a project.
import { useMemo, useState } from "react";
import DeptShell from "@/components/dept/DeptShell";
import { EmptyState, ErrorState, Loading, useAsync } from "@/components/dept/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { prettyTime } from "@/lib/dates";
import {
  COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_ORDER,
  type Complaint, type ComplaintStatus, type ProjectSummary,
} from "@/lib/types";

type Tab = "mine" | "unassigned";

function Panel() {
  const { user } = useAuth();
  const deptId = user?.role === "department" ? user.department_id : null;
  const projects = useAsync(() => api<ProjectSummary[]>("/api/projects"), []);
  const complaints = useAsync(() => api<Complaint[]>("/api/complaints"), []);
  const [tab, setTab] = useState<Tab>("mine");
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");

  const mineIds = useMemo(() => new Set((projects.data ?? []).filter((p) => !deptId || p.department.id === deptId).map((p) => p.id)), [projects.data, deptId]);
  const byId = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p])), [projects.data]);

  if (projects.loading || complaints.loading) return <Loading label="Loading complaints" />;
  if (projects.error || complaints.error) return <ErrorState message={(projects.error || complaints.error)!} onRetry={() => { projects.reload(); complaints.reload(); }} />;

  const all = complaints.data ?? [];
  const mine = all.filter((c) => c.project_id && mineIds.has(c.project_id));
  const unassigned = all.filter((c) => !c.project_id);
  const shown = (tab === "mine" ? mine : unassigned)
    .filter((c) => status === "all" || c.status === status)
    .sort((a, b) => b.upvotes - a.upvotes || b.created_at.localeCompare(a.created_at)); // most upvoted first

  const replace = (c: Complaint) => complaints.setData((all) => (all ?? []).map((x) => (x.id === c.id ? c : x)));
  const myProjects = (projects.data ?? []).filter((p) => mineIds.has(p.id) && p.status !== "cancelled");

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Complaints</h1>
      <p className="mb-4 text-sm text-ink/70">Most upvoted first. Responses are public on the resident&apos;s tracking page.</p>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Complaint group">
        {([["mine", `Linked to my projects (${mine.length})`], ["unassigned", `Not linked yet (${unassigned.length})`]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`btn !min-h-[40px] !px-3 border ${tab === k ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{label}</button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["all", ...COMPLAINT_STATUS_ORDER] as (ComplaintStatus | "all")[]).map((s) => (
          <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 text-sm ${status === s ? "border-brand bg-brand-soft font-medium" : "border-line bg-white"}`}>
            {s === "all" ? "All statuses" : COMPLAINT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No complaints here" hint={tab === "mine" ? "Complaints within 50 m of your projects show up automatically." : "Everything nearby has been linked to a project."} />
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => <Card key={c.id} c={c} project={c.project_id ? byId.get(c.project_id) : undefined} projects={myProjects} onSaved={replace} />)}
        </ul>
      )}
    </>
  );
}

function Card({ c, project, projects, onSaved }: { c: Complaint; project?: ProjectSummary; projects: ProjectSummary[]; onSaved: (c: Complaint) => void }) {
  const [status, setStatus] = useState<ComplaintStatus>(c.status);
  const [response, setResponse] = useState(c.response ?? "");
  const [projectId, setProjectId] = useState(c.project_id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = status !== c.status || response !== (c.response ?? "") || projectId !== (c.project_id ?? "");

  async function save() {
    if (status === "resolved" && !response.trim()) return setMsg({ ok: false, text: "Add a public response before marking this resolved." });
    setBusy(true); setMsg(null);
    try {
      const saved = await api<Complaint>(`/api/complaints/${c.id}`, { method: "PATCH", json: { status, response: response.trim() || null, ...(projectId !== (c.project_id ?? "") ? { project_id: projectId || null } : {}) } });
      onSaved(saved); setMsg({ ok: true, text: "Saved." });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <li className="panel space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{COMPLAINT_CATEGORY_LABEL[c.category]} <span className="font-normal text-ink/70">· {c.tracking_id}</span></p>
          <p className="text-xs text-ink/70">{prettyTime(c.created_at)} · {c.upvotes} {c.upvotes === 1 ? "upvote" : "upvotes"}</p>
        </div>
        {project && <p className="text-xs text-ink/70">Near: {project.title}</p>}
      </div>
      {c.description && <p className="text-sm">{c.description}</p>}
      {c.photo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.photo_url} alt="Complaint photo" className="max-h-40 rounded-md border border-line" />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`st-${c.id}`}>Status</label>
          <select id={`st-${c.id}`} className="field" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
            {COMPLAINT_STATUS_ORDER.map((s) => <option key={s} value={s}>{COMPLAINT_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`pj-${c.id}`}>Linked project</label>
          <select id={`pj-${c.id}`} className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Not linked</option>
            {project && !projects.some((p) => p.id === project.id) && <option value={project.id}>{project.title}</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`rs-${c.id}`}>Public response</label>
        <textarea id={`rs-${c.id}`} rows={2} className="field" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="What are you doing about this?" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save changes"}</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-st-completed" : "text-st-delayed"}`}>{msg.text}</p>}
      </div>
    </li>
  );
}

export default function ComplaintsPage() {
  return <DeptShell><Panel /></DeptShell>;
}
