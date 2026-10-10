// Typed fetch wrapper for the API contract (build doc section 6).
// While P1's endpoints are not live, set NEXT_PUBLIC_USE_MOCK=true: any endpoint NOT listed in
// LIVE_ENDPOINTS (lib/mock/p3-fallbacks.ts) is answered from the in-memory mock. Add a line to
// LIVE_ENDPOINTS as each real endpoint goes live; set NEXT_PUBLIC_USE_MOCK=false before submission.
import { ApiError } from "./errors";
import { getSupabase } from "./supabase";
import { isMocked, mockRoute } from "./mock/p3-fallbacks";

export { ApiError };
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

interface Opts { method?: "GET" | "POST" | "PATCH" | "DELETE"; json?: unknown; form?: FormData }

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const method = opts.method ?? "GET";
  if (USE_MOCK && isMocked(method, path)) return (await mockRoute(method, path, opts.json ?? opts.form)) as T;

  const headers: Record<string, string> = {};
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form; // browser sets the multipart boundary
  else if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.json); }

  let res: Response;
  try { res = await fetch(path, { method, headers, body }); }
  catch { throw new ApiError("Can't reach the server. Check your connection and try again.", "NETWORK", 0); }

  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const e = (data ?? {}) as { error?: string; code?: string; conflicts?: ApiError["conflicts"] };
    throw new ApiError(e.error ?? `Request failed (${res.status})`, e.code ?? "UNKNOWN", res.status, e.conflicts);
  }
  return data as T;
}

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
};
