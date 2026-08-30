// World map renderer: pre-rendered terrain raster per style + vector overlays
// (borders, rivers, roads, settlements, labels) with level-of-detail.

import { Biome, type LayerState, type MapStyle, type Selection, type Settlement, type WorldData } from "@/lib/world/types";
import { STYLES } from "./palette";
import { OCEAN_NAMES } from "./palette";

export interface View { cx: number; cy: number; scale: number }

interface WorldCache {
  terrain: Map<MapStyle, HTMLCanvasElement>;
  riverPts: Map<number, { x: number; y: number }[]>;
  roadPts: Map<number, { x: number; y: number }[]>;
  kingdomCentroids: Map<number, { x: number; y: number }>;
}

const caches = new WeakMap<WorldData, WorldCache>();

export function getCache(world: WorldData): WorldCache {
  let c = caches.get(world);
  if (!c) {
    c = { terrain: new Map(), riverPts: new Map(), roadPts: new Map(), kingdomCentroids: new Map() };
    caches.set(world, c);
  }
  return c;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function chaikin(pts: { x: number; y: number }[], closed = false): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const out: { x: number; y: number }[] = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    if (i === 0 && !closed) out.push(a);
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    if (i === last - 1 && !closed) out.push(b);
  }
  return out;
}

function buildTerrain(world: WorldData, style: MapStyle): HTMLCanvasElement {
  const W = world.width, H = world.height;
  const S = 2; // raster pixels per tile
  const cv = document.createElement("canvas");
  cv.width = W * S;
  cv.height = H * S;
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
  const img = ctx.createImageData(W, H);
  const pal = STYLES[style].biomes;
  const cache = new Map<number, [number, number, number]>();
  const colorOf = (b: number): [number, number, number] => {
    let c = cache.get(b);
    if (!c) { c = hexToRgb(pal[b] ?? "#000000"); cache.set(b, c); }
    return c;
  };
  const isSea = (b: Biome) => b === Biome.Ocean || b === Biome.DeepOcean || b === Biome.Lake;
  let seaMax = 0;
  for (let i = 0; i < W * H; i++) if (isSea(world.biome[i] as Biome)) seaMax = Math.max(seaMax, world.elevation[i]);
  const kdColor = style === "political" ? world.kingdoms.map((k) => hexToRgb(k.color)) : null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const b = world.biome[i] as Biome;
      let [r, g, bl] = colorOf(b);
      // hill-shading from elevation
      const xl = x > 0 ? world.elevation[i - 1] : world.elevation[i];
      const xr = x < W - 1 ? world.elevation[i + 1] : world.elevation[i];
      const yt = y > 0 ? world.elevation[i - W] : world.elevation[i];
      const yb = y < H - 1 ? world.elevation[i + W] : world.elevation[i];
      let shade = (xl - xr) * 5.4 + (yt - yb) * 5.4;
      if (isSea(b)) shade *= 0.35;
      // kingdom tint for political style
      if (kdColor) {
        const kid = world.kingdomTile[i];
        if (kid >= 0 && kid < kdColor.length && !isSea(b) && b !== Biome.Mountain && b !== Biome.SnowPeak && b !== Biome.Glacier) {
          const kc = kdColor[kid];
          r = r * 0.45 + kc[0] * 0.55;
          g = g * 0.45 + kc[1] * 0.55;
          bl = bl * 0.45 + kc[2] * 0.55;
        }
      }
      const m = 1 + Math.max(-0.3, Math.min(0.3, shade));
      // subtle grain
      const grain = ((x * 73856093) ^ (y * 19349663)) % 7 - 3;
      const gi = i * 4;
      img.data[gi] = Math.max(0, Math.min(255, r * m + grain));
      img.data[gi + 1] = Math.max(0, Math.min(255, g * m + grain));
      img.data[gi + 2] = Math.max(0, Math.min(255, bl * m + grain));
      img.data[gi + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cv, 0, 0, W, H, 0, 0, W * S, H * S);
  // coastline ink
  ctx.strokeStyle = STYLES[style].coastInk;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const seg = world.coastSegs;
  for (let i = 0; i < seg.length; i += 4) {
    ctx.moveTo(seg[i] * S, seg[i + 1] * S);
    ctx.lineTo(seg[i + 2] * S, seg[i + 3] * S);
  }
  ctx.stroke();
  void seaMax;
  return cv;
}

export function getTerrainCanvas(world: WorldData, style: MapStyle): HTMLCanvasElement {
  const cache = getCache(world);
  let cv = cache.terrain.get(style);
  if (!cv) {
    cv = buildTerrain(world, style);
    cache.terrain.set(style, cv);
  }
  return cv;
}

function riverPoints(world: WorldData, id: number): { x: number; y: number }[] {
  const cache = getCache(world);
  let p = cache.riverPts.get(id);
  if (!p) {
    const river = world.rivers[id];
    const raw = river.points.map((t) => ({ x: (t % world.width) + 0.5, y: Math.floor(t / world.width) + 0.5 }));
    p = chaikin(raw);
    cache.riverPts.set(id, p);
  }
  return p;
}

function roadPoints(world: WorldData, id: number): { x: number; y: number }[] {
  const cache = getCache(world);
  let p = cache.roadPts.get(id);
  if (!p) {
    const road = world.roads[id];
    const raw = road.path.map((t) => ({ x: (t % world.width) + 0.5, y: Math.floor(t / world.width) + 0.5 }));
    p = chaikin(raw);
    cache.roadPts.set(id, p);
  }
  return p;
}

function kingdomCentroid(world: WorldData, id: number): { x: number; y: number } {
  const cache = getCache(world);
  let c = cache.kingdomCentroids.get(id);
  if (!c) {
    let sx = 0, sy = 0, n = 0;
    const W = world.width;
    for (let i = 0; i < world.kingdomTile.length; i += 3) {
      if (world.kingdomTile[i] === id) { sx += i % W; sy += Math.floor(i / W); n++; }
    }
    c = n ? { x: sx / n, y: sy / n } : { x: W / 2, y: world.height / 2 };
    cache.kingdomCentroids.set(id, c);
  }
  return c;
}

const RANK_SIZE: Record<string, number> = { metropolis: 5.4, capital: 4.6, city: 3.6, town: 2.6, village: 1.8, hamlet: 1.2 };

export function drawWorldScene(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  world: WorldData,
  view: View,
  style: MapStyle,
  layers: LayerState,
  selection: Selection,
): void {
  const st = STYLES[style];
  const W = world.width, H = world.height;
  const toSX = (wx: number) => (wx - view.cx) * view.scale + cw / 2;
  const toSY = (wy: number) => (wy - view.cy) * view.scale + ch / 2;

  // background of the void beyond the chart
  ctx.fillStyle = style === "strategos" ? "#090b0e" : st.biomes[Biome.Ocean];
  ctx.fillRect(0, 0, cw, ch);

  const terr = getTerrainCanvas(world, style);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(terr, 0, 0, terr.width, terr.height, toSX(0), toSY(0), W * view.scale, H * view.scale);

  // parchment vignette edges for atlas
  if (style !== "strategos") {
    ctx.strokeStyle = style === "atlas" ? "rgba(70,52,30,0.5)" : "rgba(60,50,35,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(toSX(0), toSY(0), W * view.scale, H * view.scale);
  }

  // graticule
  ctx.strokeStyle = st.graticule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = W > 500 ? 60 : 40;
  for (let x = step; x < W; x += step) { ctx.moveTo(toSX(x), toSY(0)); ctx.lineTo(toSX(x), toSY(H)); }
  for (let y = step; y < H; y += step) { ctx.moveTo(toSX(0), toSY(y)); ctx.lineTo(toSX(W), toSY(y)); }
  ctx.stroke();

  const x0 = Math.max(0, view.cx - cw / 2 / view.scale - 2);
  const x1 = Math.min(W, view.cx + cw / 2 / view.scale + 2);
  const y0 = Math.max(0, view.cy - ch / 2 / view.scale - 2);
  const y1 = Math.min(H, view.cy + ch / 2 / view.scale + 2);

  // borders
  if (layers.borders) {
    ctx.strokeStyle = st.border;
    ctx.lineWidth = Math.max(0.8, view.scale * 0.09);
    ctx.setLineDash(st.borderDash.map((d) => d * Math.max(1, view.scale * 0.14)));
    const onlyMajor = view.scale < 0.8;
    ctx.beginPath();
    const bs = world.borderSegs;
    const stride = onlyMajor ? 8 : 4;
    for (let i = 0; i < bs.length; i += stride) {
      const ax = bs[i], ay = bs[i + 1];
      if (ax < x0 - 1 || ax > x1 + 1 || ay < y0 - 1 || ay > y1 + 1) continue;
      ctx.moveTo(toSX(ax), toSY(ay));
      ctx.lineTo(toSX(bs[i + 2]), toSY(bs[i + 3]));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // rivers
  if (layers.rivers) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const river of world.rivers) {
      const srcTile = river.points[0];
      const sx = srcTile % W, sy = Math.floor(srcTile / W);
      if (sx < x0 - 60 || sx > x1 + 60 || sy < y0 - 60 || sy > y1 + 60) {
        const m = river.points[river.points.length - 1];
        const mx = m % W, my = Math.floor(m / W);
        if (mx < x0 - 60 || mx > x1 + 60 || my < y0 - 60 || my > y1 + 60) continue;
      }
      const pts = riverPoints(world, river.id);
      const wpx = Math.max(0.7, Math.min(4.2, (0.35 + river.length * 0.045) * view.scale * 0.55));
      ctx.strokeStyle = st.river;
      ctx.lineWidth = wpx;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(toSX(p.x), toSY(p.y)) : ctx.lineTo(toSX(p.x), toSY(p.y))));
      ctx.stroke();
    }
  }

  // roads
  if (layers.roads || layers.tradeRoutes) {
    ctx.lineJoin = "round";
    for (const road of world.roads) {
      const isTrade = road.trade;
      if (isTrade ? !layers.tradeRoutes : !layers.roads) continue;
      const a = world.settlements[road.a];
      if ((a.x < x0 - 40 || a.x > x1 + 40) && (world.settlements[road.b].x < x0 - 40 || world.settlements[road.b].x > x1 + 40)) continue;
      ctx.strokeStyle = isTrade ? st.trade : st.road;
      ctx.setLineDash(isTrade ? [Math.max(3, view.scale * 0.8), Math.max(2, view.scale * 0.5)] : []);
      ctx.lineWidth = Math.max(0.5, (isTrade ? 1.15 : 0.8) * Math.min(1.6, view.scale * 0.5));
      const pts = roadPoints(world, road.id);
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(toSX(p.x), toSY(p.y)) : ctx.lineTo(toSX(p.x), toSY(p.y))));
      ctx.stroke();
      ctx.setLineDash([]);
      // bridges
      if (view.scale > 2.2 && road.bridges.length) {
        ctx.fillStyle = st.settlement;
        for (const bt of road.bridges) {
          const bx = bt % W, by = Math.floor(bt / W);
          ctx.fillRect(toSX(bx) - 1.5, toSY(by) - 1.5, 3, 3);
        }
      }
    }
  }

  // settlements
  if (layers.settlements) {
    for (const s of world.settlements) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      if (view.scale < 0.5 && s.rank !== "metropolis" && s.rank !== "capital") continue;
      if (view.scale < 1.0 && (s.rank === "village" || s.rank === "hamlet")) continue;
      if (view.scale < 1.9 && s.rank === "hamlet") continue;
      const px = toSX(s.x), py = toSY(s.y);
      const base = RANK_SIZE[s.rank] ?? 2;
      const r = Math.max(1.1, base * Math.min(1.75, Math.max(0.62, view.scale * 0.5)));
      const selected = selection?.kind === "settlement" && selection.id === s.id;
      ctx.beginPath();
      ctx.fillStyle = st.settlement;
      ctx.strokeStyle = st.settlementStroke;
      ctx.lineWidth = 1;
      if (s.rank === "metropolis" || s.rank === "capital") {
        ctx.arc(px, py, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = st.settlement;
        ctx.lineWidth = 1.4;
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.rank === "city") {
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.rank === "town") {
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = st.settlement;
        ctx.stroke();
      } else {
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.walled && view.scale > 1.4) {
        ctx.strokeStyle = st.settlement;
        ctx.lineWidth = 1;
        ctx.strokeRect(px - r - 2.4, py - r - 2.4, (r + 2.4) * 2, (r + 2.4) * 2);
      }
      if (selected) {
        ctx.beginPath();
        ctx.strokeStyle = "#e9b64c";
        ctx.lineWidth = 2;
        ctx.arc(px, py, r + 5.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(233,182,76,0.4)";
        ctx.arc(px, py, r + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // labels
  if (layers.labels) {
    ctx.textAlign = "center";
    const drawText = (text: string, px: number, py: number, size: number, color: string, italic = false) => {
      ctx.font = `${italic ? "italic " : ""}${size}px "EB Garamond", Georgia, serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = st.labelHalo;
      ctx.strokeText(text, px, py);
      ctx.fillStyle = color;
      ctx.fillText(text, px, py);
    };
    // ocean names
    const o1 = OCEAN_NAMES[world.params.seed % OCEAN_NAMES.length];
    const o2 = OCEAN_NAMES[(world.params.seed + 1) % OCEAN_NAMES.length];
    const o3 = OCEAN_NAMES[(world.params.seed + 2) % OCEAN_NAMES.length];
    if (view.scale < 3) {
      drawText(o1, toSX(W * 0.5), toSY(H * 0.07), Math.max(11, 13 * Math.min(2, view.scale + 0.6)), st.oceanLabel, true);
      drawText(o2, toSX(W * 0.1), toSY(H * 0.82), Math.max(11, 12 * Math.min(2, view.scale + 0.6)), st.oceanLabel, true);
      drawText(o3, toSX(W * 0.9), toSY(H * 0.3), Math.max(11, 12 * Math.min(2, view.scale + 0.6)), st.oceanLabel, true);
    }
    // kingdom names
    if (view.scale < 2.4) {
      for (const k of world.kingdoms) {
        const c = kingdomCentroid(world, k.id);
        if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
        const size = Math.max(12, Math.min(26, 9 + k.area / 300)) * Math.min(1.4, Math.max(0.8, view.scale * 0.55));
        drawText(`${k.title} ${k.name.text}`.toUpperCase(), toSX(c.x), toSY(c.y), size, style === "strategos" ? "rgba(224,196,120,0.75)" : "rgba(72,42,30,0.68)");
      }
    }
    // regions
    if (layers.regions && view.scale > 0.55 && view.scale < 5) {
      for (const rg of world.regions) {
        if (rg.x < x0 || rg.x > x1 || rg.y < y0 || rg.y > y1) continue;
        drawText(rg.name.text.toUpperCase(), toSX(rg.x), toSY(rg.y), Math.max(9.5, Math.min(15, 8 + rg.size / 60)), st.regionLabel, true);
      }
    }
    // settlement labels
    for (const s of world.settlements) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const show =
        s.rank === "metropolis" || s.rank === "capital" ||
        (s.rank === "city" && view.scale > 0.42) ||
        (s.rank === "town" && view.scale > 1.05) ||
        (s.rank === "village" && view.scale > 2.4) ||
        (s.rank === "hamlet" && view.scale > 3.4);
      if (!show) continue;
      const size = s.rank === "metropolis" ? 15.5 : s.rank === "capital" ? 13.5 : s.rank === "city" ? 11.5 : s.rank === "town" ? 10 : 9;
      const px = toSX(s.x);
      const py = toSY(s.y) - (RANK_SIZE[s.rank] ?? 2) * Math.min(1.75, Math.max(0.62, view.scale * 0.5)) - 4;
      drawText(s.name.text, px, py, size * Math.min(1.25, Math.max(0.85, view.scale * 0.45)), st.label);
    }
  }
}

export function nearestSettlement(world: WorldData, wx: number, wy: number, view: View): Settlement | null {
  let best: Settlement | null = null;
  let bd = 14 / view.scale; // 14 screen px tolerance
  for (const s of world.settlements) {
    const d = Math.hypot(s.x - wx, s.y - wy);
    const tol = Math.max(bd, (RANK_SIZE[s.rank] ?? 2) / view.scale + 6 / view.scale);
    if (d < Math.max(bd, tol)) {
      if (!best || d < Math.hypot(best.x - wx, best.y - wy)) { best = s; }
    }
  }
  return best;
}
