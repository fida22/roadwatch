'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFollows, setFollow, Project } from '@/lib/api';
import { useApp } from '@/lib/auth-context';
import { ProjectCard } from '@/components/Badges';
export default function Follows(){
  const {user}=useApp();const [l,setL]=useState<Project[]>();const [err,setErr]=useState('');
  useEffect(()=>{if(user)getFollows().then(setL).catch(e=>setErr(e.message));},[user]);
  if(!user)return <p className="p-4">Sign in to see the works you follow. <Link href="/login" className="underline">Sign in</Link></p>;
  if(err)return <p className="p-4 text-red-700">Could not load followed works: {err}</p>;
  if(!l)return <p className="p-4">Loading…</p>;
  return(<div className="mx-auto max-w-3xl space-y-3 p-4"><h1 className="text-xl font-bold">Works I follow</h1>
    {l.length===0&&<p className="text-sm">You follow no works yet. Open a project and tap Follow.</p>}
    {l.map(p=><div key={p.id} className="space-y-1"><ProjectCard p={p}/><button className="text-sm underline" onClick={async()=>{await setFollow(p.id,false);setL(l.filter(x=>x.id!==p.id));}}>Unfollow</button></div>)}</div>);}
