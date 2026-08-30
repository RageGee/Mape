"use client";

import { Crosshair, Database, Globe2, Loader2 } from "lucide-react";

interface Props {
  mode: "world" | "city";
  x: number;
  y: number;
  zoom: number;
  seedText: string;
  status: string;
  busy: boolean;
  stats: { settlements: number; kingdoms: number; roads: number; rivers: number } | null;
}

export default function BottomBar(props: Props) {
  return (
    <div className="flex h-[26px] shrink-0 items-center gap-4 border-t border-[#2b2115] bg-[#12100b] px-3 text-[10.5px] text-[#8a7a58]">
      <span className="flex items-center gap-1.5">
        <Crosshair size={11} className="text-[#6b5c40]" />
        <span className="font-mono">
          {props.mode === "city"
            ? `${Math.round(props.x)}m, ${Math.round(props.y)}m`
            : `${props.x.toFixed(1)}°M, ${props.y.toFixed(1)}°A`}
        </span>
      </span>
      <span className="font-mono">zoom {props.zoom.toFixed(2)}×</span>
      <span className="flex items-center gap-1.5">
        <Globe2 size={11} className="text-[#6b5c40]" />
        seed <span className="font-mono text-[#c9a53f]">{props.seedText}</span>
      </span>
      {props.stats && (
        <span className="flex items-center gap-1.5">
          <Database size={11} className="text-[#6b5c40]" />
          {props.stats.kingdoms} realms · {props.stats.settlements} settlements · {props.stats.roads} roads · {props.stats.rivers} rivers
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5 italic">
        {props.busy && <Loader2 size={11} className="animate-spin text-[#c9a53f]" />}
        {props.status}
      </span>
    </div>
  );
}
