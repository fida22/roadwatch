type Pt=[number,number];
export function distToLine(p:Pt,coords:number[][]):number{ // p=[lat,lng], coords=[lng,lat][]; metres
  const k=Math.PI/180,R=6371000,cx=Math.cos(p[0]*k);
  const xy=(c:number[])=>[(c[0]-p[1])*k*cx*R,(c[1]-p[0])*k*R];
  let best=Infinity;
  for(let i=0;i<coords.length-1;i++){const[a,b]=[xy(coords[i]),xy(coords[i+1])];const dx=b[0]-a[0],dy=b[1]-a[1];const l=dx*dx+dy*dy;
    const t=l?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/l)):0;best=Math.min(best,Math.hypot(a[0]+t*dx,a[1]+t*dy));}
  return best;}
export const distM=(a:Pt,b:Pt)=>distToLine(a,[[b[1],b[0]],[b[1],b[0]+1e-9]]);

export const CHENNAI_CENTER: [number, number] = [13.0827, 80.2707]; // [lat, lng] for Leaflet

/** GeoJSON [lng,lat] -> Leaflet [lat,lng] */
export const toLatLng = (c: [number, number][]): [number, number][] => c.map(([lng, lat]) => [lat, lng]);

/** Approximate minimum distance in metres between two lines (vertex-to-segment both ways). */
export function lineDistanceM(a: { coordinates: [number, number][] }, b: { coordinates: [number, number][] }): number {
  let best = Infinity;
  for (const p of a.coordinates) {
    best = Math.min(best, distToLine([p[1], p[0]], b.coordinates));
  }
  for (const p of b.coordinates) {
    best = Math.min(best, distToLine([p[1], p[0]], a.coordinates));
  }
  return best;
}

export function lineLengthM(c: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < c.length - 1; i++) {
    total += distM([c[i][1], c[i][0]], [c[i + 1][1], c[i + 1][0]]);
  }
  return total;
}
