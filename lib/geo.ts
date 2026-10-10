// Small geometry helpers. The REAL clash check is P1's PostGIS engine (/lib/conflicts.ts);
// this file only powers the mock fallback and the map UI.
import type { LineStringGeoJSON } from "./types";

export const CHENNAI_CENTER: [number, number] = [13.0827, 80.2707]; // [lat, lng] for Leaflet

/** GeoJSON [lng,lat] -> Leaflet [lat,lng] */
export const toLatLng = (c: [number, number][]): [number, number][] => c.map(([lng, lat]) => [lat, lng]);

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in metres from point p to segment a-b (local flat projection, fine at city scale). */
function pointToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const lat0 = rad(p[1]);
  const proj = ([lng, lat]: [number, number]) => [R * rad(lng) * Math.cos(lat0), R * rad(lat)] as [number, number];
  const [px, py] = proj(p), [ax, ay] = proj(a), [bx, by] = proj(b);
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Approximate minimum distance in metres between two lines (vertex-to-segment both ways). */
export function lineDistanceM(a: LineStringGeoJSON, b: LineStringGeoJSON): number {
  let best = Infinity;
  const scan = (x: [number, number][], y: [number, number][]) => {
    for (const p of x) for (let i = 0; i < y.length - 1; i++) best = Math.min(best, pointToSegment(p, y[i], y[i + 1]));
  };
  scan(a.coordinates, b.coordinates);
  scan(b.coordinates, a.coordinates);
  return best;
}

export function lineLengthM(c: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < c.length - 1; i++) {
    const [lng1, lat1] = c[i], [lng2, lat2] = c[i + 1];
    const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}
