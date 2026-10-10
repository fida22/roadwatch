'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MapView from '@/components/MapView';
import { getLandmarks, postRoute, saveRoute, Landmark } from '@/lib/api';
import { useApp } from '@/lib/auth-context';
import { SIM_NOTE } from '@/lib/constants';
type Pt=[number,number];
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
export default function Planner(){
  const {user}=useApp();const [alts,setAlts]=useState(1);const [sel,setSel]=useState(0);const [saved,setSaved]=useState('');const [lm,setLm]=useState<Landmark[]>([]);const [a,setA]=useState<Pt>();const [b,setB]=useState<Pt>();
  const [date,setDate]=useState(today());const [busy,setBusy]=useState(false);const [res,setRes]=useState<any>();const [err,setErr]=useState<any>();
  useEffect(()=>{getLandmarks().then(setLm).catch(()=>{});},[]);
  const click=(p:Pt)=>{setRes(undefined);setErr(undefined);if(!a)setA(p);else if(!b)setB(p);};
  const pick=(which:'a'|'b',id:string)=>{const l=lm.find(x=>x.node_id===id);if(!l)return;(which==='a'?setA:setB)([l.lat,l.lng]);setRes(undefined);setErr(undefined);};
  const reset=()=>{setA(undefined);setB(undefined);setRes(undefined);setErr(undefined);};
  const locate=()=>navigator.geolocation?.getCurrentPosition(p=>setA([p.coords.latitude,p.coords.longitude]),()=>setErr({error:'Location unavailable. Tap the map to set the start.'}));
  async function go(){if(!a||!b)return;setBusy(true);setSel(0);setSaved('');setRes(undefined);setErr(undefined);
    try{const r=await postRoute({origin:{lat:a[0],lng:a[1]},destination:{lat:b[0],lng:b[1]},travel_date:date,avoid_closures:true,alternatives:alts});
      if(r.data)setRes(r.data);else setErr(r.error);}catch{setErr({error:'Could not reach the route service. Try again.'});}setBusy(false);}
  const route=res?.routes?.[sel];const crosses=res?.closures_avoided?.length>0;
  const fit=route?(route.geojson.coordinates as number[][]).map(c=>[c[1],c[0]] as Pt):undefined;
  const picker=(w:'a'|'b')=><select onChange={e=>pick(w,e.target.value)} defaultValue="" className="w-full rounded border px-2 py-1 text-sm" aria-label={w==='a'?'Start':'Destination'}><option value="" disabled>{w==='a'?'Start (A)':'Destination (B)'}: pick a landmark</option>{lm.map(l=><option key={l.node_id} value={l.node_id}>{l.label}</option>)}</select>;
  return(<div className="flex h-[calc(100vh-110px)] flex-col md:flex-row">
    <div className="order-2 max-h-[45%] space-y-3 overflow-y-auto border-t border-stone-300 bg-white p-4 md:order-1 md:max-h-none md:w-96 md:border-r md:border-t-0">
      <h1 className="text-lg font-bold">Route planner</h1>
      <p className="text-sm text-stone-600">Tap the map to set A, then B, or pick landmarks.</p>
      {picker('a')}{picker('b')}
      <div className="flex gap-2"><button className="btn" onClick={locate}>Use my location</button><button className="rounded-md border px-3 py-2 text-sm" onClick={reset}>Reset</button></div>
      <label className="block text-sm">Travel date <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="ml-2 rounded border px-2 py-1"/></label>
      <label className="block text-sm">Routes to show <select value={alts} onChange={e=>setAlts(+e.target.value)} className="ml-2 rounded border px-2 py-1"><option value={1}>1</option><option value={2}>Up to 2</option><option value={3}>Up to 3</option></select></label>
      <button className="btn w-full" disabled={!a||!b||busy} onClick={go}>{busy?'Finding route…':'Find route'}</button>
      {err&&<div className="rounded border border-red-300 bg-red-50 p-3 text-sm"><p>{err.code==='OUTSIDE_NETWORK'?'Routing covers the demo area only.':err.code==='NO_ROUTE'?'No closure-free route found for this date.':err.error}</p>
        {err.baseline&&<p>The dashed line is not passable on this date.</p>}{err.blocking_closures?.map((c:any)=><p key={c.project_id}>Blocked by: <Link className="underline" href={`/projects/${c.project_id}`}>{c.title}</Link> ({c.department}), closed until {c.end_date}</p>)}</div>}
      {res&&route&&<div className="space-y-2 text-sm">
        <p className="font-semibold text-violet-700">{(route.distance_m/1000).toFixed(1)} km · about {Math.round(route.duration_s/60)} min (estimate, constant speeds)</p>
        {crosses?<div className="rounded border border-stone-300 p-3"><p className="font-medium">This route avoids the logged full closures on {res.travel_date}.</p>
          {res.closures_avoided.map((c:any)=><p key={c.project_id}>Avoided: <Link className="underline" href={`/projects/${c.project_id}`}>{c.title}</Link> ({c.department}), closed until {c.end_date}</p>)}
          <p>Detour adds {(res.extra_distance_m/1000).toFixed(1)} km and about {Math.round(res.extra_duration_s/60)} min. The dashed line is the shortest route that crosses the closure.</p></div>
          :<p>No logged full closure is on the shortest route for this date.</p>}
        {res.routes.length>1&&<div><p className="font-medium">Alternatives (all avoid the logged closures)</p>{res.routes.map((r:any,i:number)=><button key={r.id} onClick={()=>setSel(i)} className={`mt-1 block w-full rounded border p-2 text-left ${i===sel?'border-violet-700 bg-violet-50':''}`}>Route {i+1}: {(r.distance_m/1000).toFixed(1)} km, about {Math.round(r.duration_s/60)} min, {r.works_along_route.length} works along</button>)}</div>}
        {user?<button className="rounded border px-3 py-1" onClick={async()=>{try{await saveRoute({name:'My route',origin:{lat:a![0],lng:a![1]},destination:{lat:b![0],lng:b![1]},travel_date:date});setSaved('Saved. See Saved routes.');}catch(e:any){setSaved(e.message)}}}>Save route</button>:<p><Link href="/login" className="underline">Sign in</Link> to save this route.</p>}{saved&&<p>{saved}</p>}
        {route.works_along_route?.length>0&&<div><p className="font-medium">Works along your route (not avoided)</p>{route.works_along_route.map((w:any)=><p key={w.project_id}>{w.closure_type.replace('_',' ')}: {w.title} ({w.department}), until {w.end_date}</p>)}</div>}</div>}
      <p className="text-xs text-stone-600">{SIM_NOTE}</p></div>
    <div className="order-1 min-h-[300px] flex-1 md:order-2"><MapView a={a} b={b} onClick={click} route={route} others={res?.routes?.filter((_:any,i:number)=>i!==sel)} baseline={crosses?res.baseline:err?.baseline} baselineLabel={err?.baseline?'Not passable on this date':'Shortest route (crosses a closure)'} fit={fit}/></div></div>);}
