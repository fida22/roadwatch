"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useState } from "react";
import DeptShell from "@/components/dept/DeptShell";
import { ClosureBadge, EmptyState, ErrorState, Loading, StatusBadge, useAsync } from "@/components/dept/ui";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pretty } from "@/lib/dates";
import { STATUS_LABEL, type ProjectStatus, type ProjectSummary } from "@/lib/types";

const FILTERS: (ProjectStatus | "all")[] = ["all", "planned", "ongoing", "delayed", "completed", "cancelled"];

function Projects() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const deptId = user?.role === "department" ? user.department_id : null;
  const { data, error, loading, reload } = useAsync(() => api<ProjectSummary[]>(`/api/projects${qs({ department_id: deptId })}`), [deptId]);

  if (loading) return <Loading label="Loading your projects" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const all = data ?? [];
  const list = filter === "all" ? all : all.filter((p) => p.status === filter);
  const count = (s: ProjectStatus) => all.filter((p) => p.status === s).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{user?.role === "admin" ? "All projects" : "Your projects"}</h1>
        <Link href="/dept/projects/new" className="btn-primary">Add work</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`btn !min-h-[40px] !px-3 border ${filter === f ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
            {f === "all" ? `All (${all.length})` : `${STATUS_LABEL[f]} (${count(f)})`}
          </button>
        ))}
      </div>

      {all.length === 0 ? (
        <EmptyState title="No projects yet" hint="Add your first work. RoadWatch will check it against other departments' plans." action={<Link className="btn-primary" href="/dept/projects/new">Add work</Link>} />
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
                  {user?.role === "admin" && ` · ${p.department.name}`}
                  {p.redig_count_12m > 1 && ` · road dug ${p.redig_count_12m} times in 12 months`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function DeptHome() {
  return <DeptShell><Projects /></DeptShell>;
}
