'use client';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { useEffect } from 'react';
import { STATUS_COLORS, ROUTE_COLOR, BASELINE_COLOR, CHENNAI } from '@/lib/constants';
type Pt=[number,number];
const ll=(g:any):Pt[]=>g.coordinates.map((c:number[])=>[c[1],c[0]] as Pt);
const pin=(t:string)=>L.divIcon({className:'',html:`<div style="background:#111827;color:#fff;min-width:26px;height:26px;padding:0 4px;border-radius:13px;display:grid;place-items:center;font:600 12px sans-serif;border:2px solid #fff">${t}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
function Fit({pts}:{pts?:Pt[]}){const m=useMap();useEffect(()=>{if(pts&&pts.length>1)m.fitBounds(pts,{padding:[30,30]});},[pts,m]);return null;}
function Focus({p}:{p?:Pt}){const m=useMap();useEffect(()=>{if(p)m.flyTo(p,15);},[p,m]);return null;}
function Clicks({onClick}:{onClick?:(p:Pt)=>void}){useMapEvents({click:e=>onClick?.([e.latlng.lat,e.latlng.lng])});return null;}
export default function Map({projects=[],route,others=[],baseline,baselineLabel,a,b,labelA,onClick,fit,focus}:{projects?:any[];route?:any;others?:any[];baseline?:any;baselineLabel?:string;a?:Pt;b?:Pt;labelA?:string;onClick?:(p:Pt)=>void;fit?:Pt[];focus?:Pt}){
  return (<MapContainer center={CHENNAI} zoom={12} className="h-full w-full" scrollWheelZoom>
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <Fit pts={fit}/><Focus p={focus}/><Clicks onClick={onClick}/>
    {projects.map(p=>{const closed=p.closure_type==='full_closure';return(<span key={p.id}>
      {closed&&<Polyline positions={ll(p.geojson)} pathOptions={{color:'#dc2626',weight:14,opacity:.3}}/>}
      <Polyline positions={ll(p.geojson)} pathOptions={{color:STATUS_COLORS[p.status],weight:closed?6:4,dashArray:closed?'2 8':undefined}}>
        {closed&&<Tooltip permanent direction="top">Closed</Tooltip>}
        <Popup><b>{p.title}</b><br/>{p.department.name} · {p.status}<br/>{p.start_date} to {p.end_date}<br/>Dug {p.redig_count_12m}× in the last 12 months<br/><Link href={`/projects/${p.id}`} className="text-blue-700 underline">View details</Link></Popup>
      </Polyline></span>);})}
    {others.map(r=><Polyline key={r.id} positions={ll(r.geojson)} pathOptions={{color:ROUTE_COLOR,weight:4,opacity:.35}}/>)}
    {baseline&&<Polyline positions={ll(baseline.geojson)} pathOptions={{color:BASELINE_COLOR,weight:4,dashArray:'8 8'}}>{baselineLabel&&<Tooltip sticky>{baselineLabel}</Tooltip>}</Polyline>}
    {route&&<Polyline positions={ll(route.geojson)} pathOptions={{color:ROUTE_COLOR,weight:6}}/>}
    {a&&<Marker position={a} icon={pin(labelA||'A')}/>}{b&&<Marker position={b} icon={pin('B')}/>}
  </MapContainer>);}
