'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { ls } from './store';
export const dict:any={en:{map:'Map',dashboard:'Dashboard',planner:'Route planner',report:'Report issue',track:'Track complaint',follows:'My works',saved:'Saved routes',signin:'Sign in',signout:'Sign out',sim:'All data shown is simulated for a hackathon demo.'}};
const Ctx=createContext<any>(null);
export const useApp=()=>useContext(Ctx);
export function Providers({children}:{children:React.ReactNode}){
  const [user,setU]=useState<any>(null);
  useEffect(()=>{setU(ls.get('user',null));},[]);
  const value={user,t:(k:string)=>dict.en[k]||k,
    login:(u:any)=>{ls.set('user',u);setU(u)},logout:()=>{localStorage.removeItem('rw:user');setU(null)}};
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;}
