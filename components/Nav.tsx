'use client';
import Link from 'next/link';
import { useApp } from '@/lib/auth-context';
import NotificationBell from './NotificationBell';
export default function Nav(){const {t,user,logout}=useApp();
  const links=[['/','map'],['/dashboard','dashboard'],['/planner','planner'],['/complaints/new','report'],['/complaints/track','track'],['/follows','follows'],['/saved-routes','saved']];
  return(<header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-300 bg-white px-4 py-2">
    <Link href="/" className="text-lg font-bold">RoadWatch</Link>
    <nav className="flex flex-1 flex-wrap gap-x-3 gap-y-1 text-sm">{links.map(([h,k])=><Link key={h} href={h} className="hover:underline">{t(k)}</Link>)}</nav>
    <NotificationBell/>
    {user?<button className="text-sm underline" onClick={logout}>{t('signout')} ({user.name})</button>:<Link href="/login" className="text-sm underline">{t('signin')}</Link>}</header>);}
