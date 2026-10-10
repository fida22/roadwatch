type Pt=[number,number];
export function distToLine(p:Pt,coords:number[][]):number{ // p=[lat,lng], coords=[lng,lat][]; metres
  const k=Math.PI/180,R=6371000,cx=Math.cos(p[0]*k);
  const xy=(c:number[])=>[(c[0]-p[1])*k*cx*R,(c[1]-p[0])*k*R];
  let best=Infinity;
  for(let i=0;i<coords.length-1;i++){const[a,b]=[xy(coords[i]),xy(coords[i+1])];const dx=b[0]-a[0],dy=b[1]-a[1];const l=dx*dx+dy*dy;
    const t=l?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/l)):0;best=Math.min(best,Math.hypot(a[0]+t*dx,a[1]+t*dy));}
  return best;}
export const distM=(a:Pt,b:Pt)=>distToLine(a,[[b[1],b[0]],[b[1],b[0]+1e-9]]);
