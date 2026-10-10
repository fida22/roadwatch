'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/auth-context';
import { MOCK } from '@/lib/api';
export default function Login(){const {login}=useApp();const r=useRouter();const [name,setName]=useState('Demo Resident');const [email,setEmail]=useState('resident@demo.test');
  if(!MOCK)return <p className="mx-auto max-w-md p-4 text-sm">Real sign-in uses Supabase Auth, which P1 sets up. This page only works in mock mode.</p>;
  return(<div className="mx-auto max-w-md space-y-3 p-4"><h1 className="text-xl font-bold">Sign in (mock resident)</h1>
    <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Name"/>
    <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Email"/>
    <button className="btn" onClick={()=>{login({name,email});r.push('/');}}>Sign in</button></div>);}
