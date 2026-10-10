"use client";
// Debounced dry-run of POST /api/projects/check-conflicts (spec section 5, step 1) plus resolution bookkeeping.
// Re-runs whenever geometry or dates change, so a shift/merge or a delay extension is always re-checked (step 6).
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Conflict, LineStringGeoJSON, Resolution } from "@/lib/types";
import { allResolved, type ResolutionMap } from "./ConflictPanel";

interface Args { geojson: LineStringGeoJSON | null; start: string; end: string; selfId?: string; enabled?: boolean }

export function useConflicts({ geojson, start, end, selfId, enabled = true }: Args) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionMap>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const seq = useRef(0);

  const valid = enabled && !!geojson && geojson.coordinates.length >= 2 && !!start && !!end && end >= start;

  const run = useCallback(async (): Promise<Conflict[] | null> => {
    if (!valid || !geojson) { setConflicts([]); setChecked(false); return []; }
    const id = ++seq.current;
    setChecking(true); setCheckError(null);
    try {
      const res = await api<{ conflicts: Conflict[] }>("/api/projects/check-conflicts", {
        method: "POST", json: { geojson, start_date: start, end_date: end, self_id: selfId },
      });
      if (id !== seq.current) return null;
      setConflicts(res.conflicts);
      // keep decisions only for clashes that still exist
      setResolutions((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => res.conflicts.some((c) => c.project_id === k))));
      setChecked(true);
      return res.conflicts;
    } catch (e) {
      if (id === seq.current) { setCheckError((e as Error).message); setChecked(false); }
      return null;
    } finally { if (id === seq.current) setChecking(false); }
  }, [valid, geojson, start, end, selfId]);

  useEffect(() => {
    if (!valid) { setConflicts([]); setChecked(false); return; }
    const t = setTimeout(run, 500);
    return () => clearTimeout(t);
  }, [valid, run]);

  const resolve = useCallback((c: Conflict, r: Resolution | null) => {
    setResolutions((prev) => { const n = { ...prev }; if (r) n[c.project_id] = r; else delete n[c.project_id]; return n; });
  }, []);

  /** Used when the server answers 409 CONFLICT_UNRESOLVED with its own conflicts[]. */
  const adopt = useCallback((list: Conflict[]) => { setConflicts(list); setChecked(true); }, []);

  return {
    conflicts, resolutions, resolve, adopt, checking, checkError, checked, recheck: run,
    resolved: allResolved(conflicts, resolutions),
    resolutionList: Object.values(resolutions),
  };
}
