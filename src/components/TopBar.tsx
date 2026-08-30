"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Castle, ChevronDown, FileJson, Globe2, Image, Map as MapIcon,
  Save, Search, Swords, TreePine, Waves, Loader2,
} from "lucide-react";
import type { MapStyle, WorldData } from "@/lib/world/types";
import { STYLES } from "@/lib/render/palette";

export interface JumpTarget {
  kind: "settlement" | "kingdom" | "river" | "region";
  id: number;
  x: number;
  y: number;
  scale: number;
  label: string;
  sub: string;
}

interface Props {
  world: WorldData | null;
  mode: "world" | "city";
  cityName: string | null;
  style: MapStyle;
  onStyleChange: (s: MapStyle) => void;
  onJump: (t: JumpTarget) => void;
  onSave: () => void;
  saving: boolean;
  savedId: string | null;
  onExportPng: () => void;
  onExportJson: () => void;
  onExitCity: () => void;
  busy: boolean;
}

export default function TopBar(props: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const index = useMemo<JumpTarget[]>(() => {
    const w = props.world;
    if (!w) return [];
    const out: JumpTarget[] = [];
    for (const s of w.settlements) {
      const k = s.kingdomId >= 0 ? w.kingdoms[s.kingdomId] : null;
      out.push({
        kind: "settlement", id: s.id, x: s.x, y: s.y, scale: s.rank === "hamlet" || s.rank === "village" ? 6 : 4,
        label: s.name.text,
        sub: `${s.rank} · pop. ${s.population.toLocaleString()} · ${k ? `${k.title} ${k.name.text}` : "unclaimed"}`,
      });
    }
    for (const k of w.kingdoms) {
      const cap = w.settlements[k.capitalId];
      out.push({
        kind: "kingdom", id: k.id, x: cap ? cap.x : w.width / 2, y: cap ? cap.y : w.height / 2, scale: 1.2,
        label: `${k.title} ${k.name.text}`,
        sub: `realm · pop. ${k.population.toLocaleString()} · seat ${cap ? cap.name.text : "—"}`,
      });
    }
    for (const r of w.rivers) {
      const m = r.points[Math.floor(r.points.length / 2)];
      out.push({
        kind: "river", id: r.id, x: m % w.width, y: Math.floor(m / w.width), scale: 3,
        label: r.name.text, sub: `river · ${r.length} leagues`,
      });
    }
    for (const rg of w.regions) {
      out.push({ kind: "region", id: rg.id, x: rg.x, y: rg.y, scale: 2.4, label: rg.name.text, sub: rg.kind });
    }
    return out;
  }, [props.world]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return index
      .filter((t) => t.label.toLowerCase().includes(needle))
      .sort((a, b) => (a.kind === "settlement" ? 0 : 1) - (b.kind === "settlement" ? 0 : 1) || a.label.length - b.label.length)
      .slice(0, 9);
  }, [q, index]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const kindIcon = (t: JumpTarget) => {
    switch (t.kind) {
      case "settlement": return <Castle size={13} className="text-[#c9a53f]" />;
      case "kingdom": return <Swords size={13} className="text-[#b3654a]" />;
      case "river": return <Waves size={13} className="text-[#5d7d8c]" />;
      default: return <TreePine size={13} className="text-[#7da24b]" />;
    }
  };

  const STYLE_ICON: Record<MapStyle, typeof MapIcon> = {
    atlas: MapIcon, political: Globe2, strategos: Swords,
  };

  return (
    <div className="relative z-30 flex h-[52px] shrink-0 items-center gap-3 border-b border-[#2b2115] bg-[#191410] px-3">
      {/* brand */}
      <div className="flex items-center gap-2.5 pr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3a2f1c] bg-gradient-to-b from-[#2c2210] to-[#14100b]">
          <CompassRose />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[13px] tracking-[0.28em] text-[#ecd28e]">CARTOGRAPHICA</div>
          <div className="text-[9px] italic tracking-wide text-[#8a7a58]">medieval world & city engine</div>
        </div>
      </div>

      {/* mode breadcrumb */}
      {props.mode === "city" && (
        <button
          onClick={props.onExitCity}
          className="flex items-center gap-1.5 rounded border border-[#3a2f1c] bg-[#241c10] px-2.5 py-1.5 text-[11px] text-[#ecd28e] hover:border-[#c9a53f]"
        >
          <Castle size={12} />
          {props.cityName}
          <span className="text-[#8a7a58]">· return to world</span>
        </button>
      )}

      {/* search */}
      <div ref={searchRef} className="relative mx-auto w-full max-w-[380px]">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b5c40]" />
        <input
          className="field pl-8"
          placeholder="Search cities, realms, rivers…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-[38px] overflow-hidden rounded border border-[#3a2f1c] bg-[#191410] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
            {results.map((t) => (
              <button
                key={`${t.kind}:${t.id}`}
                className="flex w-full items-center gap-2.5 border-b border-[#241c10] px-3 py-2 text-left last:border-0 hover:bg-[#241c10]"
                onClick={() => { props.onJump(t); setOpen(false); setQ(""); }}
              >
                {kindIcon(t)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[#e6d9b8]">{t.label}</span>
                  <span className="block truncate text-[10.5px] italic text-[#8a7a58]">{t.sub}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* style picker */}
      <div className="relative">
        <button
          onClick={() => setStyleOpen(!styleOpen)}
          className="flex items-center gap-2 rounded border border-[#33291a] bg-[#14100b] px-2.5 py-1.5 text-[12px] text-[#c0ae82] hover:border-[#4a3b24]"
        >
          {(() => { const Ic = STYLE_ICON[props.style]; return <Ic size={13} />; })()}
          {STYLES[props.style].styleLabel}
          <ChevronDown size={12} />
        </button>
        {styleOpen && (
          <div className="absolute right-0 top-[36px] w-[168px] overflow-hidden rounded border border-[#3a2f1c] bg-[#191410] shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
            {(Object.keys(STYLES) as MapStyle[]).map((s) => {
              const Ic = STYLE_ICON[s];
              return (
                <button
                  key={s}
                  onClick={() => { props.onStyleChange(s); setStyleOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#241c10] ${props.style === s ? "text-[#e6cf8f]" : "text-[#c0ae82]"}`}
                >
                  <Ic size={13} /> {STYLES[s].styleLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={props.onExportPng}
          disabled={!props.world || props.busy}
          title="Export chart as PNG"
          className="rounded border border-[#33291a] bg-[#14100b] p-2 text-[#c0ae82] hover:border-[#4a3b24] hover:text-[#e6cf8f] disabled:opacity-40"
        >
          <Image size={15} />
        </button>
        <button
          onClick={props.onExportJson}
          disabled={!props.world || props.busy}
          title="Export world data as JSON"
          className="rounded border border-[#33291a] bg-[#14100b] p-2 text-[#c0ae82] hover:border-[#4a3b24] hover:text-[#e6cf8f] disabled:opacity-40"
        >
          <FileJson size={15} />
        </button>
        <button
          onClick={props.onSave}
          disabled={!props.world || props.saving || props.busy}
          title={props.savedId ? "Update saved world" : "Save world to archive"}
          className="flex items-center gap-2 rounded border border-[#c9a53f] bg-[#241c10] px-3 py-2 text-[12px] tracking-wider text-[#ecd28e] hover:bg-[#2c2210] disabled:opacity-40"
        >
          {props.saving ? <Loader2 size={14} className="animate-spin" /> : props.savedId ? <Save size={14} /> : <Save size={14} />}
          <span className="font-display text-[11px]">{props.savedId ? "SAVE" : "SAVE"}</span>
        </button>
      </div>
    </div>
  );
}

function CompassRose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#c9a53f" strokeWidth="1" />
      <path d="M12 4 L14 12 L12 20 L10 12 Z" fill="#c9a53f" />
      <path d="M4 12 L12 10 L20 12 L12 14 Z" fill="#8a7a58" />
      <circle cx="12" cy="12" r="1.6" fill="#0d0a07" stroke="#ecd28e" strokeWidth="0.8" />
    </svg>
  );
}
