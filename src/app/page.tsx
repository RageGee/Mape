"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapCanvas, { type FocusRequest } from "@/components/MapCanvas";
import LeftPanel, { type SavedWorldSummary } from "@/components/LeftPanel";
import RightPanel from "@/components/RightPanel";
import TopBar, { type JumpTarget } from "@/components/TopBar";
import BottomBar from "@/components/BottomBar";
import { generateWorld, cultureOfSettlement, regenerateCitySeed } from "@/lib/world";
import { generateCityPlan } from "@/lib/world/city";
import { drawWorldScene, type View } from "@/lib/render/worldCanvas";
import { hashString } from "@/lib/world/rng";
import { Loader2 } from "lucide-react";
import {
  DEFAULT_LAYERS, DEFAULT_PARAMS, EMPTY_OVERRIDES, type CityPlan,
  type LayerState, type MapStyle, type Selection, type WorldData,
  type WorldOverrides, type WorldParams,
} from "@/lib/world/types";

export default function Page() {
  const [params, setParams] = useState<WorldParams>(DEFAULT_PARAMS);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [overrides, setOverrides] = useState<WorldOverrides>(EMPTY_OVERRIDES);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [style, setStyle] = useState<MapStyle>("atlas");
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<"world" | "city">("world");
  const [cityPlan, setCityPlan] = useState<CityPlan | null>(null);
  const [citySettlementId, setCitySettlementId] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("Unrolling blank parchment…");
  const [saved, setSaved] = useState<SavedWorldSummary[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [viewInfo, setViewInfo] = useState<View>({ cx: 0, cy: 0, scale: 1 });
  const [, setBump] = useState(0);

  const worldView = useRef<View>({ cx: 200, cy: 140, scale: 0.8 });
  const cityView = useRef<View>({ cx: 0, cy: 0, scale: 1 });
  const planCache = useRef<Map<string, CityPlan>>(new Map());
  const worldRef = useRef<WorldData | null>(null);
  worldRef.current = world;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const focusNonce = useRef(0);

  // ---------- world generation ----------
  const forge = useCallback(async (p: WorldParams, ov: WorldOverrides, keepSavedId = false) => {
    setBusy(true);
    setStatus("Raising mountains from the deep…");
    await new Promise((r) => setTimeout(r, 60));
    const seed = /^-?\d+$/.test(p.seedText.trim()) ? Math.abs(parseInt(p.seedText.trim(), 10)) % 2147483647 : hashString(p.seedText.trim() || "ember");
    const eff: WorldParams = { ...p, seed: seed || 7815 };
    setStatus("Drawing coasts, loosing rivers…");
    await new Promise((r) => setTimeout(r, 30));
    const w = generateWorld(eff, ov);
    setStatus("Crowning kings and cutting roads…");
    await new Promise((r) => setTimeout(r, 30));
    planCache.current.clear();
    setWorld(w);
    setSelection(null);
    setMode("world");
    setCityPlan(null);
    setCitySettlementId(null);
    if (!keepSavedId) setSavedId(null);
    worldView.current = { cx: w.width / 2, cy: w.height / 2, scale: 0.4 };
    focusNonce.current++;
    setFocusRequest({ x: w.width / 2, y: w.height / 2, scale: -1, nonce: focusNonce.current });
    setStatus(`Chart complete — ${w.kingdoms.length} realms, ${w.settlements.length} settlements, seed ${eff.seedText}`);
    setBusy(false);
  }, []);

  // demo world on first load
  useEffect(() => {
    forge(DEFAULT_PARAMS, EMPTY_OVERRIDES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/worlds");
      if (res.ok) {
        const j = await res.json();
        setSaved(j.worlds ?? []);
      }
    } catch {
      /* archive offline */
    }
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // ---------- city ----------
  const enterCity = useCallback((id: number) => {
    const w = worldRef.current;
    if (!w) return;
    const s = w.settlements[id];
    const key = `${id}:${s.citySeed}`;
    let plan = planCache.current.get(key);
    if (!plan) {
      plan = generateCityPlan(s, cultureOfSettlement(w, s));
      planCache.current.set(key, plan);
    }
    setCityPlan(plan);
    setCitySettlementId(id);
    setMode("city");
    setSelection(null);
    cityView.current = { cx: 0, cy: 0, scale: 1 };
    focusNonce.current++;
    setFocusRequest({ x: 0, y: 0, scale: -2, nonce: focusNonce.current });
    setStatus(`You enter ${s.name.text} by the ${plan.gates[0]?.name.text ?? "North"} Gate.`);
  }, []);

  const exitCity = useCallback(() => {
    setMode("world");
    setCityPlan(null);
    setSelection(citySettlementId !== null ? { kind: "settlement", id: citySettlementId } : null);
    setCitySettlementId(null);
    setStatus("Returned to the high chart.");
  }, [citySettlementId]);

  const regenCity = useCallback((id: number) => {
    const w = worldRef.current;
    if (!w) return;
    const ov = regenerateCitySeed(w, id, overridesRef.current);
    setOverrides(ov);
    const newSeed = ov.citySeeds[String(id)];
    const s = w.settlements[id];
    s.citySeed = newSeed;
    const key = `${id}:${newSeed}`;
    const plan = generateCityPlan(s, cultureOfSettlement(w, s));
    planCache.current.set(key, plan);
    if (citySettlementId === id || mode === "city") {
      setCityPlan(plan);
      setCitySettlementId(id);
      setMode("city");
      focusNonce.current++;
      setFocusRequest({ x: 0, y: 0, scale: -2, nonce: focusNonce.current });
    }
    setSelection(null);
    setBump((b) => b + 1);
    setStatus(`The streets of ${s.name.text} are raised anew.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citySettlementId, mode]);

  // ---------- renaming ----------
  const rename = useCallback((scope: "s" | "k" | "r", id: number, name: string) => {
    const w = worldRef.current;
    if (!w) return;
    const ov: WorldOverrides = {
      renames: { ...overridesRef.current.renames, [`${scope}:${id}`]: name },
      citySeeds: { ...overridesRef.current.citySeeds },
    };
    setOverrides(ov);
    if (scope === "s") {
      w.settlements[id].name = { ...w.settlements[id].name, text: name, meaning: "named by the mapmaker" };
    } else if (scope === "k") {
      w.kingdoms[id].name = { ...w.kingdoms[id].name, text: name, meaning: "named by the mapmaker" };
    } else {
      w.rivers[id].name = { ...w.rivers[id].name, text: name, meaning: "named by the mapmaker" };
    }
    setBump((b) => b + 1);
    setStatus(`Renamed to ${name}. Saved when you store the world.`);
  }, []);

  // ---------- search / focus ----------
  const onJump = useCallback((t: JumpTarget) => {
    if (mode !== "world") exitCity();
    if (t.kind === "settlement") setSelection({ kind: "settlement", id: t.id });
    else if (t.kind === "kingdom") setSelection({ kind: "kingdom", id: t.id });
    focusNonce.current++;
    setFocusRequest({ x: t.x, y: t.y, scale: t.scale, nonce: focusNonce.current });
    setStatus(`The chart flies to ${t.label}.`);
  }, [mode, exitCity]);

  // ---------- persistence ----------
  const onSave = useCallback(async () => {
    const w = worldRef.current;
    if (!w) return;
    let name = "";
    let id = savedId;
    if (!id) {
      const def = `${w.kingdoms[0] ? `${w.kingdoms[0].name.text} and Its Neighbours` : "A New World"}`;
      name = window.prompt("Name this world for the archive:", def)?.trim() ?? "";
      if (!name) return;
    }
    setSaving(true);
    try {
      if (id) {
        await fetch(`/api/worlds/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params: w.params, overrides: overridesRef.current }),
        });
        setStatus("World updated in the archive.");
      } else {
        const res = await fetch("/api/worlds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, seedText: w.params.seedText, params: w.params, overrides: overridesRef.current }),
        });
        const j = await res.json();
        if (j.world?.id) setSavedId(j.world.id);
        setStatus(`"${name}" shelved in the archive.`);
      }
      await refreshSaved();
    } catch {
      setStatus("The archive could not be reached.");
    }
    setSaving(false);
  }, [savedId, refreshSaved]);

  const onLoadWorld = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/worlds/${id}`);
      const j = await res.json();
      if (!j.world) return;
      const row = j.world;
      const p = { ...(row.params as WorldParams) };
      const rawOv = (row.overrides ?? {}) as Partial<WorldOverrides>;
      const ov: WorldOverrides = { renames: rawOv.renames ?? {}, citySeeds: rawOv.citySeeds ?? {} };
      setParams(p);
      setOverrides(ov);
      setSavedId(row.id);
      await forge(p, ov, true);
      setStatus(`"${row.name}" unrolled from the archive.`);
    } catch {
      setStatus("Could not unroll that world.");
    }
  }, [forge]);

  const onDeleteWorld = useCallback(async (id: string) => {
    try {
      await fetch(`/api/worlds/${id}`, { method: "DELETE" });
      if (savedId === id) setSavedId(null);
      await refreshSaved();
    } catch { /* offline */ }
  }, [refreshSaved, savedId]);

  // ---------- export ----------
  const onExportPng = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const scale = 3;
    const cv = document.createElement("canvas");
    cv.width = w.width * scale;
    cv.height = w.height * scale;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    drawWorldScene(ctx, cv.width, cv.height, w, { cx: w.width / 2, cy: w.height / 2, scale }, style, layers, null);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = `cartographica-${w.params.seedText}.png`;
    a.click();
    setStatus("Chart pressed to a PNG plate.");
  }, [style, layers]);

  const onExportJson = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const data = {
      generator: "Cartographica v1",
      params: w.params,
      overrides: overridesRef.current,
      stats: w.stats,
      kingdoms: w.kingdoms,
      settlements: w.settlements,
      rivers: w.rivers.map((r) => ({ id: r.id, name: r.name, length: r.length, points: r.points })),
      roads: w.roads.map((r) => ({ a: r.a, b: r.b, trade: r.trade, length: r.path.length, bridges: r.bridges.length })),
      regions: w.regions,
    };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cartographica-${w.params.seedText}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("World ledger exported as JSON.");
  }, []);

  // keyboard: escape exits city
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "city") exitCity();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, exitCity]);

  const cityName = useMemo(() => {
    if (mode !== "city" || !world || citySettlementId === null) return null;
    return world.settlements[citySettlementId]?.name.text ?? null;
  }, [mode, world, citySettlementId]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar
        world={world}
        mode={mode}
        cityName={cityName}
        style={style}
        onStyleChange={setStyle}
        onJump={onJump}
        onSave={onSave}
        saving={saving}
        savedId={savedId}
        onExportPng={onExportPng}
        onExportJson={onExportJson}
        onExitCity={exitCity}
        busy={busy}
      />
      <div className="flex min-h-0 flex-1">
        <LeftPanel
          params={params}
          onParamsChange={setParams}
          onGenerate={() => forge(params, overrides)}
          generating={busy}
          layers={layers}
          onLayersChange={setLayers}
          saved={saved}
          savedId={savedId}
          onLoadWorld={onLoadWorld}
          onDeleteWorld={onDeleteWorld}
        />
        <div className="relative min-w-0 flex-1 bg-[#0a0806]">
          <MapCanvas
            world={world}
            style={style}
            layers={layers}
            selection={selection}
            mode={mode}
            cityPlan={cityPlan}
            worldView={worldView}
            cityView={cityView}
            onViewChange={setViewInfo}
            onSelect={setSelection}
            onEnterCity={enterCity}
            focusRequest={focusRequest}
            settlementName={cityName}
          />
          {busy && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0d0a07]/85 backdrop-blur-[2px]">
              <Loader2 size={30} className="animate-spin text-[#c9a53f]" />
              <div className="font-display text-[13px] tracking-[0.3em] text-[#ecd28e]">{status.toUpperCase()}</div>
              <div className="text-[11px] italic text-[#8a7a58]">terrain → realms → roads → cities, all from one seed</div>
            </div>
          )}
        </div>
        {world && (
          <RightPanel
            world={world}
            selection={selection}
            mode={mode}
            cityPlan={cityPlan}
            onRename={rename}
            onEnterCity={enterCity}
            onExitCity={exitCity}
            onRegenerateCity={regenCity}
            onSelectSettlement={(id) => {
              setSelection({ kind: "settlement", id });
              const s = world.settlements[id];
              focusNonce.current++;
              setFocusRequest({ x: s.x, y: s.y, scale: Math.max(worldView.current.scale, 4), nonce: focusNonce.current });
            }}
            onSelectKingdom={(id) => setSelection({ kind: "kingdom", id })}
          />
        )}
      </div>
      <BottomBar
        mode={mode}
        x={viewInfo.cx}
        y={viewInfo.cy}
        zoom={viewInfo.scale}
        seedText={world?.params.seedText ?? params.seedText}
        status={status}
        busy={busy}
        stats={world ? {
          settlements: world.settlements.length,
          kingdoms: world.kingdoms.length,
          roads: world.roads.length,
          rivers: world.rivers.length,
        } : null}
      />
    </div>
  );
}
