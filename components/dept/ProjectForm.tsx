"use client";
// Add work (A2) with live conflict detection (A3).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CLOSURE_LABEL, type ClosureType, type Department, type LineStringGeoJSON, type ProjectSummary, type Road } from "@/lib/types";
import ConflictPanel from "./ConflictPanel";
import MapDrawer from "./MapDrawer";
import { DeptChip, ErrorState, Loading, useAsync } from "./ui";
import { useConflicts } from "./useConflicts";

type Errors = Partial<Record<"title" | "start" | "end" | "road" | "geometry" | "budget" | "dept", string>>;

export default function ProjectForm() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [contractor, setContractor] = useState("");
  const [budget, setBudget] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [closure, setClosure] = useState<ClosureType>("none");
  const [roadId, setRoadId] = useState("");
  const [deptId, setDeptId] = useState(user?.department?.id ?? "");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const depts = useAsync(() => api<Department[]>("/api/departments"), []);
  const roads = useAsync(() => api<Road[]>("/api/roads"), []);
  const others = useAsync(() => api<ProjectSummary[]>("/api/projects"), []);
  const road = roads.data?.find((r) => r.id === roadId) ?? null;

  useEffect(() => {
    if (user?.department?.id) setDeptId(user.department.id);
  }, [user]);

  const geojson: LineStringGeoJSON | null = points.length >= 2 ? { type: "LineString", coordinates: points } : null;
  const cf = useConflicts({ geojson, start, end });

  // Picking a road centres the map on it; if nothing is drawn yet the road line is the starting point.
  useEffect(() => { if (road && points.length === 0) setPoints(road.geojson.coordinates); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [roadId]);

  const clashIds = useMemo(() => cf.conflicts.map((c) => c.project_id), [cf.conflicts]);

  function validate(): Errors {
    const e: Errors = {};
    if (!title.trim()) e.title = "Add a title for the work.";
    if (user?.role === "admin" && !deptId) e.dept = "Choose which department this work belongs to.";
    if (!start) e.start = "Choose a planned start date.";
    if (!end) e.end = "Choose a planned end date.";
    else if (start && end < start) e.end = "End date must be on or after the start date.";
    if (!roadId) e.road = "Pick the road this work is on.";
    if (points.length < 2) e.geometry = "Draw the dig on the map with at least 2 points.";
    if (budget && (isNaN(Number(budget)) || Number(budget) < 0)) e.budget = "Budget must be a positive number.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { document.getElementById("form-errors")?.focus(); return; }
    setSaving(true);
    try {
      // fresh dry run so the user never saves against a stale result
      const latest = await cf.recheck();
      if (latest && latest.length && !latest.every((c) => cf.resolutions[c.project_id])) { setFormError("Resolve every clash before saving."); return; }
      const project = await api<ProjectSummary>("/api/projects", {
        method: "POST",
        json: {
          title: title.trim(), purpose: purpose.trim() || null, contractor: contractor.trim() || null,
          start_date: start, end_date: end, geojson, road_id: roadId, closure_type: closure, budget: budget ? Number(budget) : null,
          department_id: deptId || undefined,
          resolutions: cf.resolutionList,
        },
      });
      router.push(`/dept/projects/${project.id}`);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.code === "CONFLICT_UNRESOLVED" && ae.conflicts) { cf.adopt(ae.conflicts); setFormError("New clashes appeared while you were working. Review them below."); }
      else if (ae.code === "INVALID_DATES") setErrors({ end: ae.message });
      else if (ae.code === "INVALID_GEOMETRY") setErrors({ geometry: ae.message });
      else setFormError(ae.message);
    } finally { setSaving(false); }
  }

  if (roads.loading || others.loading) return <Loading label="Loading roads and nearby works" />;
  if (roads.error) return <ErrorState message={roads.error} onRetry={roads.reload} />;

  const errList = Object.values(errors).filter(Boolean) as string[];
  const blocked = cf.conflicts.length > 0 && !cf.resolved;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {(errList.length > 0 || formError) && (
        <div id="form-errors" tabIndex={-1} role="alert" className="rounded-md border border-st-delayed/40 bg-red-50 p-3 text-sm">
          {formError && <p>{formError}</p>}
          {errList.length > 0 && <ul className="list-disc pl-5">{errList.map((m) => <li key={m}>{m}</li>)}</ul>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel space-y-4">
          <h2 className="font-semibold">Work details</h2>
          <div>
            <label className="label" htmlFor="dept-select">Department</label>
            {user?.role === "admin" ? (
              <div>
                <select
                  id="dept-select"
                  className="field"
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  aria-invalid={!!errors.dept}
                >
                  <option value="">Choose a department…</option>
                  {depts.data?.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.dept && <p className="mt-1 text-sm text-st-delayed">{errors.dept}</p>}
              </div>
            ) : user?.department ? (
              <DeptChip name={user.department.name} color={user.department.color} />
            ) : (
              <span className="text-sm text-ink/70">Admin account</span>
            )}
          </div>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Power cable laying, Anna Salai" aria-invalid={!!errors.title} />
          </div>
          <div>
            <label className="label" htmlFor="purpose">Purpose</label>
            <textarea id="purpose" rows={3} className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What will this work achieve for residents?" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="start">Planned start</label>
              <input id="start" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!errors.start} />
            </div>
            <div>
              <label className="label" htmlFor="end">Planned end (inclusive)</label>
              <input id="end" type="date" className="field" min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!errors.end} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="contractor">Contractor</label>
              <input id="contractor" className="field" value={contractor} onChange={(e) => setContractor(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="budget">Budget in ₹ (optional)</label>
              <input id="budget" inputMode="numeric" className="field" value={budget} onChange={(e) => setBudget(e.target.value)} aria-invalid={!!errors.budget} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="closure">Traffic impact</label>
            <select id="closure" className="field" value={closure} onChange={(e) => setClosure(e.target.value as ClosureType)} aria-describedby="closure-help">
              {(Object.keys(CLOSURE_LABEL) as ClosureType[]).map((k) => <option key={k} value={k}>{CLOSURE_LABEL[k]}</option>)}
            </select>
            <p id="closure-help" className="mt-1 text-xs text-ink/70">Full closures are avoided by the public route planner.</p>
          </div>
          <div>
            <label className="label" htmlFor="road">Road</label>
            <select id="road" className="field" value={roadId} onChange={(e) => setRoadId(e.target.value)} aria-invalid={!!errors.road}>
              <option value="">Choose a road…</option>
              {roads.data?.map((r) => <option key={r.id} value={r.id}>{r.name}{r.ward ? ` (${r.ward})` : ""}</option>)}
            </select>
          </div>
        </div>

        <div className="panel space-y-3">
          <h2 className="font-semibold">Where is the dig?</h2>
          <p className="text-sm text-ink/70">Other works are shown faded by status. Clashing works turn red.</p>
          <MapDrawer points={points} onChange={setPoints} context={others.data ?? []} clashIds={clashIds}
            focus={road?.geojson ?? null} roadChosen={!!road} onUseRoad={() => road && setPoints(road.geojson.coordinates)} />
          {errors.geometry && <p className="text-sm text-st-delayed">{errors.geometry}</p>}
        </div>
      </div>

      <div aria-live="polite">
        {cf.checking && <p className="text-sm text-ink/70">Checking for clashes with other works…</p>}
        {cf.checkError && <ErrorState message={cf.checkError} onRetry={cf.recheck} />}
        {!cf.checking && cf.checked && cf.conflicts.length === 0 && (
          <p className="rounded-md border border-st-completed/40 bg-green-50 p-3 text-sm">No clashes found within 20 m for these dates. You can save.</p>
        )}
      </div>

      {cf.conflicts.length > 0 && (
        <ConflictPanel conflicts={cf.conflicts} resolutions={cf.resolutions} ownDepartment={user?.department?.name}
          onResolve={cf.resolve} onApplyDates={(s, e) => { setStart(s); setEnd(e); }} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={saving || blocked || cf.checking}>{saving ? "Saving…" : "Save work"}</button>
        {blocked && <p className="text-sm text-st-delayed">Saving is blocked until every clash has a decision.</p>}
      </div>
    </form>
  );
}
