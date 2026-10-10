"use client";
// Admin panel (A9) with audit log viewer (A10). Admin role only.
import { useState } from "react";
import DeptShell from "@/components/dept/DeptShell";
import { EmptyState, ErrorState, Loading, useAsync } from "@/components/dept/ui";
import { api, qs } from "@/lib/api";
import { prettyTime } from "@/lib/dates";
import { COMPLAINT_CATEGORY_LABEL, COMPLAINT_STATUS_LABEL, type AuditEntry, type Complaint, type Department } from "@/lib/types";

type Tab = "departments" | "complaints" | "audit";

function Admin() {
  const [tab, setTab] = useState<Tab>("departments");
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Admin</h1>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {([["departments", "Departments"], ["complaints", "Moderate complaints"], ["audit", "Audit log"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn !min-h-[40px] !px-3 border ${tab === k ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{l}</button>
        ))}
      </div>
      {tab === "departments" && <Departments />}
      {tab === "complaints" && <Moderation />}
      {tab === "audit" && <Audit />}
    </>
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
