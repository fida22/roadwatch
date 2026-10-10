'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getNotifications, markRead } from '@/lib/api';
import { useApp } from '@/lib/auth-context';
export default function NotificationBell(){
  const {user}=useApp();const [n,setN]=useState<any[]>([]);const [open,setOpen]=useState(false);const [err,setErr]=useState('');
  useEffect(()=>{if(user)getNotifications().then(setN).catch(e=>setErr(e.message));},[user]);
  if(!user)return null;const unread=n.filter(x=>!x.is_read).length;
  const read=async(x:any)=>{await markRead(x.id).catch(()=>{});setN(n.map(y=>y.id===x.id?{...y,is_read:true}:y));};
  return(<div className="relative"><button onClick={()=>setOpen(!open)} aria-label="Notifications" className="relative rounded border px-2 py-1 text-sm">🔔{unread>0&&<span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>}</button>
    {open&&<div className="absolute right-0 z-[2000] mt-1 max-h-80 w-72 overflow-y-auto rounded border bg-white p-2 text-sm shadow">
      {err&&<p className="text-red-700">Could not load notifications: {err}</p>}{!err&&n.length===0&&<p>No notifications yet. Follow a work to get updates.</p>}
      {n.map(x=><div key={x.id} className={`border-b py-2 ${x.is_read?'text-stone-500':'font-medium'}`}><p>{x.message}</p>
        <div className="flex gap-3 text-xs">{x.project_id&&<Link href={`/projects/${x.project_id}`} className="underline" onClick={()=>read(x)}>Open work</Link>}{x.type==='route_update'&&<Link href="/saved-routes" className="underline" onClick={()=>read(x)}>See route</Link>}{!x.is_read&&<button onClick={()=>read(x)} className="underline">Mark read</button>}</div></div>)}</div>}</div>);}
