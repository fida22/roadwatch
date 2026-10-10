"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoEmails, homeFor, useAuth } from "@/lib/auth";

function LoginForm() {
  const { signIn, mock } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const u = await signIn(email, password);
      router.replace(next && next.startsWith("/") && u.role !== "resident" ? next : homeFor(u));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <h1 className="text-2xl font-semibold">Sign in to RoadWatch</h1>
      <p className="mt-1 text-sm text-ink/70">Department staff and admins add and manage public works here. Residents sign in to follow projects.</p>
      <form onSubmit={submit} className="panel mt-5 space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-st-delayed">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      {mock && (
        <div className="panel mt-4 text-sm">
          <p className="font-medium">Demo accounts (simulated data)</p>
          <p className="mt-1 text-ink/70">Password for all: demo1234</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {demoEmails.map((d) => (
              <li key={d}><button type="button" className="btn-secondary !min-h-[36px] !px-3 text-xs" onClick={() => { setEmail(d); setPassword("demo1234"); }}>{d}</button></li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
