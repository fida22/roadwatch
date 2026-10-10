'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import MockBanner from '@/components/MockBanner';
import Footer from '@/components/Footer';
import { getComplaint, myComplaintIds, upvote } from '@/lib/api';
import { useApp } from '@/lib/auth-context';

const STEPS = ['submitted', 'acknowledged', 'in_progress', 'resolved'];

export default function Track() {
  const { user } = useApp();
  const [id, setId] = useState('');
  const [c, setC] = useState<any>();
  const [err, setErr] = useState('');
  const [mine, setMine] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const look = async (t: string) => {
    setErr('');
    setC(undefined);
    try {
      const r = await getComplaint(t);
      if (!r) setErr('No complaint found with that tracking ID.');
      else setC(r);
    } catch (e: any) {
      setErr('Could not look up the complaint: ' + e.message);
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('id');
    if (q) {
      setId(q);
      look(q);
    }
    Promise.all(myComplaintIds().map((t) => getComplaint(t).catch(() => null))).then((r) =>
      setMine(r.filter(Boolean))
    );
  }, []);

  const idx = c ? STEPS.indexOf(c.status) : -1;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
      <MockBanner />
      <Nav />
      <main className="flex-1 mx-auto w-full max-w-2xl space-y-6 p-4">
        <h1 className="text-xl font-bold">Track a complaint</h1>

        <div className="flex gap-2">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Tracking ID, e.g. RW-1001"
            className="field flex-1"
          />
          <button className="btn-primary" onClick={() => look(id)}>
            Look up
          </button>
        </div>

        {err && <p role="alert" className="text-sm text-red-600 font-medium">{err}</p>}

        {c && (
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">
                {c.tracking_id}: {c.category.replace('_', ' ')}
              </p>
              <span className="badge bg-brand/10 text-brand">
                {c.status.replace('_', ' ')}
              </span>
            </div>

            <p className="text-sm text-ink/80 dark:text-[#e8edf2]/80">{c.description}</p>

            {c.photo_url && (
              <img src={c.photo_url} alt="Complaint" className="max-h-48 rounded-lg border border-line" />
            )}

            <div>
              <p className="text-xs font-semibold text-ink/60 dark:text-[#e8edf2]/60 mb-2">STATUS TIMELINE</p>
              <ol className="flex flex-wrap gap-2 text-xs">
                {STEPS.map((s, i) => (
                  <li
                    key={s}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      i <= idx
                        ? 'bg-brand text-white'
                        : 'bg-stone-100 text-stone-500 dark:bg-[#1a2535] dark:text-stone-400'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg bg-stone-50 dark:bg-[#0f1923] p-3 text-sm border border-line dark:border-[#2a3a4a]">
              <span className="font-semibold">Department response:</span>{' '}
              {c.response || 'No response yet.'}
            </div>

            {c.project_id && (
              <div>
                <Link className="text-sm text-brand underline font-medium" href={`/projects/${c.project_id}`}>
                  View linked work
                </Link>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-line dark:border-[#2a3a4a]">
              <button
                className="btn-secondary !min-h-[32px] !px-3 !text-xs"
                onClick={async () => {
                  if (!user) return setMsg('Sign in to upvote.');
                  try {
                    const count = await upvote(c);
                    setC({ ...c, upvotes: count });
                    setMsg('Upvoted.');
                  } catch (e: any) {
                    setMsg(e.message);
                  }
                }}
              >
                ▲ Upvote ({c.upvotes})
              </button>
              {msg && <span className="text-xs font-medium">{msg}</span>}
            </div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold text-lg">My complaints</h2>
          {mine.length ? (
            <div className="space-y-2">
              {mine.map((m) => (
                <button
                  key={m.id || m.tracking_id}
                  className="w-full text-left p-3 rounded-lg border border-line bg-white dark:bg-[#1a2535] dark:border-[#2a3a4a] hover:bg-stone-50 dark:hover:bg-[#243040] transition flex items-center justify-between text-sm"
                  onClick={() => {
                    setId(m.tracking_id);
                    setC(m);
                  }}
                >
                  <span className="font-medium">
                    {m.tracking_id}: {m.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-ink/60 dark:text-[#e8edf2]/60">
                    {m.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">Complaints you file on this device appear here.</p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
