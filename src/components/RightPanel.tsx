"use client";

import { useEffect, useState } from "react";
import {
  Anchor, ArrowDownUp, BookOpen, Castle, Church, Crown, DoorOpen,
  Feather, Hammer, Home, Landmark, MapPin, Mountain, RefreshCw, Scroll,
  Shield, Store, Wheat, X,
} from "lucide-react";
import type {
  CityPlan, Kingdom, Selection, Settlement, WorldData,
} from "@/lib/world/types";
import { DISTRICT_LABEL, RANK_LABEL } from "@/lib/world/types";

const KIND_ICON: Record<string, typeof Castle> = {
  port: Anchor, fishing: Anchor, mining: Mountain, castle: Shield,
  religious: Church, market: Store, river: BookOpen, farming: Wheat,
  frontier: Shield,
};

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function WealthDots({ w }: { w: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= w ? "bg-[#c9a53f]" : "bg-[#33291a]"}`} />
      ))}
    </span>
  );
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#20190e] py-[5px]">
      <span className="text-[10.5px] uppercase tracking-[0.14em] text-[#8a7a58]">{label}</span>
      <span className="text-right text-[13px] text-[#e6d9b8]">{children}</span>
    </div>
  );
}

function Chips({ items, color }: { items: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it} className="rounded border px-1.5 py-0.5 text-[10.5px]" style={{ borderColor: `${color}55`, color }}>
          {it}
        </span>
      ))}
    </div>
  );
}

function RenameBox({ initial, onCommit, locked }: { initial: string; onCommit: (v: string) => void; locked?: boolean }) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <div className="flex gap-1.5">
      <input className="field h-7 text-[12.5px]" value={val} onChange={(e) => setVal(e.target.value)} disabled={locked} />
      <button
        title="Rename (saved with the world)"
        onClick={() => val.trim() && onCommit(val.trim())}
        className="rounded border border-[#33291a] bg-[#1a1510] px-2 text-[#c9a53f] hover:border-[#c9a53f]"
      >
        <Feather size={13} />
      </button>
    </div>
  );
}

interface Props {
  world: WorldData;
  selection: Selection;
  mode: "world" | "city";
  cityPlan: CityPlan | null;
  onRename: (scope: "s" | "k" | "r", id: number, name: string) => void;
  onEnterCity: (id: number) => void;
  onExitCity: () => void;
  onRegenerateCity: (id: number) => void;
  onSelectSettlement: (id: number) => void;
  onSelectKingdom: (id: number) => void;
}

export default function RightPanel(props: Props) {
  const { world, selection } = props;

  const KIND_BLURB: Record<string, string> = {
    port: "Its wealth rides the tides; ships bind it to every coast of the known world.",
    fishing: "Smoke-houses and drying racks line the shore.",
    mining: "Shafts and spoil-heaps ring the settlement; the forges never cool.",
    castle: "A garrison town huddled beneath its lord's stone.",
    religious: "Pilgrims crowd its lanes in every season.",
    market: "Its fairs draw merchants from realms away.",
    river: "Mills and wharfs crowd the navigable water.",
    farming: "Field-strips and pasture sustain the nearby towns.",
    frontier: "A hardscrabble hold on the edge of the mapped world.",
  };

  const kingdomOf = (s: Settlement): Kingdom | null =>
    s.kingdomId >= 0 ? world.kingdoms[s.kingdomId] ?? null : null;

  const renderSettlement = (s: Settlement, inCity: boolean) => {
    const k = kingdomOf(s);
    const KindIcon = KIND_ICON[s.kind] ?? Castle;
    return (
      <div className="fade-up">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#241c10] text-[#e6cf8f]">
            <KindIcon size={15} />
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8a7a58]">
              {RANK_LABEL[s.rank]} · {s.kind}
            </div>
          </div>
        </div>
        <RenameBox initial={s.name.text} onCommit={(v) => props.onRename("s", s.id, v)} />
        <p className="mt-1 text-[10.5px] italic text-[#8a7a58]">{s.name.meaning} — {s.name.lang} tongue</p>

        <div className="mt-3 space-y-0">
          <StatRow label="Population">{fmt(s.population)}</StatRow>
          <StatRow label="Founded">c. {s.founded}</StatRow>
          <StatRow label="Founder">{s.founder}</StatRow>
          <StatRow label="Wealth"><WealthDots w={s.wealth} /></StatRow>
          <StatRow label="Walls">{s.walled ? "Ringed in stone" : "Open"}</StatRow>
          <StatRow label="Trade routes">{s.tradeRoutes}</StatRow>
          <StatRow label="Realm">
            {k ? (
              <button onClick={() => props.onSelectKingdom(k.id)} className="underline decoration-dotted underline-offset-2 hover:text-[#e6cf8f]" style={{ color: k.color }}>
                {k.title} {k.name.text}
              </button>
            ) : (
              <span className="italic text-[#8a7a58]">Unclaimed lands</span>
            )}
          </StatRow>
        </div>

        <div className="mt-3 space-y-2.5">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#8a7a58]">
              <Hammer size={10} /> Industries
            </div>
            <Chips items={s.industries} color="#c9a53f" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#8a7a58]">
              <ArrowDownUp size={10} /> Trade
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5 text-[11.5px]">
                <span className="mt-0.5 shrink-0 text-[#7da24b]">Exports</span>
                <Chips items={s.exports} color="#9dbb6a" />
              </div>
              <div className="flex items-start gap-1.5 text-[11.5px]">
                <span className="mt-0.5 shrink-0 text-[#b3654a]">Imports</span>
                <Chips items={s.imports} color="#c98a6a" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 border-l-2 border-[#3a2f1c] pl-2.5 text-[12px] italic leading-relaxed text-[#b8a67c]">
          {s.blurb} {KIND_BLURB[s.kind] ?? ""}
        </p>

        <div className="mt-3 space-y-1.5">
          {!inCity && (
            <button
              onClick={() => props.onEnterCity(s.id)}
              className="font-display flex w-full items-center justify-center gap-2 rounded border border-[#c9a53f] bg-[#241c10] px-3 py-2 text-[11px] tracking-[0.2em] text-[#ecd28e] hover:bg-[#2c2210]"
            >
              <MapPin size={13} /> ENTER THE CITY
            </button>
          )}
          <button
            onClick={() => props.onRegenerateCity(s.id)}
            className="flex w-full items-center justify-center gap-2 rounded border border-[#33291a] bg-[#17130d] px-3 py-2 text-[11px] tracking-[0.14em] text-[#b8a67c] hover:border-[#4a3b24] hover:text-[#d8c9a3]"
          >
            <RefreshCw size={12} /> REGENERATE CITY PLAN
          </button>
        </div>
      </div>
    );
  };

  const renderKingdom = (k: Kingdom) => {
    const capital = world.settlements[k.capitalId];
    return (
      <div className="fade-up">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded" style={{ backgroundColor: `${k.color}33`, color: k.color }}>
            <Crown size={15} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8a7a58]">
            {k.title}{k.island ? " · Isle-realm" : ""}
          </span>
        </div>
        <RenameBox initial={k.name.text} onCommit={(v) => props.onRename("k", k.id, v)} />
        <p className="mt-1 text-[10.5px] italic text-[#8a7a58]">{k.name.meaning}</p>
        <div className="mt-3">
          <StatRow label="Ruler">{k.rulerTitle} {k.ruler}</StatRow>
          <StatRow label="Culture">{k.culture.charAt(0).toUpperCase() + k.culture.slice(1)}</StatRow>
          <StatRow label="Population">{fmt(k.population)}</StatRow>
          <StatRow label="Settlements">{k.settlementCount}</StatRow>
          <StatRow label="Extent">{fmt(k.area * 4)} sq. leagues</StatRow>
          <StatRow label="Seat of power">
            {capital ? (
              <button onClick={() => props.onSelectSettlement(capital.id)} className="underline decoration-dotted underline-offset-2 hover:text-[#e6cf8f]">
                {capital.name.text}
              </button>
            ) : "—"}
          </StatRow>
        </div>
        <p className="mt-3 border-l-2 pl-2.5 text-[12px] italic leading-relaxed text-[#b8a67c]" style={{ borderColor: k.color }}>
          The {k.title.toLowerCase()} holds its lands by oath and by sword. Its {capital ? `capital at ${capital.name.text}` : "lord"} commands {k.settlementCount} sworn settlements.
        </p>
      </div>
    );
  };

  const renderBuilding = () => {
    if (!props.cityPlan || selection?.kind !== "building") return null;
    const b = props.cityPlan.buildings.find((x) => x.id === selection.id);
    if (!b) return null;
    const label = b.name ?? b.type.charAt(0).toUpperCase() + b.type.slice(1);
    return (
      <div className="fade-up">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#241c10] text-[#e6cf8f]">
            <Home size={14} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8a7a58]">Building · {b.type}</span>
        </div>
        <div className="rounded border border-[#241c10] bg-[#17130d] px-2.5 py-2 text-[15px] text-[#e6d9b8]">{label}</div>
        <div className="mt-3">
          <StatRow label="Ward">{DISTRICT_LABEL[b.district]}</StatRow>
          <StatRow label="Craft">{b.type === "house" ? "Dwelling" : b.type}</StatRow>
          <StatRow label="Tenants">{b.type === "mansion" ? "A noble household" : b.type === "warehouse" ? "Merchants' goods" : `${2 + (b.id % 9)} souls`}</StatRow>
        </div>
        <p className="mt-3 text-[12px] italic leading-relaxed text-[#b8a67c]">
          {b.type === "tavern" || b.type === "inn"
            ? `${label} — where carters, sailors and disinherited younger sons drink away their wages.`
            : b.type === "smithy"
              ? "The ring of hammer on anvil sounds from first bell to dusk."
              : b.type === "chapel"
                ? "Tallow smoke and whispered prayers; the parish dead sleep behind it."
                : `One of ${props.cityPlan.buildings.length.toLocaleString()} rooftops within the walls.`}
        </p>
      </div>
    );
  };

  const renderLandmark = () => {
    if (!props.cityPlan || selection?.kind !== "landmark") return null;
    const lm = props.cityPlan.landmarks.find((x) => x.id === selection.id);
    if (!lm) return null;
    const titles: Record<string, string> = {
      keep: "Fortified keep", cathedral: "House of worship", townhall: "Civic hall",
      gate: "City gate", docks: "Harbour works", mine: "Mine workings",
    };
    return (
      <div className="fade-up">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#241c10] text-[#e6cf8f]">
            <Landmark size={14} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#8a7a58]">{titles[lm.type]}</span>
        </div>
        <div className="rounded border border-[#241c10] bg-[#17130d] px-2.5 py-2 text-[15px] text-[#e6d9b8]">{lm.name?.text}</div>
        <p className="mt-1 text-[10.5px] italic text-[#8a7a58]">{lm.name?.meaning}</p>
        <p className="mt-3 text-[12px] italic leading-relaxed text-[#b8a67c]">
          {lm.type === "gate" && "Toll is taken here from every cart entering the city; the doors close at the curfew bell."}
          {lm.type === "keep" && "Arrow loops, a deep well and a stubborn garrison: the city has never fallen while the keep held."}
          {lm.type === "cathedral" && "Its bells order the hours of every life in the city."}
          {lm.type === "townhall" && "Here the aldermen argue over tolls, walls and worthless foreign coins."}
          {lm.type === "docks" && "Cranes squeal, stevedores curse, and the harbourmaster grows quietly rich."}
          {lm.type === "mine" && "Ore comes up by dawn; smoke never leaves this side of the wall."}
        </p>
      </div>
    );
  };

  const renderOverview = () => {
    const st = world.stats;
    return (
      <div className="fade-up">
        <div className="mb-2 flex items-center gap-2 text-[#e6cf8f]">
          <Scroll size={15} />
          <span className="font-display text-[13px] tracking-[0.2em]">THE KNOWN WORLD</span>
        </div>
        <div className="mt-2">
          <StatRow label="Seed"><span className="font-mono text-[12px]">{world.params.seedText}</span></StatRow>
          <StatRow label="Realms">{world.kingdoms.length}</StatRow>
          <StatRow label="Settlements">{world.settlements.length}</StatRow>
          <StatRow label="Rivers">{world.rivers.length}</StatRow>
          <StatRow label="Roads">{world.roads.length}</StatRow>
          <StatRow label="Souls">{fmt(st.totalPopulation)}</StatRow>
          <StatRow label="Named regions">{world.regions.length}</StatRow>
        </div>
        <p className="mt-4 text-[12px] italic leading-relaxed text-[#8a7a58]">
          Click a city to inspect its people and purse. Click open land to read its realm.
          Double-click a city — or press Enter the City — to walk its streets.
        </p>
      </div>
    );
  };

  let body: React.ReactNode;
  if (props.mode === "city" && props.cityPlan) {
    const s = world.settlements[props.cityPlan.settlementId];
    if (selection?.kind === "building") body = renderBuilding();
    else if (selection?.kind === "landmark") body = renderLandmark();
    else body = (
      <div className="fade-up">
        <div className="rounded border border-[#3a2f1c] bg-[#1c1610] p-2.5">
          <div className="flex items-center gap-2 text-[#e6cf8f]">
            <DoorOpen size={14} />
            <span className="text-[12px]">Street level — click buildings, gates and landmarks.</span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
            <div className="rounded bg-[#14100b] p-1.5">
              <div className="font-mono text-[13px] text-[#c9a53f]">{props.cityPlan.buildings.length}</div>
              <div className="text-[9px] uppercase tracking-wider text-[#8a7a58]">Buildings</div>
            </div>
            <div className="rounded bg-[#14100b] p-1.5">
              <div className="font-mono text-[13px] text-[#c9a53f]">{props.cityPlan.gates.length}</div>
              <div className="text-[9px] uppercase tracking-wider text-[#8a7a58]">Gates</div>
            </div>
            <div className="rounded bg-[#14100b] p-1.5">
              <div className="font-mono text-[13px] text-[#c9a53f]">{props.cityPlan.streets.length}</div>
              <div className="text-[9px] uppercase tracking-wider text-[#8a7a58]">Streets</div>
            </div>
          </div>
        </div>
        <div className="mt-3">{renderSettlement(s, true)}</div>
      </div>
    );
  } else if (selection?.kind === "settlement") {
    body = renderSettlement(world.settlements[selection.id], false);
  } else if (selection?.kind === "kingdom") {
    body = renderKingdom(world.kingdoms[selection.id]);
  } else {
    body = renderOverview();
  }

  return (
    <div className="flex h-full w-[292px] shrink-0 flex-col border-l border-[#2b2115] bg-[#14100b]">
      <div className="flex items-center justify-between border-b border-[#2b2115] px-3 py-2.5">
        <span className="font-display text-[11px] tracking-[0.22em] text-[#8a7a58]">
          {props.mode === "city" ? "CITY RECORD" : "CHRONICLE"}
        </span>
        {props.mode === "city" && (
          <button onClick={props.onExitCity} className="rounded p-1 text-[#8a7a58] hover:text-[#e6d9b8]">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">{body}</div>
    </div>
  );
}
