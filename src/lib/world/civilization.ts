// Civilization generator: settlement siting from geography, organic realm
// expansion (multi-source Dijkstra with terrain costs), road networks via A*,
// and per-settlement economy / history. All deterministic from the world seed.

import { Rng, subSeed } from "./rng";
import { SimplexNoise } from "./noise";
import {
  Biome, type CultureId, type Kingdom, type Named, type RoadEdge,
  type Settlement, type SettlementKind, type SettlementRank, type WorldParams,
} from "./types";
import { NameFactory } from "./names";
import type { TerrainResult } from "./terrain";

class MinHeap {
  keys: number[] = [];
  vals: number[] = [];
  get size() { return this.keys.length; }
  push(key: number, val: number) {
    this.keys.push(key); this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.vals[p] <= this.vals[i]) break;
      this.swap(i, p); i = p;
    }
  }
  pop(): number {
    const top = this.keys[0];
    const lk = this.keys.pop() as number;
    const lv = this.vals.pop() as number;
    if (this.keys.length) {
      this.keys[0] = lk; this.vals[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.vals.length && this.vals[l] < this.vals[m]) m = l;
        if (r < this.vals.length && this.vals[r] < this.vals[m]) m = r;
        if (m === i) break;
        this.swap(i, m); i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    let t = this.keys[a]; this.keys[a] = this.keys[b]; this.keys[b] = t;
    let u = this.vals[a]; this.vals[a] = this.vals[b]; this.vals[b] = u;
  }
}

const CULTURE_BY_X: CultureId[] = ["kaelan", "nordheim", "mahlden", "vaelora", "stravia"];

function isWaterBiome(b: Biome): boolean {
  return b === Biome.Ocean || b === Biome.DeepOcean || b === Biome.Lake;
}

export interface CivResult {
  settlements: Settlement[];
  kingdoms: Kingdom[];
  roads: RoadEdge[];
  kingdomTile: Int16Array;
  borderSegs: Float32Array;
  urbanPopulation: number;
}

export function generateCivilization(params: WorldParams, t: TerrainResult): CivResult {
  const W = t.width, H = t.height, N = W * H;
  const rng = new Rng(subSeed(params.seed, "civilization"));
  const nf = new NameFactory(subSeed(params.seed, "names-main"));
  const sea = t.seaLevel;

  // ---------- 1. settlement desirability ----------
  const allowed = new Set<number>([
    Biome.Beach, Biome.Grassland, Biome.TemperateForest, Biome.Taiga, Biome.Savanna,
    Biome.Hills, Biome.Swamp, Biome.Desert, Biome.Tundra,
  ]);
  const cand: { i: number; s: number }[] = [];
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      const b = t.biome[i] as Biome;
      if (!allowed.has(b)) continue;
      const a = t.elevation[i] - sea;
      let s = 0.35 + (0.22 - Math.min(0.22, a)) * 2.2; // flatland bonus
      let riverHere = t.riverTile[i] > 0;
      let riverAdj = 0, coastAdj = 0, hillAdj = 0, forestAdj = 0, mountAdj = 0, harshAdj = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const j = (y + dy) * W + (x + dx);
          const bb = t.biome[j] as Biome;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d === 0) continue;
          if (isWaterBiome(bb)) coastAdj += 1 / (d + 1);
          if (t.riverTile[j] > 0 && !isWaterBiome(b)) riverAdj += 1 / (d + 1);
          if (bb === Biome.Hills) hillAdj++;
          if (bb === Biome.Mountain || bb === Biome.SnowPeak) mountAdj++;
          if (bb === Biome.TemperateForest || bb === Biome.Taiga) forestAdj += 0.4;
          if (bb === Biome.Swamp || bb === Biome.Desert || bb === Biome.Tundra) harshAdj++;
        }
      }
      s += Math.min(2.6, riverAdj * 0.85) + (riverHere ? 0.9 : 0);
      s += Math.min(1.9, coastAdj * 0.9);
      s += Math.min(0.7, hillAdj * 0.12) + Math.min(0.6, mountAdj * 0.1) + Math.min(0.5, forestAdj * 0.1);
      s -= Math.min(1.3, harshAdj * 0.1);
      if (b === Biome.Swamp) s -= 0.8;
      if (b === Biome.Desert) s -= 0.7;
      if (b === Biome.Tundra) s -= 0.45;
      if (b === Biome.Beach) s += 0.25;
      s += rng.next() * 0.7;
      cand.push({ i, s });
    }
  }
  cand.sort((p, q) => q.s - p.s);

  const targetCount = Math.max(40, Math.min(420, Math.round((t.landTiles / 380) * (params.population / 100))));

  // greedy with spacing
  const occupied = new Map<string, number>();
  const cell = 6;
  const picked: { i: number; s: number }[] = [];
  const spacingSteps = [10, 8, 6.5, 5, 4];
  for (const spacing of spacingSteps) {
    if (picked.length >= targetCount) break;
    for (const c of cand) {
      if (picked.length >= targetCount) break;
      const x = c.i % W, y = Math.floor(c.i / W);
      let free = true;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      outer: for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const oi = occupied.get(`${gx + dx},${gy + dy}`);
          if (oi === undefined) continue;
          const ox = oi % W, oy = Math.floor(oi / W);
          if (Math.hypot(ox - x, oy - y) < spacing) { free = false; break outer; }
        }
      }
      if (!free) continue;
      if (picked.some((p) => p.i === c.i)) continue;
      occupied.set(`${gx},${gy}`, c.i);
      picked.push(c);
    }
  }

  // ---------- 2. ranks ----------
  const sortedByScore = [...picked].sort((a, b) => b.s - a.s);
  const rankOf = new Map<number, SettlementRank>();
  const nCity = Math.max(3, Math.min(14, Math.round(picked.length * 0.075)));
  const nTown = Math.round(picked.length * 0.24);
  sortedByScore.forEach((p, idx) => {
    rankOf.set(p.i, idx < nCity ? "city" : idx < nCity + nTown ? "town" : idx < nCity + nTown + Math.round(picked.length * 0.42) ? "village" : "hamlet");
  });

  // ---------- 3. realms ----------
  const kingdomTile = new Int16Array(N).fill(-1);
  const K = Math.max(3, Math.min(16, Math.round(3 + (params.politicalFragmentation / 100) * (t.landTiles / 5800))));
  const capitals: number[] = [];
  const pool = sortedByScore.filter((p) => rankOf.get(p.i) === "city" || rankOf.get(p.i) === "town");
  if (pool.length) {
    capitals.push(pool[0].i);
    while (capitals.length < Math.min(K, pool.length)) {
      let bestI = -1, bestScore = -1;
      for (const p of pool) {
        if (capitals.includes(p.i)) continue;
        const x = p.i % W, y = Math.floor(p.i / W);
        let dMin = Infinity;
        for (const c of capitals) {
          const cx = c % W, cy = Math.floor(c / W);
          dMin = Math.min(dMin, Math.hypot(cx - x, cy - y));
        }
        const val = Math.min(dMin, W * 0.4) * (0.6 + p.s);
        if (val > bestScore) { bestScore = val; bestI = p.i; }
      }
      if (bestI < 0) break;
      capitals.push(bestI);
    }
  }

  // organic jitter so borders meander
  const jitterNoise = new SimplexNoise(new Rng(subSeed(params.seed, "border-jitter")).next);
  const jitter = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      jitter[y * W + x] = jitterNoise.fbm(x * 0.045, y * 0.045, 3) * 1.5;
    }
  }

  // multi-source Dijkstra expansion
  const dist = new Float32Array(N).fill(Infinity);
  const heap = new MinHeap();
  capitals.forEach((c, k) => { dist[c] = 0; kingdomTile[c] = k; heap.push(c, 0); });
  while (heap.size) {
    const i = heap.pop();
    const k = kingdomTile[i];
    const x = i % W, y = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const ax = x + dx, ay = y + dy;
        if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
        const j = ay * W + ax;
        const b = t.biome[j] as Biome;
        if (isWaterBiome(b)) continue;
        const a2 = t.elevation[j] - sea;
        let step = 1.35 + Math.max(0, a2) * 8 + jitter[j] * 0.9 + (dx && dy ? 0.41 : 0);
        if (b === Biome.Mountain) step += 26;
        if (b === Biome.SnowPeak) step += 60;
        if (b === Biome.Glacier) step += 20;
        if (t.riverTile[j] > 0) step += 0.8; // rivers resist expansion slightly
        const nd = dist[i] + step;
        if (nd < dist[j]) {
          dist[j] = nd;
          kingdomTile[j] = k;
          heap.push(j, nd);
        }
      }
    }
  }

  // ---------- 4. independent islands become their own realms ----------
  const kings: { capitalTile: number; island: boolean }[] = capitals.map((c) => ({ capitalTile: c, island: false }));
  const visited = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (visited[i]) continue;
    if (kingdomTile[i] !== -1) { visited[i] = 1; continue; }
    if (isWaterBiome(t.biome[i] as Biome)) { visited[i] = 1; continue; }
    // unreached land component
    const comp: number[] = [];
    const stack = [i];
    visited[i] = 1;
    while (stack.length) {
      const j = stack.pop() as number;
      comp.push(j);
      const jx = j % W, jy = Math.floor(j / W);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const ax = jx + dx, ay = jy + dy;
          if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
          const k2 = ay * W + ax;
          if (!visited[k2] && !isWaterBiome(t.biome[k2] as Biome) && kingdomTile[k2] === -1) {
            visited[k2] = 1;
            stack.push(k2);
          }
        }
      }
    }
    if (comp.length >= 90 && kings.length < 20) {
      // best settlement candidate inside
      const kid = kings.length;
      for (const j of comp) kingdomTile[j] = kid;
      let capTile = comp[0], bestA = -1;
      for (const j of comp) {
        const a = t.elevation[j] - sea;
        if (a > 0.008 && (bestA < 0 || a < bestA)) { bestA = a; capTile = j; }
      }
      kings.push({ capitalTile: capTile, island: true });
    }
  }

  // ---------- 5. place settlements into realms, build kingdom data ----------
  const kingdomOfX = (x: number): CultureId => CULTURE_BY_X[Math.max(0, Math.min(4, Math.floor((x / W) * 5)))];

  const settlements: Settlement[] = [];
  const byId = new Map<number, Settlement>();
  const tileToSettlement = new Map<number, Settlement>();

  const paletteColors = ["#a24b4b", "#4b7da2", "#7da24b", "#a2824b", "#7d4ba2", "#4ba27d", "#a24b8c", "#5c6ea8", "#8ca24b", "#b3613a", "#3aa0b3", "#96528a", "#6b8f3f", "#b3893a", "#547f9e", "#94443c"];

  // rank boost after we know kingdoms; determine kinds
  const currentYear = 1000 + Math.round(params.civilizationAge);
  for (const p of picked) {
    const x = p.i % W, y = Math.floor(p.i / W);
    const kid = kingdomTile[p.i];
    const b = t.biome[p.i] as Biome;
    let coastAdj = false, riverHere = t.riverTile[p.i] > 0, hillAdj = 0, mountAdj = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ax = x + dx, ay = y + dy;
        if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
        const bb = t.biome[ay * W + ax] as Biome;
        if (isWaterBiome(bb) && Math.abs(dx) + Math.abs(dy) <= 2) coastAdj = true;
        if (bb === Biome.Hills) hillAdj++;
        if (bb === Biome.Mountain || bb === Biome.SnowPeak) mountAdj++;
      }
    }
    let rank = rankOf.get(p.i) as SettlementRank;
    let kind: SettlementKind;
    if (coastAdj) kind = rank === "city" || rank === "town" ? "port" : "fishing";
    else if (riverHere) kind = "river";
    else if (mountAdj + hillAdj >= 6) kind = "mining";
    else if ((b === Biome.Swamp || b === Biome.Desert || b === Biome.Tundra || b === Biome.Taiga) && rank !== "city") kind = "frontier";
    else if (rank === "hamlet" || rank === "village") kind = "farming";
    else if (hillAdj >= 3 && rng.chance(0.35)) kind = "castle";
    else if (rng.chance(0.04)) kind = "religious";
    else kind = "market";

    void rank;
    const s: Settlement = {
      id: settlements.length,
      x, y,
      name: { text: "", lang: "", meaning: "" },
      rank,
      kind,
      kingdomId: kid,
      population: 0,
      founded: 0,
      founder: "",
      industries: [],
      exports: [],
      imports: [],
      wealth: 1,
      walled: false,
      tradeRoutes: 0,
      blurb: "",
      citySeed: 0,
    };
    settlements.push(s);
    byId.set(s.id, s);
    tileToSettlement.set(p.i, s);
    void mountAdj;
  }

  // assign capitals per realm = largest settlement by desirability
  const kingData: { scores: number[] }[] = kings.map(() => ({ scores: [] }));
  picked.forEach((p, idx) => {
    const kid = kingdomTile[p.i];
    if (kid >= 0 && kid < kingData.length) kingData[kid].scores.push(idx);
  });
  const capitalSettlement = new Map<number, number>(); // kingdomId -> settlementId
  kingData.forEach((kd, kid) => {
    const owner = kings[kid];
    // use settlement nearest capital tile by score
    let bestIdx = -1, bestVal = -Infinity;
    for (const idx of kd.scores) {
      const val = sortedByScore.length - idx; // earlier idx = better
      if (val > bestVal) { bestVal = val; bestIdx = idx; }
    }
    const chosenIdx = bestIdx >= 0 ? bestIdx : 0;
    const p = sortedByScore[chosenIdx] ?? picked[0];
    const st = tileToSettlement.get(p.i);
    if (st) capitalSettlement.set(kid, st.id);
    void owner;
  });
  // exactly one metropolis overall: the largest-realm capital
  let largestKid = 0, largestCount = -1;
  kingData.forEach((kd, kid) => { if (kd.scores.length > largestCount) { largestCount = kd.scores.length; largestKid = kid; } });

  capitalSettlement.forEach((sid, kid) => {
    const st = byId.get(sid);
    if (!st) return;
    st.rank = kid === largestKid ? "metropolis" : "capital";
  });

  const kingdoms: Kingdom[] = kings.map((owner, kid) => {
    const capTile = owner.capitalTile;
    const cx = capTile % W;
    const culture = kingdomOfX(cx);
    const { name, title } = nf.kingdomName(culture);
    const female = rng.chance(0.42);
    return {
      id: kid,
      name, title,
      color: paletteColors[kid % paletteColors.length],
      culture,
      capitalId: capitalSettlement.get(kid) ?? -1,
      ruler: nf.personName(culture),
      rulerTitle: nf.rulerTitle(culture, female),
      population: 0,
      area: 0,
      settlementCount: 0,
      island: owner.island,
    };
  });
  // realm census
  for (let i = 0; i < N; i++) {
    const kid = kingdomTile[i];
    if (kid >= 0 && kid < kingdoms.length && !isWaterBiome(t.biome[i] as Biome)) kingdoms[kid].area++;
  }

  // ---------- 6. names + economy + history ----------
  for (const s of settlements) {
    const kid = s.kingdomId;
    const culture = kid >= 0 && kingdoms[kid] ? kingdoms[kid].culture : kingdomOfX(s.x);
    s.name = nf.settlementName(culture, s.kind);
    s.citySeed = subSeed(params.seed, `city:${s.id}:${s.x * 31 + s.y}`);

    // rename capital to match kingdom? no — keep town name, kingdom gets own
    const localRiver = t.riverTile[s.y * W + s.x] > 0;
    const popBase: Record<SettlementRank, [number, number]> = {
      metropolis: [38000, 62000], capital: [13000, 26000], city: [7500, 18000],
      town: [2200, 7800], village: [320, 1250], hamlet: [70, 300],
    };
    const [lo, hi] = popBase[s.rank];
    let pop = rng.float(lo, hi) * (0.78 + Math.min(0.4, (picked[s.id]?.s ?? 1) * 0.05));
    if (localRiver) pop *= 1.12;
    if (s.kind === "port") pop *= 1.16;
    if (s.kind === "mining") pop *= 0.9;
    const caps: Record<SettlementRank, number> = {
      metropolis: 88000, capital: 34000, city: 24000, town: 9500, village: 1600, hamlet: 400,
    };
    pop = Math.min(pop, caps[s.rank]);
    s.population = Math.max(40, Math.round(pop / 10) * 10);

    const femaleF = rng.chance(0.4);
    s.founder = `${femaleF ? "Lady" : "Lord"} ${nf.personName(culture)}`;
    const age = Math.round(Math.pow(rng.next(), 1.6) * params.civilizationAge);
    s.founded = currentYear - Math.max(12, age);

    // industries & trade goods
    const ind = new Set<string>();
    const exp = new Set<string>();
    const near = (bb: Biome) => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const ax = s.x + dx, ay = s.y + dy;
        if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
        if (t.biome[ay * W + ax] === bb) return true;
      }
      return false;
    };
    switch (s.kind) {
      case "port": ind.add("Shipbuilding"); ind.add("Fish-curing"); ind.add("Ropewalks"); exp.add("Salt fish"); exp.add("Ships' stores"); break;
      case "fishing": ind.add("Fishing"); ind.add("Net-mending"); exp.add("Salt fish"); break;
      case "river": ind.add("Milling"); ind.add("River trade"); exp.add("Flour"); break;
      case "mining": ind.add("Iron mining"); ind.add("Smelting"); ind.add("Charcoal burning"); exp.add("Iron"); exp.add("Tools"); break;
      case "castle": ind.add("Garrison"); ind.add("Armoury"); exp.add("Military service"); break;
      case "religious": ind.add("Pilgrim trade"); ind.add("Scriptorium"); exp.add("Relics & candles"); break;
      case "frontier": ind.add("Fur trapping"); ind.add("Scouting"); exp.add("Furs"); break;
      case "market": ind.add("Cloth weaving"); ind.add("Brewing"); exp.add("Cloth"); break;
      default: ind.add("Grain farming"); exp.add("Grain");
    }
    if (near(Biome.TemperateForest) || near(Biome.Taiga)) { ind.add("Timber felling"); exp.add("Timber"); }
    if (near(Biome.Hills)) { ind.add("Shepherding"); exp.add("Wool"); }
    if (near(Biome.Grassland) && s.kind !== "farming") { exp.add(rng.chance(0.5) ? "Cattle" : "Horses"); }
    if (s.rank === "city" || s.rank === "capital" || s.rank === "metropolis") {
      ind.add("Guild crafts"); ind.add(rng.pick(["Dye works", "Tanning", "Glass-making", "Goldsmithing", "Printing"]));
    }
    s.industries = [...ind].slice(0, 4);
    s.exports = [...exp].slice(0, 3);
    const impPool = ["Salt", "Wine", "Silver", "Spices", "Silk cloth", "Fine steel", "Dyes", "Tar", "Amber", "Ivory"];
    s.imports = rng.shuffle(impPool.filter((g) => !s.exports.includes(g))).slice(0, 3);

    s.wealth = 1 + Math.min(4, Math.floor((s.population / 14000) + (s.kind === "port" ? 1 : 0) + rng.next() * 1.2));
    const baseWall = params.wallFrequency / 100;
    const walledChance =
      s.rank === "metropolis" || s.rank === "capital" ? 1 :
      s.rank === "city" ? Math.min(0.96, baseWall * 1.3) :
      s.rank === "town" ? baseWall * 0.6 : baseWall * 0.1;
    s.walled = rng.chance(walledChance);

    const features: string[] = [];
    if (localRiver) features.push("straddles a navigable river");
    if (s.kind === "port") features.push("commands a sheltered harbour");
    if (s.kind === "mining") features.push("sits athwart rich iron veins");
    if (s.kind === "castle") features.push("grew beneath the walls of its keep");
    if (!features.length) features.push(rng.pick(["rose where two drovers' tracks meet", "grew from a ring of homesteads", "commands the ford of an old road"]));
    const events = [
      `survived the Great Fire of ${s.founded + rng.int(40, 300)}`,
      `was stormed in the War of the ${rng.pick(["Red Banner", "Three Oaks", "Broken Crown", "Pale Tide", "Iron Tithe"])}`,
      `hosted the Council of ${nf.personName(culture).split(" ")[0]}`,
      `endured the ${rng.pick(["Grey", "Weeping", "Winter"])} Plague`,
      `was granted a royal charter in ${s.founded + rng.int(60, 400)}`,
    ];
    s.blurb = `${s.name.text} ${features[0]}. Founded c. ${s.founded} by ${s.founder}, it ${rng.pick(events)}. Its people are ${nf.personName(culture).length % 2 === 0 ? "thick-set, proud" : "hard, devout"} folk of ${s.name.lang} tongue.`;
  }

  // ---------- 7. roads (A*) + trade routes ----------
  const biomeCost = (b: Biome): number => {
    switch (b) {
      case Biome.Grassland: case Biome.Beach: return 1;
      case Biome.Savanna: return 1.25;
      case Biome.TemperateForest: case Biome.Taiga: return 1.8;
      case Biome.Tundra: return 1.7;
      case Biome.Desert: return 2;
      case Biome.Swamp: return 3.4;
      case Biome.Hills: return 2.4;
      case Biome.Mountain: return 10;
      case Biome.SnowPeak: return 40;
      case Biome.Glacier: return 24;
      default: return 100; // water blocked
    }
  };
  const astar = (from: number, to: number, maxExpand: number): { path: number[]; bridges: number[] } | null => {
    const W8 = W;
    const gx = to % W, gy = Math.floor(to / W);
    const open = new MinHeap();
    const gScore = new Map<number, number>();
    const came = new Map<number, number>();
    gScore.set(from, 0);
    open.push(from, 0);
    let expanded = 0;
    const bridges: number[] = [];
    while (open.size) {
      const cur = open.pop();
      if (cur === to) {
        const path: number[] = [cur];
        let c = cur;
        while (came.has(c)) { c = came.get(c) as number; path.push(c); }
        path.reverse();
        for (const p of path) if (t.riverTile[p] > 0) bridges.push(p);
        return { path, bridges };
      }
      if (++expanded > maxExpand) return null;
      const cx = cur % W, cy = Math.floor(cur / W);
      const g0 = gScore.get(cur) as number;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const ax = cx + dx, ay = cy + dy;
          if (ax < 0 || ay < 0 || ax >= W8 || ay >= H) continue;
          const j = ay * W + ax;
          const bc = biomeCost(t.biome[j] as Biome);
          if (bc >= 100) continue;
          let step = bc * (dx && dy ? 1.41 : 1);
          step += Math.abs(t.elevation[j] - t.elevation[cur]) * 7;
          if (t.riverTile[j] > 0) step += 16;
          const ng = g0 + step;
          if (ng < (gScore.get(j) ?? Infinity)) {
            gScore.set(j, ng);
            came.set(j, cur);
            const h = Math.hypot(gx - ax, gy - ay) * 1.001;
            open.push(j, ng + h);
          }
        }
      }
    }
    return null;
  };

  const roads: RoadEdge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (a: Settlement, b: Settlement, trade: boolean) => {
    const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
    if (edgeKeys.has(key)) return;
    const res = astar(a.y * W + a.x, b.y * W + b.x, 60000);
    if (!res || res.path.length < 3) return;
    edgeKeys.add(key);
    roads.push({ id: roads.length, a: a.id, b: b.id, path: res.path, trade, bridges: res.bridges });
  };

  // per realm: connect settlements to network
  const byKingdom = new Map<number, Settlement[]>();
  for (const s of settlements) {
    if (s.kingdomId < 0) continue;
    const arr = byKingdom.get(s.kingdomId) ?? [];
    arr.push(s);
    byKingdom.set(s.kingdomId, arr);
  }
  byKingdom.forEach((list) => {
    list.sort((p, q) => q.population - p.population);
    const connected: Settlement[] = [];
    for (const s of list) {
      if (!connected.length) { connected.push(s); continue; }
      let best: Settlement | null = null, bd = Infinity;
      for (const c of connected) {
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) addEdge(s, best, false);
      connected.push(s);
    }
    // ring redundancy
    for (const s of list) {
      if (rng.chance(params.tradeIntensity / 220)) {
        const near2 = list.filter((o) => o.id !== s.id).sort((p, q) => Math.hypot(p.x - s.x, p.y - s.y) - Math.hypot(q.x - s.x, q.y - s.y))[1];
        if (near2) addEdge(s, near2, true);
      }
    }
  });
  // cross-realm trade routes between large cities and ports
  const hubs = settlements.filter((s) => s.rank === "metropolis" || s.rank === "capital" || s.rank === "city" || (s.kind === "port" && s.rank === "town"));
  const hubPairs = Math.round(hubs.length * (0.3 + params.tradeIntensity / 90));
  const shuffledHubs = rng.shuffle([...hubs]);
  outer2: for (const a of shuffledHubs) {
    if (roads.filter((r) => r.trade).length >= hubPairs) break;
    const foreign = hubs.filter((b) => b.kingdomId !== a.kingdomId)
      .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    if (foreign && Math.hypot(foreign.x - a.x, foreign.y - a.y) < W * 0.5) addEdge(a, foreign, true);
    else continue outer2;
  }

  // trade route counts + wealth bump
  const routeCount = new Map<number, number>();
  for (const r of roads) {
    routeCount.set(r.a, (routeCount.get(r.a) ?? 0) + 1);
    routeCount.set(r.b, (routeCount.get(r.b) ?? 0) + 1);
  }
  for (const s of settlements) {
    s.tradeRoutes = routeCount.get(s.id) ?? 0;
    if (s.tradeRoutes >= 4 && s.wealth < 5) s.wealth++;
  }

  // realm populations
  let urbanPopulation = 0;
  for (const s of settlements) {
    urbanPopulation += s.population;
    const kid = s.kingdomId;
    if (kid >= 0 && kingdoms[kid]) {
      kingdoms[kid].population += s.population;
      kingdoms[kid].settlementCount++;
    }
  }
  for (const k of kingdoms) {
    k.population += Math.round(k.area * 22); // rural folk
  }

  // ---------- 8. border segments ----------
  const bseg: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ki = kingdomTile[i];
      if (x + 1 < W) {
        const kr = kingdomTile[i + 1];
        if (ki !== kr && ki >= 0 && kr >= 0) bseg.push(x + 1, y, x + 1, y + 1);
      }
      if (y + 1 < H) {
        const kd = kingdomTile[i + W];
        if (ki !== kd && ki >= 0 && kd >= 0) bseg.push(x, y + 1, x + 1, y + 1);
      }
    }
  }
  void byId;
  return {
    settlements,
    kingdoms,
    roads,
    kingdomTile,
    borderSegs: Float32Array.from(bseg),
    urbanPopulation,
  };
}
