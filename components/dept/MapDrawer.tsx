"use client";
import dynamic from "next/dynamic";
import { lineLengthM } from "@/lib/geo";
import type { MapDrawerProps } from "./MapDrawerInner";

const Inner = dynamic(() => import("./MapDrawerInner"), {
  ssr: false,
  loading: () => <div className="flex h-[320px] items-center justify-center rounded-lg border border-line bg-white text-sm text-ink/70 sm:h-[420px]">Loading map…</div>,
});

export default function MapDrawer(props: MapDrawerProps & { onUseRoad?: () => void; roadChosen?: boolean }) {
  const { points, onChange, onUseRoad, roadChosen, ...rest } = props;
  const len = points.length > 1 ? Math.round(lineLengthM(points)) : 0;
  return (
    <div>
      <Inner points={points} onChange={onChange} {...rest} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" disabled={!points.length} onClick={() => onChange(points.slice(0, -1))}>Undo last point</button>
        <button type="button" className="btn-secondary" disabled={!points.length} onClick={() => onChange([])}>Clear</button>
        {onUseRoad && <button type="button" className="btn-secondary" disabled={!roadChosen} onClick={onUseRoad}>Use whole road line</button>}
        <p className="text-sm text-ink/70" aria-live="polite">
          {points.length < 2 ? "Click the map to place at least 2 points along the dig." : `${points.length} points, about ${len} m`}
        </p>
      </div>
    </div>
  );
}
