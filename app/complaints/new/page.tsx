'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Nav from '@/components/Nav';
import MockBanner from '@/components/MockBanner';
import Footer from '@/components/Footer';
import { checkDuplicate, postComplaint, rememberComplaint, upvote } from '@/lib/api';
import { useApp } from '@/lib/auth-context';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <p className="p-4 text-sm">Loading map…</p>,
});

type Pt = [number, number];
const CATS = ['pothole', 'unfinished_work', 'no_barricade', 'debris', 'other'];

export default function NewComplaint() {
  const { user } = useApp();
  const [pt, setPt] = useState<Pt>();
  const [cat, setCat] = useState('pothole');
  const [desc, setDesc] = useState('');
  const [contact, setContact] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [dup, setDup] = useState<any>();
  const [proj, setProj] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<any>();
  const [msg, setMsg] = useState('');

  const gps = () =>
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          (p) => setPt([p.coords.latitude, p.coords.longitude]),
          () => setErr('Could not read your location. Tap the map to drop the pin.')
        )
      : setErr('No location support. Tap the map to drop the pin.');

  useEffect(() => {
    gps();
  }, []);

  useEffect(() => {
    setDup(undefined);
    setProj(undefined);
    if (pt)
      checkDuplicate(pt[0], pt[1], cat)
        .then((r) => {
          setDup(r.duplicate);
          setProj(r.nearest_project);
        })
        .catch(() => {});
  }, [pt, cat]);

  async function submit() {
    if (!pt) return setErr('Drop a pin on the map first.');
    if (desc.trim().length < 5) return setErr('Describe the problem in a few words.');
    if (photo && photo.size > 5_000_000) return setErr('Photo must be under 5 MB.');
    setBusy(true);
    setErr('');
    try {
      const r = await postComplaint({
        category: cat,
        description: desc,
        lat: pt[0],
        lng: pt[1],
        contact,
        photo,
      });
      rememberComplaint(r.tracking_id);
      setDone(r);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0f1923]">
      <MockBanner />
      <Nav />
      <main className="flex-1 mx-auto w-full max-w-5xl p-4">
        {done ? (
          <div className="mx-auto max-w-md space-y-4 p-6 bg-white dark:bg-[#1a2535] rounded-xl border border-line dark:border-[#2a3a4a] shadow-sm">
            <h1 className="text-xl font-bold">Complaint filed</h1>
            <p>
              Your tracking ID is <b className="text-lg text-brand">{done.tracking_id}</b>. Save it to check progress.
            </p>
            {done.linked_project_id && (
              <p className="text-sm">
                Linked to a nearby work:{' '}
                <Link className="underline text-brand" href={`/projects/${done.linked_project_id}`}>
                  view project
                </Link>
              </p>
            )}
            <Link className="btn-primary inline-block text-center" href={`/complaints/track?id=${done.tracking_id}`}>
              Track this complaint
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 bg-white dark:bg-[#1a2535] p-5 rounded-xl border border-line dark:border-[#2a3a4a]">
              <h1 className="text-xl font-bold">Report an issue</h1>
              <div>
                <label className="label">Category</label>
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  className="field"
                  aria-label="Category"
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder="What is wrong?"
                  className="field min-h-[90px]"
                />
              </div>

              <div>
                <label className="label">Photo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="label">Contact info (optional)</label>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Phone or email"
                  className="field"
                />
              </div>

              <p className="text-sm text-stone-600 dark:text-stone-400">
                Pin: {pt ? `${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}` : 'not set'} ·{' '}
                <button className="underline text-brand font-medium" onClick={gps}>
                  Use my location
                </button>
              </p>

              {proj && (
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  Near an active work: <b>{proj.title}</b>. It will be linked automatically.
                </p>
              )}

              {dup && (
                <div className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                  <p>Already reported nearby ({dup.tracking_id}). Upvote it instead of filing a new one.</p>
                  <button
                    className="mt-2 btn-secondary !min-h-[32px] !px-3 !text-xs"
                    onClick={async () => {
                      if (!user) return setMsg('Sign in to upvote.');
                      try {
                        await upvote(dup);
                        setMsg('Upvoted. Thank you.');
                      } catch (e: any) {
                        setMsg(e.message);
                      }
                    }}
                  >
                    ▲ Upvote {dup.tracking_id}
                  </button>{' '}
                  {msg && (
                    <span className="ml-2 font-medium">
                      {msg}{' '}
                      {msg.startsWith('Sign') && (
                        <Link href="/login" className="underline">
                          Sign in
                        </Link>
                      )}
                    </span>
                  )}
                </div>
              )}

              {err && <p role="alert" className="text-sm text-red-600 font-medium">{err}</p>}

              <button className="btn-primary w-full" disabled={busy} onClick={submit}>
                {busy ? 'Submitting…' : dup ? 'File anyway' : 'Submit complaint'}
              </button>
            </div>

            <div className="h-80 md:h-[32rem] rounded-xl overflow-hidden border border-line dark:border-[#2a3a4a] relative flex flex-col">
              <MapView a={pt} labelA="📍" onClick={setPt} focus={pt} />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
