"use client";
// Local versions of shared UI pieces (P2 owns the polished ones; swap imports when they land).
import { useCallback, useEffect, useState } from "react";
import { CLOSURE_LABEL, STATUS_COLOR, STATUS_LABEL, type ClosureType, type ProjectStatus } from "@/lib/types";

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-sm text-ink/70">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {label}…
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="panel text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink/70">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel border-st-delayed/40 bg-red-50">
      <p className="font-medium text-st-delayed">Something went wrong</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && <button className="btn-secondary mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Traffic impact badge (v2). Nothing is shown for "none". */
export function ClosureBadge({ type }: { type: ClosureType }) {
  if (type === "none") return null;
  const full = type === "full_closure";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${full ? "border-red-300 bg-red-100 text-red-800" : "border-amber-300 bg-amber-100 text-amber-900"}`}>
      {full ? "Closed" : CLOSURE_LABEL[type]}
    </span>
  );
}

export function DeptChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{name}
    </span>
  );
}

/** Loads data with loading + error + reload handling so no screen is ever blank (X4). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setLoading(true); setError(null);
    fn().then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-paper p-4 sm:max-w-2xl sm:rounded-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-secondary !min-h-[36px] !px-3" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
