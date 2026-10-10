'use client';
import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import MockBanner from '@/components/MockBanner';
import Footer from '@/components/Footer';
import { getProjects, getStats, Project } from '@/lib/api';
import { ProjectCard } from '@/components/Badges';

export default function Dashboard() {
  const [all, setAll] = useState<Project[]>([]);
  const [st, setSt] = useState<any>();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('end_date');
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([getProjects(), getStats()])
      .then(([p, s]) => { setAll(p); setSt(s); })
      .catch(e => setErr(e.message));
  }, []);

  const stats = st ? [
    ['Active projects', st.active],
    ['Delayed projects', st.delayed],
    ['Avg delay (days)', st.avg_delay_days],
    ['Open complaints', st.open_complaints],
    ['Active full closures', st.active_closures],
  ] : [];

  const list = all
    .filter(p => (!status || p.status === status) && (p.title + p.department.name).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'delay_days' ? b.delay_days - a.delay_days : String(a[sort]).localeCompare(String(b[sort])));

  return (
    <div className="min-h-screen flex flex-col">
      <MockBanner />
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
        {err && <p className="text-red-700">Could not load the dashboard: {err}</p>}
        {!st && !err && <p>Loading…</p>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map(([l, v]) => (
            <div key={l as string} className="card">
              <div className="text-2xl font-bold">{v}</div>
              <div className="text-sm text-stone-600">{l}</div>
            </div>
          ))}
        </div>

        {st && (
          <section className="card">
            <h2 className="font-semibold">Most dug roads (last 12 months)</h2>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {st.most_dug_roads.slice(0, 5).map((r: any) => (
                <li key={r.road_id}>{r.name}: {r.count} projects</li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search works or departments"
            className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="rounded border px-2 text-sm">
            <option value="">All statuses</option>
            {['planned', 'ongoing', 'delayed', 'completed', 'cancelled'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="rounded border px-2 text-sm">
            <option value="end_date">Sort: end date</option>
            <option value="delay_days">Sort: delay</option>
            <option value="title">Sort: title</option>
          </select>
        </div>

        {st && list.length === 0 && <p className="text-sm">No works match your search.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {list.map(p => <ProjectCard key={p.id} p={p} />)}
        </div>
      </main>
      <Footer />
    </div>
  );
}
