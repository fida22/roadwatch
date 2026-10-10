"use client";
// Admin panel (A9) with audit log viewer (A10). Admin role only.
import Link from "next/link";
import { useState } from "react";
import DeptShell from "@/components/dept/DeptShell";
import { ClosureBadge, EmptyState, ErrorState, Loading, StatusBadge, useAsync } from "@/components/dept/ui";
import { api, qs } from "@/lib/api";
import { pretty, prettyTime } from "@/lib/dates";
import { COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL, STATUS_LABEL, type AuditEntry, type Complaint, type Department, type ProjectStatus, type ProjectSummary } from "@/lib/types";

type Tab = "projects" | "departments" | "complaints" | "audit";

const FILTERS: (ProjectStatus | "all")[] = ["all", "planned", "ongoing", "delayed", "completed", "cancelled"];

function Admin() {
  const [tab, setTab] = useState<Tab>("projects");
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Admin</h1>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {([["projects", "All projects"], ["departments", "Departments"], ["complaints", "Moderate complaints"], ["audit", "Audit log"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn !min-h-[40px] !px-3 border ${tab === k ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{l}</button>
        ))}
      </div>
      {tab === "projects" && <AdminProjects />}
      {tab === "departments" && <Departments />}
      {tab === "complaints" && <Moderation />}
      {tab === "audit" && <Audit />}
    </>
  );
}

function AdminProjects() {
  const { data, error, loading, reload } = useAsync(() => api<ProjectSummary[]>("/api/projects"), []);
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");

  if (loading && !data) return <Loading label="Loading projects" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const all = data ?? [];
  const list = filter === "all" ? all : all.filter((p) => p.status === filter);
  const count = (s: ProjectStatus) => all.filter((p) => p.status === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/70">Overview of all infrastructure works across every department.</p>
        <Link href="/dept/projects/new" className="btn-primary">Add work</Link>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`btn !min-h-[40px] !px-3 border ${filter === f ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
            {f === "all" ? `All (${all.length})` : `${STATUS_LABEL[f]} (${count(f)})`}
          </button>
        ))}
      </div>

      {all.length === 0 ? (
        <EmptyState title="No projects yet" hint="Add work to see it appear here." action={<Link className="btn-primary" href="/dept/projects/new">Add work</Link>} />
      ) : list.length === 0 ? (
        <EmptyState title={`No ${STATUS_LABEL[filter as ProjectStatus].toLowerCase()} projects`} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/dept/projects/${p.id}`} className="panel block h-full hover:border-brand">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium">{p.title}</h2>
                  <div className="flex flex-wrap justify-end gap-1.5"><StatusBadge status={p.status} /><ClosureBadge type={p.closure_type} /></div>
                </div>
                <p className="mt-1 text-sm text-ink/70">{pretty(p.start_date)} to {pretty(p.end_date)}</p>
                <p className="mt-1 text-sm text-ink/70">
                  {p.delay_days > 0 ? <span className="font-medium text-st-delayed">{p.delay_days} days late</span> : "On schedule"}
                  {p.department?.name && ` · ${p.department.name}`}
                  {p.redig_count_12m > 1 && ` · road dug ${p.redig_count_12m} times in 12 months`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Departments() {
  const { data, error, loading, reload, setData } = useAsync(() => api<Department[]>(`/api/departments${qs({ include_pending: true })}`), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  async function approve(d: Department) {
    setBusy(d.id); setErr(null);
    try { await api(`/api/departments/${d.id}/approve`, { method: "PATCH" }); setData((l) => (l ?? []).map((x) => (x.id === d.id ? { ...x, approved: true } : x))); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  const pending = (data ?? []).filter((d) => !d.approved);
  return (
    <div className="space-y-3">
      {err && <p role="alert" className="text-sm text-st-delayed">{err}</p>}
      <p className="text-sm text-ink/70">{pending.length === 0 ? "No departments are waiting for approval." : `${pending.length} waiting for approval.`}</p>
      <ul className="space-y-2">
        {(data ?? []).map((d) => (
          <li key={d.id} className="panel flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />{d.name}</span>
            {d.approved ? <span className="text-sm text-st-completed">Approved</span> : <button className="btn-primary" disabled={busy === d.id} onClick={() => approve(d)}>{busy === d.id ? "Approving…" : "Approve"}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Moderation() {
  const { data, error, loading, reload, setData } = useAsync(() => api<Complaint[]>("/api/complaints"), []);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  async function remove(id: string) {
    setErr(null);
    try { await api(`/api/complaints/${id}`, { method: "DELETE" }); setData((l) => (l ?? []).filter((c) => c.id !== id)); }
    catch (e) { setErr((e as Error).message); } finally { setConfirm(null); }
  }
  if (!data?.length) return <EmptyState title="No complaints to moderate" />;
  return (
    <div className="space-y-3">
      {err && <p role="alert" className="text-sm text-st-delayed">{err}</p>}
      <ul className="space-y-2">
        {data.map((c) => (
          <li key={c.id} className="panel flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{COMPLAINT_CATEGORY_LABEL[c.category]} <span className="font-normal text-ink/70">· {c.tracking_id} · {COMPLAINT_STATUS_LABEL[c.status]}</span></p>
              <p className="text-sm text-ink/80">{c.description ?? "No description"}</p>
            </div>
            {confirm === c.id ? (
              <div className="flex items-center gap-2"><button className="btn-danger" onClick={() => remove(c.id)}>Remove as spam</button><button className="btn-secondary" onClick={() => setConfirm(null)}>Keep</button></div>
            ) : <button className="btn-secondary" onClick={() => setConfirm(c.id)}>Remove…</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Audit() {
  const { data, error, loading, reload } = useAsync(() => api<AuditEntry[]>("/api/audit-log"), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState title="Nothing in the audit log yet" hint="Conflict decisions, date changes and status changes appear here." />;
  return (
    <div className="panel overflow-x-auto !p-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-brand-soft"><tr><th className="p-2">When</th><th className="p-2">Who</th><th className="p-2">Action</th><th className="p-2">Details</th></tr></thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} className="border-b border-line/60 align-top last:border-0">
              <td className="whitespace-nowrap p-2">{prettyTime(a.created_at)}</td>
              <td className="p-2">{a.actor_name ?? "System"}</td>
              <td className="p-2">{a.action}</td>
              <td className="p-2 text-ink/80">{a.details ? Object.entries(a.details).map(([k, v]) => `${k}: ${String(v)}`).join(", ") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  return <DeptShell roles={["admin"]}><Admin /></DeptShell>;
}
