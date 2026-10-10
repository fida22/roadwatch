"use client";
// Click-to-add-points line drawing on Leaflet + OpenStreetMap (doc allows this instead of leaflet-draw).
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { CHENNAI_CENTER, toLatLng } from "@/lib/geo";
import { STATUS_COLOR, type LineStringGeoJSON, type ProjectSummary } from "@/lib/types";

export interface MapDrawerProps {
  points: [number, number][];                 // GeoJSON order [lng, lat]
  onChange: (p: [number, number][]) => void;
  context: ProjectSummary[];                  // other projects shown for reference
  clashIds: string[];                         // context projects currently clashing (drawn in red)
  focus: LineStringGeoJSON | null;            // fly here (e.g. the chosen road)
}

function Clicks({ points, onChange }: Pick<MapDrawerProps, "points" | "onChange">) {
  useMapEvents({ click: (e) => onChange([...points, [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))]]) });
  return null;
}

function Fit({ focus, points }: { focus: LineStringGeoJSON | null; points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const c = focus?.coordinates ?? (points.length > 1 ? points : null);
    if (c && c.length) map.fitBounds(L.latLngBounds(toLatLng(c)), { padding: [40, 40], maxZoom: 18 });
    // only re-fit when the focus line changes, not on every click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, map]);
  return null;
}

export default function MapDrawerInner({ points, onChange, context, clashIds, focus }: MapDrawerProps) {
  return (
    <MapContainer center={CHENNAI_CENTER} zoom={13} className="h-[320px] w-full rounded-lg border border-line sm:h-[420px]" scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit focus={focus} points={points} />
      <Clicks points={points} onChange={onChange} />
      {context.map((p) => {
        const clash = clashIds.includes(p.id);
        return (
          <Polyline key={p.id} positions={toLatLng(p.geojson.coordinates)}
            pathOptions={{ color: clash ? "#dc2626" : STATUS_COLOR[p.status], weight: clash ? 7 : 4, opacity: clash ? 0.9 : 0.45 }}>
            <Tooltip sticky>{p.title}</Tooltip>
          </Polyline>
        );
      })}
      {points.length > 1 && <Polyline positions={toLatLng(points)} pathOptions={{ color: "#0e5a6b", weight: 5, dashArray: "8 6" }} />}
      {points.map(([lng, lat], i) => (
        <CircleMarker key={i} center={[lat, lng]} radius={6} pathOptions={{ color: "#0e5a6b", fillColor: "#fff", fillOpacity: 1, weight: 3 }} />
      ))}
    </MapContainer>
  );
}
