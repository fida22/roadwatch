import Link from 'next/link';
import { STATUS_COLORS } from '@/lib/constants';
export const StatusBadge=({s}:{s:string})=><span className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{background:STATUS_COLORS[s]}}>{s}</span>;
export const ImpactBadge=({t}:{t:string})=>t==='none'?null:<span className={`rounded border px-2 py-0.5 text-xs font-medium ${t==='full_closure'?'border-red-600 text-red-700':'border-amber-600 text-amber-700'}`}>{t==='full_closure'?'Full closure':'Lane restriction'}</span>;
export const DeptChip=({d}:{d:any})=><span className="rounded-full px-2 py-0.5 text-xs text-white" style={{background:d.color}}>{d.name}</span>;
export const ProjectCard=({p}:{p:any})=><Link href={`/projects/${p.id}`} className="card block hover:border-stone-900">
  <div className="font-medium">{p.title}</div><div className="mt-1 flex flex-wrap gap-1"><DeptChip d={p.department}/><StatusBadge s={p.status}/><ImpactBadge t={p.closure_type}/></div>
  <div className="mt-1 text-sm">{p.start_date} to {p.end_date}{p.delay_days>0&&` (+${p.delay_days} days)`}</div></Link>;
