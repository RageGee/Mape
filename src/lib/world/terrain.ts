// Terrain generator: continents, elevation, climate, biomes, lakes, rivers,
// coastline segments and named natural regions. Fully deterministic by seed.

import { Rng, subSeed } from "./rng";
import { SimplexNoise } from "./noise";
import { Biome, type NamedRegion, type River, type WorldParams } from "./types";
import { NameFactory } from "./names";

export const SIZE_DEF: Record<string, { w: number; h: number }> = {
  small: { w: 330, h: 210 },
  medium: { w: 460, h: 290 },
  large: { w: 600, h: 380 },
};

export interface TerrainResult {
  width: number;
  height: number;
  elevation: Float32Array;
  moisture: Float32Array;
  temperature: Float32Array;
  biome: Uint8Array;
  riverTile: Int16Array;
  rivers: River[];
  regions: NamedRegion[];
  coastSegs: Float32Array;
  seaLevel: number;
  landTiles: number;
}

export function generateTerrain(params: WorldParams): TerrainResult {
  const { w: W, h: H } = SIZE_DEF[params.size];
  const N = W * H;
  const rng = new Rng(subSeed(params.seed, "terrain"));
  const nx = new SimplexNoise(new Rng(subSeed(params.seed, "noise-a")).next);
  const nx2 = new SimplexNoise(new Rng(subSeed(params.seed, "noise-b")).next);

  // --- continental masks: 3 major masses + scattered island hotspots ---
  const centers: { x: number; y: number; r: number }[] = [];
  const nCont = 3;
  for (let i = 0; i < nCont; i++) {
    centers.push({
      x: W * (0.18 + 0.64 * (i / (nCont - 1))) + rng.float(-W * 0.06, W * 0.06),
      y: H * rng.float(0.32, 0.68),
      r: W * rng.float(0.20, 0.27),
    });
  }
  const isles: { x: number; y: number; r: number }[] = [];
  const nIsles = 3 + rng.int(0, 3);
  for (let i = 0; i < nIsles; i++) {
    isles.push({ x: rng.float(0.05 * W, 0.95 * W), y: rng.float(0.12 * H, 0.88 * H), r: rng.float(4, 11) });
  }

  const elevation = new Float32Array(N);
  const fBase = 3.1 / W;
  const fDetail = fBase * 3.2;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // domain warp for organic coastlines
      const wx = nx.fbm(x * fBase * 2.1 + 31.7, y * fBase * 2.1, 3) * 26;
      const wy = nx.fbm(x * fBase * 2.1, y * fBase * 2.1 + 47.3, 3) * 26;
      const px = x + wx;
      const py = y + wy;

      let cont = 0;
      for (const c of centers) {
        const d = Math.hypot(px - c.x, (py - c.y) * 1.25);
        cont = Math.max(cont, 1 - d / c.r);
      }
      let isle = 0;
      for (const c of isles) {
        const d = Math.hypot(px - c.x, py - c.y);
        isle = Math.max(isle, 1 - d / c.r);
      }
      // edge falloff so worlds read like a bounded ocean chart
      const ex = Math.min(x, W - 1 - x) / (W * 0.09);
      const ey = Math.min(y, H - 1 - y) / (H * 0.09);
      const edge = Math.min(1, Math.max(0, Math.min(ex, ey)));

      const base = nx.fbm(px * fBase, py * fBase, 5) * 0.5 + 0.5;
      let e = base * 0.55 + Math.max(cont, 0) * 0.5 + isle * 0.34;
      e = e * (0.55 + 0.45 * edge) - (1 - edge) * 0.22;
      elevation[i] = e;
    }
  }

  // --- pick sea level so that ocean fraction matches params ---
  const sorted = Float32Array.from(elevation).sort();
  const seaFrac = Math.min(0.78, Math.max(0.2, params.oceanCoverage / 100));
  const seaLevel = sorted[Math.floor(seaFrac * (N - 1))];

  // --- mountains: ridged noise masked to continental interiors ---
  const mScale = params.mountainDensity / 100;
  const maskSeeds = [rng.float(0, 500), rng.float(0, 500)];
  for (let i = 0; i < N; i++) {
    if (elevation[i] <= seaLevel) continue;
    const x = i % W;
    const y = Math.floor(i / W);
    const mask = nx2.fbm(x * fBase * 1.6 + maskSeeds[0], y * fBase * 1.6 + maskSeeds[1], 3) * 0.5 + 0.5;
    const ridge = nx2.ridged(x * fBase * 4.0, y * fBase * 4.0, 4);
    const continental = Math.min(1, (elevation[i] - seaLevel) * 4);
    elevation[i] += ridge * ridge * Math.max(0, mask - (1 - mScale) * 0.62) * 0.62 * continental;
  }

  // --- climate ---
  const temperature = new Float32Array(N);
  const moisture = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const lat = Math.abs((y / H) * 2 - 1); // 0 equator (middle) .. 1 poles
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = elevation[i];
      const above = Math.max(0, e - seaLevel);
      let t = 1 - lat * 1.22 - above * 1.35;
      t += nx.fbm(x * fBase * 2.4 + 91, y * fBase * 2.4, 3) * 0.08;
      temperature[i] = t;
      let m = nx2.fbm(x * fBase * 2.9 + 17, y * fBase * 2.9 + 71, 4) * 0.5 + 0.5;
      m += 0.08 * Math.sin(lat * 6.28 + nx.noise(x * 0.01, y * 0.01));
      moisture[i] = Math.min(1, Math.max(0, m));
    }
  }
  // moisture bonus near water
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (elevation[i] > seaLevel) continue;
      moisture[i - 1] = Math.min(1, moisture[i - 1] + 0.05);
      moisture[i + 1] = Math.min(1, moisture[i + 1] + 0.05);
      moisture[i - W] = Math.min(1, moisture[i - W] + 0.05);
      moisture[i + W] = Math.min(1, moisture[i + W] + 0.05);
    }
  }

  // --- biomes ---
  const biome = new Uint8Array(N);
  const forestBias = (params.forestDensity - 50) / 100; // -0.5..0.5
  const aridBias = (params.aridity - 50) / 100;
  let landTiles = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = elevation[i];
      if (e <= seaLevel - 0.16) { biome[i] = Biome.DeepOcean; continue; }
      if (e <= seaLevel) { biome[i] = Biome.Ocean; continue; }
      const a = e - seaLevel;
      landTiles++;
      if (a < 0.014) {
        biome[i] = Biome.Beach;
        continue;
      }
      if (a > 0.46) { biome[i] = Biome.SnowPeak; continue; }
      if (a > 0.34) { biome[i] = Biome.Mountain; continue; }
      if (a > 0.20) { biome[i] = Biome.Hills; continue; }
      const t = temperature[i];
      let m = moisture[i];
      if (t < -0.28) { biome[i] = Biome.Glacier; continue; }
      if (t < -0.05) { biome[i] = m > 0.45 ? Biome.Taiga : Biome.Tundra; continue; }
      const dryThresh = 0.47 - aridBias * 0.55;
      if (t > 0.30 && m < dryThresh - 0.16) { biome[i] = Biome.Desert; continue; }
      if (t > 0.26 && m < dryThresh + 0.02) { biome[i] = Biome.Savanna; continue; }
      if (a < 0.05 && m > 0.62) { biome[i] = Biome.Swamp; continue; }
      m = moisture[i];
      if (m > 0.52 - forestBias * 0.5) { biome[i] = t < 0.08 ? Biome.Taiga : Biome.TemperateForest; continue; }
      biome[i] = Biome.Grassland;
    }
  }

  // --- lakes: fill tiny depressions ---
  const rngL = rng.fork("lakes");
  const lakeSpots = 2 + Math.round(params.riverDensity / 34);
  for (let s = 0; s < lakeSpots * 6 && lakeSpots > 0; s++) {
    const cx = rngL.int(4, W - 5);
    const cy = rngL.int(4, H - 5);
    const ci = cy * W + cx;
    if (biome[ci] !== Biome.Swamp && biome[ci] !== Biome.TemperateForest && biome[ci] !== Biome.Taiga && biome[ci] !== Biome.Grassland) continue;
    const r = rngL.int(2, 5);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const j = (cy + dy) * W + (cx + dx);
        if (elevation[j] - seaLevel < 0.2 && elevation[j] > seaLevel) {
          biome[j] = Biome.Lake;
          elevation[j] = seaLevel - 0.03;
        }
      }
    }
  }

  // --- rivers ---
  const isWater = (b: number) => b === Biome.Ocean || b === Biome.DeepOcean || b === Biome.Lake;
  const riverTile = new Int16Array(N);
  const rivers: River[] = [];
  const rngR = rng.fork("rivers");
  const riverCount = Math.round((landTiles / 900) * (0.35 + params.riverDensity / 60));
  // carve altitude so rivers always find a way down
  const carve = Float32Array.from(elevation);
  const sources: number[] = [];
  for (let i = 0; i < N; i++) {
    const b = biome[i];
    if ((b === Biome.Mountain || b === Biome.Hills || b === Biome.SnowPeak) && rngR.chance(0.9)) sources.push(i);
  }
  rngR.shuffle(sources);
  let riversMade = 0;
  for (const src of sources) {
    if (riversMade >= riverCount) break;
    const path: number[] = [src];
    let cur = src;
    let ok = false;
    for (let step = 0; step < 500; step++) {
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      let best = -1;
      let bestE = carve[cur];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx2i = cx + dx;
          const nyi = cy + dy;
          if (nx2i < 0 || nyi < 0 || nx2i >= W || nyi >= H) continue;
          const j = nyi * W + nx2i;
          if (isWater(biome[j]) || riverTile[j] > 0) { best = j; bestE = -1; dy = 9; break; }
          const jitter = rngR.next() * 0.012;
          const e = carve[j] + jitter;
          if (e < bestE) { bestE = e; best = j; }
        }
      }
      if (best < 0) break;
      if (isWater(biome[best])) { ok = path.length > 7; break; }
      if (riverTile[best] > 0) {
        ok = path.length > 7;
        path.push(best);
        break;
      }
      if (carve[best] >= carve[cur]) {
        carve[best] = carve[cur] - 0.004 - rngR.next() * 0.004; // carve downhill
      }
      path.push(best);
      cur = best;
    }
    if (!ok) continue;
    riversMade++;
    for (const t of path) riverTile[t] = riversMade;
    rivers.push({
      id: riversMade - 1,
      name: { text: `River ${riversMade}`, lang: "", meaning: "" },
      points: path,
      length: path.length,
    });
  }

  // --- coastline segments (land↔ocean tile edges) ---
  const coast: number[] = [];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      const wl = isWater(biome[i]);
      const wr = isWater(biome[i + 1]);
      const wd = isWater(biome[i + W]);
      if (wl !== wr) coast.push(x + 1, y, x + 1, y + 1);
      if (wl !== wd) coast.push(x, y + 1, x + 1, y + 1);
    }
  }

  // --- named natural regions (connected components) ---
  const regions: NamedRegion[] = [];
  const nf = new NameFactory(subSeed(params.seed, "regions"));
  const visited = new Uint8Array(N);
  const cultures: ("nordheim" | "vaelora" | "stravia" | "kaelan" | "mahlden")[] = ["nordheim", "vaelora", "stravia", "kaelan", "mahlden"];
  const consider = (b: Biome): ("mountains" | "forest" | "desert" | "swamp") | null => {
    if (b === Biome.Mountain || b === Biome.SnowPeak) return "mountains";
    if (b === Biome.TemperateForest || b === Biome.Taiga) return "forest";
    if (b === Biome.Desert) return "desert";
    if (b === Biome.Swamp) return "swamp";
    return null;
  };
  const minSize = { mountains: 26, forest: 60, desert: 90, swamp: 40 };
  for (let i = 0; i < N; i++) {
    if (visited[i]) continue;
    const kind = consider(biome[i] as Biome);
    if (!kind) { visited[i] = 1; continue; }
    // flood fill
    const stack = [i];
    visited[i] = 1;
    let sx = 0, sy = 0, n = 0;
    while (stack.length) {
      const j = stack.pop() as number;
      const jx = j % W;
      const jy = Math.floor(j / W);
      sx += jx; sy += jy; n++;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const ax = jx + dx, ay = jy + dy;
          if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
          const k = ay * W + ax;
          if (!visited[k] && consider(biome[k] as Biome) === kind) {
            visited[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    if (n >= minSize[kind]) {
      const cx = sx / n, cy = sy / n;
      const cult = cultures[Math.min(4, Math.floor((cx / W) * 5))];
      regions.push({
        id: regions.length,
        kind,
        name: nf.regionName(cult, kind),
        x: cx, y: cy,
        size: n,
      });
    }
  }
  regions.sort((a, b) => b.size - a.size);
  regions.splice(14);

  return {
    width: W, height: H, elevation, moisture, temperature, biome,
    riverTile, rivers, regions, coastSegs: Float32Array.from(coast), seaLevel, landTiles,
  };
}
