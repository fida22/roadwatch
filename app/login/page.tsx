'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Nav from '@/components/Nav';
import MockBanner from '@/components/MockBanner';
import Footer from '@/components/Footer';
import { useAuth, homeFor } from '@/lib/auth';
import { useApp } from '@/lib/auth-context';

function LoginForm() {
  const { signIn, mock } = useAuth();
  const { login } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || null;

  const [email, setEmail] = useState('roads@demo.in');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(targetEmail?: string) {
    const loginEmail = targetEmail || email;
    setErr('');
    setBusy(true);
    try {
      const u = await signIn(loginEmail, password);
      login({ name: u.full_name || u.email, email: u.email, role: u.role });
      const dest = next || homeFor(u);
      router.push(dest);
    } catch (e: any) {
      setErr(e.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  const QUICK_ACCOUNTS = [
    { label: 'Roads Department', email: 'roads@demo.in', role: 'Department' },
    { label: 'Water Board', email: 'water@demo.in', role: 'Department' },
    { label: 'Electricity Board', email: 'electricity@demo.in', role: 'Department' },
    { label: 'Administrator', email: 'admin@demo.in', role: 'Admin' },
    { label: 'Resident', email: 'resident@demo.in', role: 'Resident' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
      <MockBanner />
      <Nav />
      <main className="flex-1 mx-auto max-w-md w-full p-4 sm:p-6 space-y-6">
        <div className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">Sign in to RoadWatch</h1>

          {/* Quick Demo Selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink/60 dark:text-[#e8edf2]/60 uppercase tracking-wider">
              1-Click Demo Logins
            </p>
            <div className="grid gap-2">
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  disabled={busy}
                  onClick={() => {
                    setEmail(acc.email);
                    handleLogin(acc.email);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg border border-line bg-white dark:bg-[#0f1923] hover:bg-stone-50 dark:hover:bg-[#243040] transition flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{acc.label}</span>
                  <span className="badge bg-brand/10 text-brand text-xs">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative my-4 text-center">
            <span className="bg-white dark:bg-[#1a2535] px-2 text-xs text-ink/50 dark:text-[#e8edf2]/50 relative z-10">
              or enter credentials
            </span>
            <hr className="absolute inset-0 top-1/2 border-line" />
          </div>

          {/* Manual Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-3"
          >
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="email@demo.in"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="demo1234"
                required
              />
              {mock && <p className="text-xs text-stone-500 mt-1">Demo password is <code className="bg-stone-100 dark:bg-stone-800 px-1 rounded">demo1234</code></p>}
            </div>

            {err && <p role="alert" className="text-sm text-red-600 font-medium">{err}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 dark:bg-[#0f1923]" />}>
      <LoginForm />
    </Suspense>
  );
}
