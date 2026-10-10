'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import MockBanner from '@/components/MockBanner';
import Footer from '@/components/Footer';
import { getProject, isFollowing, setFollow, verify, upvote, MOCK, Project } from '@/lib/api';
import { useApp } from '@/lib/auth-context';
import { StatusBadge, ImpactBadge, DeptChip } from '@/components/Badges';

const IMPACT: Record<string, string> = {
  none: 'None',
  lane_restriction: 'Lane restriction',
  full_closure: 'Full closure',
};

export default function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useApp();
  const [p, setP] = useState<Project | null>();
  const [err, setErr] = useState('');
  const [following, setF] = useState(false);
  const [msg, setMsg] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);

  const load = () =>
    getProject(id)
      .then(setP)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    load();
    if (MOCK) setF(isFollowing(id));
  }, [id]);

  if (err)
    return (
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
        <MockBanner />
        <Nav />
        <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
          <p className="text-red-600 font-medium">Could not load project: {err}</p>
        </main>
        <Footer />
      </div>
    );

  if (p === undefined)
    return (
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
        <MockBanner />
        <Nav />
        <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
          <p className="text-stone-600 dark:text-stone-300">Loading…</p>
        </main>
        <Footer />
      </div>
    );

  if (p === null)
    return (
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
        <MockBanner />
        <Nav />
        <main className="flex-1 p-4 max-w-3xl mx-auto w-full space-y-2">
          <p className="font-medium text-lg">Project not found.</p>
          <Link href="/dashboard" className="text-brand underline">
            Back to dashboard
          </Link>
        </main>
        <Footer />
      </div>
    );

  const need = () => {
    setMsg('Sign in to do this.');
  };

  async function toggle() {
    if (!user) return need();
    const n = !following;
    try {
      await setFollow(id, n);
      setF(n);
      setMsg(n ? 'You will be notified of changes.' : '');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function ver(v: 'happening' | 'not_happening') {
    if (!user) return need();
    try {
      await verify(id, v, photo);
      setMsg('Thanks. Your report was added.');
      setPhoto(null);
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function up(c: any) {
    if (!user) return need();
    try {
      await upvote(c);
      setMsg('Upvoted.');
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  const v = p.verifications || { happening: 0, not_happening: 0 };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
      <MockBanner />
      <Nav />
      <main className="flex-1 mx-auto max-w-3xl w-full space-y-5 p-4 sm:p-6">
        <h1 className="text-2xl font-bold">{p.title}</h1>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <DeptChip d={p.department} />
          <StatusBadge s={p.status} />
          <ImpactBadge t={p.closure_type} />
          <span className="rounded-full border border-line px-2.5 py-0.5 font-medium bg-white dark:bg-[#1a2535]">
            Road dug {p.redig_count_12m}× in 12 months
          </span>
        </div>

        <div className="card space-y-2 text-sm p-5">
          <p className="text-ink/80 dark:text-[#e8edf2]/80">{p.purpose}</p>
          <p>
            <b>Contractor:</b> {p.contractor}{' '}
            {p.budget && (
              <>
                · <b>Budget:</b> ₹{p.budget.toLocaleString()}
              </>
            )}
          </p>
          <p>
            <b>Traffic impact:</b> {IMPACT[p.closure_type] || p.closure_type}
          </p>
          <p>
            <b>Dates:</b> {p.start_date} to {p.end_date}
            {p.delay_days > 0 && ` (${p.delay_days} days late)`}
          </p>
          <p>
            <b>Followers:</b> {p.follower_count ?? 0}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={toggle}>
            {following ? 'Unfollow this work' : 'Follow this work'}
          </button>
          {p.closure_type === 'full_closure' && (
            <Link href="/planner" className="btn-secondary">
              Plan a route around this
            </Link>
          )}
          <Link href="/complaints/new" className="btn-secondary">
            Report an issue
          </Link>
        </div>

        {msg && (
          <p role="status" className="text-sm font-medium text-brand">
            {msg}{' '}
            {msg.startsWith('Sign in') && (
              <Link href="/login" className="underline">
                Sign in
              </Link>
            )}
          </p>
        )}

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-lg">Is work happening here?</h2>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Department says: <b>{p.status}</b>. Residents say: {v.happening} happening, {v.not_happening} not happening.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-secondary !min-h-[36px] !text-xs" onClick={() => ver('happening')}>
              Work is happening
            </button>
            <button className="btn-secondary !min-h-[36px] !text-xs" onClick={() => ver('not_happening')}>
              Not happening
            </button>
          </div>
        </section>

        <section className="card space-y-2 p-5">
          <h2 className="font-semibold text-lg">Delay history</h2>
          {p.delays?.length ? (
            p.delays.map((d: any, i: number) => (
              <p key={i} className="text-sm border-b border-line pb-1.5 last:border-0">
                <b>{d.old_end_date} → {d.new_end_date}:</b> {d.reason_category.replace('_', ' ')}. {d.note}
              </p>
            ))
          ) : (
            <p className="text-sm text-stone-500">No delays recorded.</p>
          )}
        </section>

        <section className="card space-y-2 p-5">
          <h2 className="font-semibold text-lg">Updates</h2>
          {p.updates?.length ? (
            p.updates.map((u: any, i: number) => (
              <div key={i} className="text-sm border-b border-line pb-2 last:border-0">
                <p>
                  <span className="font-medium">{u.created_at}:</span> {u.note}
                </p>
                {u.photo_url && (
                  <img src={u.photo_url} alt="Progress" className="mt-2 max-h-48 rounded-lg border border-line" />
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-stone-500">No updates yet.</p>
          )}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-lg">Linked complaints</h2>
          {p.complaints?.length ? (
            p.complaints.map((c: any) => (
              <div
                key={c.id || c.tracking_id}
                className="flex items-center justify-between border-b border-line pb-2 last:border-0 text-sm gap-2"
              >
                <span>
                  <b>{c.category.replace('_', ' ')}:</b> {c.description}{' '}
                  <Link className="underline text-brand font-medium" href={`/complaints/track?id=${c.tracking_id}`}>
                    {c.tracking_id}
                  </Link>{' '}
                  ({c.status.replace('_', ' ')})
                </span>
                <button
                  className="btn-secondary !min-h-[30px] !px-2.5 !text-xs shrink-0"
                  onClick={() => up(c)}
                >
                  ▲ {c.upvotes}
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-stone-500">No complaints linked.</p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
