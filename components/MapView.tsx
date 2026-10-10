'use client';
import dynamic from 'next/dynamic';
export default dynamic(()=>import('./Map'),{ssr:false,loading:()=> <p className="p-4 text-sm">Loading map…</p>});
