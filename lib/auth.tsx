"use client";
// Session + role handling (A1). Real mode: Supabase email/password, then the `users` row (+ department) gives the role.
// Mock mode (no Supabase env vars): demo accounts below, password demo1234.
// NOTE for P1: RLS must let a signed-in user read their own `users` row and its `departments` row.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "./supabase";
import { MOCK_DEPARTMENTS, setMockUser } from "./mock/p3-fallbacks";
import type { AppUser, Role } from "./types";

const DEMO: Record<string, { name: string; role: Role; dept: string | null }> = {
  "resident@demo.in": { name: "Demo Resident", role: "resident", dept: null },
  "water@demo.in": { name: "Water Board demo", role: "department", dept: "d-water" },
  "electricity@demo.in": { name: "Electricity Board demo", role: "department", dept: "d-elec" },
  "roads@demo.in": { name: "Roads Department demo", role: "department", dept: "d-roads" },
  "sewerage@demo.in": { name: "Sewerage Board demo", role: "department", dept: "d-sewer" },
  "telecom@demo.in": { name: "Telecom demo (unapproved)", role: "department", dept: "d-tel" },
  "admin@demo.in": { name: "Admin demo", role: "admin", dept: null },
};
const MOCK_KEY = "rw_mock_user";

interface AuthCtx {
  user: AppUser | null; loading: boolean; mock: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

function mockUserFor(email: string): AppUser | null {
  const d = DEMO[email.trim().toLowerCase()];
  if (!d) return null;
  const dept = d.dept ? MOCK_DEPARTMENTS.find((x) => x.id === d.dept) ?? null : null;
  return { id: `mock-${email}`, email, full_name: d.name, role: d.role, department_id: dept?.id ?? null, department: dept };
}

async function loadProfile(): Promise<AppUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return null;
  const { data, error } = await sb.from("users")
    .select("id,email,full_name,role,department_id,departments(id,name,color,approved)")
    .eq("id", s.session.user.id).single();
  if (error || !data) return null;
  const dep = Array.isArray(data.departments) ? data.departments[0] : data.departments;
  return { id: data.id, email: data.email, full_name: data.full_name, role: data.role, department_id: data.department_id, department: dep ?? null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mock = !getSupabase();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((u: AppUser | null) => {
    setUser(u);
    setMockUser(u ? { id: u.id, dept: u.department, name: u.full_name ?? u.email } : null);
  }, []);

  useEffect(() => {
    (async () => {
      if (mock) {
        const saved = typeof window !== "undefined"
          ? (sessionStorage.getItem(MOCK_KEY) || localStorage.getItem(MOCK_KEY))
          : null;
        apply(saved ? mockUserFor(saved) : null);
      } else apply(await loadProfile());
      setLoading(false);
    })();
  }, [mock, apply]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (mock) {
      const u = mockUserFor(email);
      if (!u || password !== "demo1234") throw new Error("Email or password is incorrect.");
      sessionStorage.setItem(MOCK_KEY, u.email);
      localStorage.setItem(MOCK_KEY, u.email);
      apply(u); return u;
    }
    const sb = getSupabase()!;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Email or password is incorrect.");
    const u = await loadProfile();
    if (!u) throw new Error("Signed in, but no RoadWatch profile was found for this account.");
    apply(u); return u;
  }, [mock, apply]);

  const signOut = useCallback(async () => {
    if (mock) {
      sessionStorage.removeItem(MOCK_KEY);
      localStorage.removeItem(MOCK_KEY);
    } else await getSupabase()!.auth.signOut();
    apply(null);
  }, [mock, apply]);

  const value = useMemo(() => ({ user, loading, mock, signIn, signOut }), [user, loading, mock, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

/** Where each role lands after login. */
export const homeFor = (u: AppUser) => (u.role === "admin" ? "/admin" : u.role === "department" ? "/dept" : "/");
export const demoEmails = Object.keys(DEMO);
