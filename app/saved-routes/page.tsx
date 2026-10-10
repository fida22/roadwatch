'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSavedRoutes, deleteRoute } from '@/lib/api';
import { useApp } from '@/lib/auth-context';
export default function Saved(){
  const {user}=useApp();const [l,setL]=useState<any[]>();const [err,setErr]=useState('');
  useEffect(()=>{if(user)getSavedRoutes().then(setL).catch(e=>setErr(e.message));},[user]);
  if(!user)return <p className="p-4">Sign in to see saved routes. <Link href="/login" className="underline">Sign in</Link></p>;
  if(err)return <p className="p-4 text-red-700">Could not load saved routes: {err}</p>;
  if(!l)return <p className="p-4">Loading…</p>;
  return(<div className="mx-auto max-w-2xl space-y-3 p-4"><h1 className="text-xl font-bold">Saved routes</h1>
    <p className="text-sm text-stone-600">When a logged closure changes, the server rechecks saved routes and notifies you if the route changed. This is a recheck, not live navigation.</p>
    {l.length===0&&<p className="text-sm">No saved routes. Plan a route and tap Save route.</p>}
    {l.map(s=><div key={s.id} className="card text-sm"><p className="font-medium">{s.name||'Saved route'}</p><p>Last checked: {s.last_checked_at?.slice(0,16).replace('T',' ')||'not yet'}</p><p>{s.status||''}</p>
      <button className="underline" onClick={async()=>{await deleteRoute(s.id);setL(l.filter(x=>x.id!==s.id));}}>Delete</button></div>)}
    <p className="text-xs text-stone-600">Road network and closures are simulated. Not for real navigation.</p></div>);}
