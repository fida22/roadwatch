'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Nav from '@/components/Nav';
import MockBanner from '@/components/MockBanner';
import Footer from '@/components/Footer';
import { getProjects, getDepartments, Project } from '@/lib/api';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <p className="p-4 text-sm">Loading map…</p>,
});

type Pt = [number, number];

export default function MapPage() {
  const [all, setAll] = useState<Project[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState('');
  const [dep, setDep] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [co, setCo] = useState(false);
  const [me, setMe] = useState<Pt>();

  useEffect(() => {
    getDepartments().then(setDeps).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getProjects({
      status,
      department_id: dep,
      from,
      to,
      closure_type: co ? 'full_closure' : '',
    })
      .then((p) => {
        setAll(p);
        setErr('');
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [status, dep, from, to, co]);

  const near = () =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          (p) => setMe([p.coords.latitude, p.coords.longitude]),
          () => setErr('Location unavailable. Allow location access in your browser.')
        )
      : setErr('This browser has no location support.');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-stone-50 dark:bg-[#0f1923]">
      <MockBanner />
      <Nav />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2 text-sm shrink-0 dark:bg-[#1a2535] dark:border-[#2a3a4a]">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-line px-2.5 py-1 bg-white dark:bg-[#0f1923] dark:border-[#2a3a4a] text-ink dark:text-[#e8edf2]"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {['planned', 'ongoing', 'delayed', 'completed', 'cancelled'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={dep}
          onChange={(e) => setDep(e.target.value)}
          className="rounded-md border border-line px-2.5 py-1 bg-white dark:bg-[#0f1923] dark:border-[#2a3a4a] text-ink dark:text-[#e8edf2]"
          aria-label="Department"
        >
          <option value="">All departments</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-line px-2 py-1 bg-white dark:bg-[#0f1923] dark:border-[#2a3a4a] text-ink dark:text-[#e8edf2]"
          />
        </label>

        <label className="flex items-center gap-1.5 text-sm">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-line px-2 py-1 bg-white dark:bg-[#0f1923] dark:border-[#2a3a4a] text-ink dark:text-[#e8edf2]"
          />
        </label>

        <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={co}
            onChange={(e) => setCo(e.target.checked)}
            className="rounded border-line"
          />
          Closures only
        </label>

        <button
          className="btn-secondary !min-h-[32px] !px-3 !py-1 !text-xs font-semibold"
          onClick={near}
        >
          Near me
        </button>

        <span className="text-stone-600 dark:text-stone-400 font-medium">
          {loading ? 'Loading…' : `${all.length} works shown`}
        </span>

        {err && <span className="text-red-600 font-medium">{err}</span>}
      </div>

      {!loading && !err && all.length === 0 && (
        <p className="bg-stone-100 dark:bg-[#1a2535] px-4 py-2 text-sm text-stone-600 dark:text-stone-300 shrink-0">
          No works match these filters.
        </p>
      )}

      {/* Map container - flex-1 with min-h-0 so flex child fills exact remaining height */}
      <div className="flex-1 w-full min-h-[400px] relative">
        <MapView projects={all} a={me} labelA="You" focus={me} />
      </div>

      <Footer />
    </div>
  );
}
