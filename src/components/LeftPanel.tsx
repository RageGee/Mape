"use client";

import { useState } from "react";
import {
  ArrowLeftRight, BookMarked, Castle, Dices, Flag, Hammer, Layers,
  Library, Mountain, Route, SlidersHorizontal, Trash2, Type, Waves,
} from "lucide-react";
import type { LayerState, WorldParams, WorldSize } from "@/lib/world/types";

export interface SavedWorldSummary {
  id: string;
  name: string;
  seedText: string;
  updatedAt: string;
}

interface SliderSpec {
  key: keyof WorldParams;
  label: string;
  min: number;
  max: number;
  step?: number;
  fmt?: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  { key: "oceanCoverage", label: "Ocean Coverage", min: 25, max: 72, fmt: (v) => `${v}%` },
  { key: "mountainDensity", label: "Mountain Vigor", min: 0, max: 100 },
  { key: "forestDensity", label: "Forest Cover", min: 0, max: 100 },
  { key: "riverDensity", label: "River Density", min: 0, max: 100 },
  { key: "aridity", label: "Aridity", min: 0, max: 100 },
  { key: "population", label: "Populousness", min: 40, max: 300, fmt: (v) => `${v}%` },
  { key: "politicalFragmentation", label: "Realm Fragmentation", min: 0, max: 100 },
  { key: "civilizationAge", label: "Recorded History", min: 200, max: 1300, step: 10, fmt: (v) => `${v} yrs` },
  { key: "tradeIntensity", label: "Trade Intensity", min: 0, max: 100 },
  { key: "wallFrequency", label: "Walled Towns", min: 0, max: 100 },
];

const LAYER_DEFS: { key: keyof LayerState; label: string; icon: typeof Flag; hint: string }[] = [
  { key: "borders", label: "Realm Borders", icon: Flag, hint: "Political boundaries" },
  { key: "rivers", label: "Rivers & Lakes", icon: Waves, hint: "Waterways" },
  { key: "roads", label: "Roads", icon: Route, hint: "Overland routes" },
  { key: "tradeRoutes", label: "Trade Routes", icon: ArrowLeftRight, hint: "Long-distance commerce" },
  { key: "settlements", label: "Settlements", icon: Castle, hint: "Cities, towns, villages" },
  { key: "labels", label: "Labels", icon: Type, hint: "Names on the chart" },
  { key: "regions", label: "Natural Regions", icon: Mountain, hint: "Named ranges & forests" },
];

interface Props {
  params: WorldParams;
  onParamsChange: (p: WorldParams) => void;
  onGenerate: () => void;
  generating: boolean;
  layers: LayerState;
  onLayersChange: (l: LayerState) => void;
  saved: SavedWorldSummary[];
  savedId: string | null;
  onLoadWorld: (id: string) => void;
  onDeleteWorld: (id: string) => void;
}

export default function LeftPanel(props: Props) {
  const [tab, setTab] = useState<"generate" | "layers" | "library">("generate");
  const { params, onParamsChange } = props;

  const set = (k: keyof WorldParams, v: number | string) => {
    onParamsChange({ ...params, [k]: v });
  };

  return (
    <div className="flex h-full w-[268px] shrink-0 flex-col border-r border-[#2b2115] bg-[#14100b]">
      {/* tabs */}
      <div className="flex border-b border-[#2b2115]">
        {([
          ["generate", "Forge", SlidersHorizontal],
          ["layers", "Layers", Layers],
          ["library", "Archive", Library],
        ] as const).map(([t, label, Icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] tracking-wider transition-colors ${
              tab === t ? "border-b-2 border-[#c9a53f] bg-[#1a1510] text-[#e6cf8f]" : "text-[#8a7a58] hover:text-[#c0ae82]"
            }`}
          >
            <Icon size={13} />
            <span className="font-display">{label.toUpperCase()}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "generate" && (
          <div className="space-y-4 fade-up">
            {/* seed */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-[0.18em] text-[#8a7a58]">World Seed</label>
              </div>
              <div className="flex gap-1.5">
                <input
                  className="field font-mono"
                  value={params.seedText}
                  onChange={(e) => set("seedText", e.target.value)}
                  placeholder="e.g. 78439215 or 'emberfall'"
                />
                <button
                  title="Random seed"
                  onClick={() => set("seedText", String(Math.floor(Math.random() * 90000000 + 10000000)))}
                  className="rounded border border-[#33291a] bg-[#1a1510] px-2.5 text-[#c9a53f] hover:border-[#c9a53f]"
                >
                  <Dices size={15} />
                </button>
              </div>
              <p className="mt-1 text-[10px] italic leading-snug text-[#6b5c40]">
                The same seed and settings always raise the same world.
              </p>
            </div>

            {/* size */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-[#8a7a58]">Chart Size</label>
              <div className="grid grid-cols-3 gap-1">
                {(["small", "medium", "large"] as WorldSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => set("size", s)}
                    className={`rounded border px-2 py-1.5 text-[11px] capitalize transition-colors ${
                      params.size === s
                        ? "border-[#c9a53f] bg-[#241c10] text-[#e6cf8f]"
                        : "border-[#33291a] bg-[#14100b] text-[#8a7a58] hover:text-[#c0ae82]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* sliders */}
            <div className="space-y-3 border-t border-[#241c10] pt-3">
              {SLIDERS.map((sp) => {
                const v = params[sp.key] as number;
                const fill = ((v - sp.min) / (sp.max - sp.min)) * 100;
                return (
                  <div key={sp.key}>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[12px] text-[#c0ae82]">{sp.label}</label>
                      <span className="font-mono text-[11px] text-[#c9a53f]">{sp.fmt ? sp.fmt(v) : v}</span>
                    </div>
                    <input
                      type="range"
                      min={sp.min}
                      max={sp.max}
                      step={sp.step ?? 1}
                      value={v}
                      style={{ ["--fill" as string]: `${fill}%` }}
                      onChange={(e) => set(sp.key, Number(e.target.value))}
                    />
                  </div>
                );
              })}
            </div>

            <button
              onClick={props.onGenerate}
              disabled={props.generating}
              className="font-display mt-2 flex w-full items-center justify-center gap-2 rounded border border-[#c9a53f] bg-gradient-to-b from-[#3a2c12] to-[#241b0c] px-3 py-3 text-[13px] tracking-[0.22em] text-[#ecd28e] transition-all hover:from-[#4a3a18] hover:to-[#2c2210] disabled:opacity-50 pulse-glow"
            >
              <Hammer size={14} />
              {props.generating ? "INSCRIBING…" : "FORGE THE WORLD"}
            </button>
            <p className="flex items-center gap-1.5 text-[10px] italic leading-snug text-[#6b5c40]">
              <Hammer size={10} className="shrink-0" />
              Terrain, realms, roads and economies are all derived from the seed.
            </p>
          </div>
        )}

        {tab === "layers" && (
          <div className="space-y-1.5 fade-up">
            {LAYER_DEFS.map(({ key, label, icon: Icon, hint }) => {
              const on = props.layers[key];
              return (
                <button
                  key={key}
                  onClick={() => props.onLayersChange({ ...props.layers, [key]: !on })}
                  className={`flex w-full items-center gap-2.5 rounded border px-2.5 py-2 text-left transition-colors ${
                    on ? "border-[#3a2f1c] bg-[#1c1610]" : "border-[#241c10] bg-[#12100b] opacity-55"
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded ${on ? "bg-[#3a2c12] text-[#e6cf8f]" : "bg-[#241c10] text-[#6b5c40]"}`}>
                    <Icon size={13} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[12.5px] text-[#d8c9a3]">{label}</span>
                    <span className="block text-[10px] italic text-[#6b5c40]">{hint}</span>
                  </span>
                  <span className={`h-2 w-2 rounded-full ${on ? "bg-[#c9a53f]" : "bg-[#33291a]"}`} />
                </button>
              );
            })}
            <p className="pt-2 text-[10px] italic leading-snug text-[#6b5c40]">
              Detail reveals itself as you zoom: realms, then roads and towns, then every homestead.
            </p>
          </div>
        )}

        {tab === "library" && (
          <div className="space-y-1.5 fade-up">
            {props.saved.length === 0 && (
              <div className="rounded border border-dashed border-[#33291a] p-4 text-center">
                <BookMarked size={20} className="mx-auto mb-2 text-[#4a3b24]" />
                <p className="text-[11.5px] italic text-[#8a7a58]">
                  No worlds in the archive yet.
                  <br />
                  Use the quill in the top bar to save this one.
                </p>
              </div>
            )}
            {props.saved.map((w) => (
              <div
                key={w.id}
                className={`group flex items-center gap-2 rounded border px-2.5 py-2 transition-colors ${
                  props.savedId === w.id ? "border-[#c9a53f] bg-[#20190e]" : "border-[#2b2115] bg-[#17130d] hover:border-[#4a3b24]"
                }`}
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => props.onLoadWorld(w.id)}>
                  <span className="block truncate text-[13px] text-[#e6d9b8]">{w.name}</span>
                  <span className="block font-mono text-[10px] text-[#8a7a58]">
                    seed {w.seedText} · {new Date(w.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  onClick={() => props.onDeleteWorld(w.id)}
                  className="rounded p-1 text-[#6b5c40] opacity-0 transition-opacity hover:text-[#c8543a] group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
