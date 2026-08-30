// Procedural medieval city generator.
// Each settlement owns a deterministic citySeed; the plan synthesizes walls,
// gates, organic street webs, districts and individual buildings from the
// settlement's rank, kind, population and culture.

import { Rng } from "./rng";
import { NameFactory, makeNameFactory } from "./names";
import type {
  BuildingType, CityBuilding, CityPlan, CityStreet, CultureId,
  DistrictType, Named, Pt, Settlement, SettlementRank,
} from "./types";

const TAU = Math.PI * 2;

function dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
  const t = c1 / c2;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) return points.slice();
  const pts = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function shrinkHull(hull: Pt[], f: number): Pt[] {
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f }));
}

interface DistrictSeed { type: DistrictType; x: number; y: number; w: number }

function buildingWeights(district: DistrictType, rank: SettlementRank): [BuildingType, number][] {
  switch (district) {
    case "market": return [["house", 0.40], ["shop", 0.30], ["tavern", 0.08], ["inn", 0.07], ["bakery", 0.07], ["granary", 0.08]];
    case "harbor": return [["warehouse", 0.34], ["house", 0.30], ["tavern", 0.12], ["inn", 0.10], ["stable", 0.08], ["shop", 0.06]];
    case "warehouse": return [["warehouse", 0.52], ["house", 0.30], ["stable", 0.18]];
    case "artisan": return [["workshop", 0.28], ["house", 0.42], ["smithy", 0.12], ["bakery", 0.10], ["tannery", 0.08]];
    case "noble": return [["mansion", 0.5], ["house", 0.38], ["chapel", 0.07], ["stable", 0.05]];
    case "religious": return [["house", 0.62], ["chapel", 0.13], ["shop", 0.15], ["inn", 0.10]];
    case "poor": return [["house", 0.76], ["tavern", 0.10], ["tannery", 0.07], ["stable", 0.07]];
    case "castle": return [["house", 0.46], ["granary", 0.16], ["stable", 0.12], ["workshop", 0.12], ["tavern", 0.14]];
    case "military": return [["house", 0.55], ["stable", 0.17], ["smithy", 0.12], ["granary", 0.16]];
    default:
      return rank === "metropolis" || rank === "capital"
        ? [["house", 0.72], ["shop", 0.14], ["bakery", 0.06], ["workshop", 0.08]]
        : [["house", 0.84], ["bakery", 0.06], ["shop", 0.10]];
  }
}

export function generateCityPlan(s: Settlement, culture: CultureId): CityPlan {
  const rng = new Rng(s.citySeed);
  const nf = makeNameFactory(s.citySeed, `citynames:${s.id}`);
  void culture;

  const pop = s.population;
  const R = Math.max(64, Math.min(430, 52 + Math.sqrt(pop) * 1.08));
  const isPort = s.kind === "port";
  const hasCastle = s.kind === "castle" || s.rank === "capital" || s.rank === "metropolis" || (s.kind === "religious" && rng.chance(0.4));
  const coastAngle = isPort ? rng.float(0, TAU) : null;

  // ---------- city wall(s) ----------
  const nV = 26;
  let radii: number[] = [];
  for (let i = 0; i < nV; i++) radii.push(rng.float(0.86, 1.15));
  for (let pass = 0; pass < 3; pass++) {
    radii = radii.map((r, i) => (radii[(i - 1 + nV) % nV] + r * 2 + radii[(i + 1) % nV]) / 4);
  }
  if (coastAngle !== null) {
    // pull the seaward arc inland to form a harbour basin
    for (let i = 0; i < nV; i++) {
      const ang = (i / nV) * TAU;
      let d = Math.abs(((ang - coastAngle + Math.PI * 3) % TAU) - Math.PI);
      if (d < 1.05) radii[i] *= 0.5 + (d / 1.05) * 0.28;
    }
  }
  const wallPt = (ang: number, scale = 1): Pt => {
    const f = ((ang % TAU) + TAU) % TAU / TAU * nV;
    const i0 = Math.floor(f) % nV;
    const i1 = (i0 + 1) % nV;
    const t = f - Math.floor(f);
    const r = (radii[i0] * (1 - t) + radii[i1] * t) * R * scale;
    return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
  };
  const walls: Pt[][] = [];
  const walled = s.walled || hasCastle;
  if (walled) {
    const outer: Pt[] = [];
    for (let i = 0; i < nV; i++) outer.push(wallPt((i / nV) * TAU));
    walls.push(outer);
    if (s.rank === "metropolis" || (s.rank === "capital" && rng.chance(0.75))) {
      const inner: Pt[] = [];
      for (let i = 0; i < nV; i++) {
        const p = wallPt((i / nV) * TAU, 0.58);
        inner.push({ x: p.x + rng.float(-4, 4), y: p.y + rng.float(-4, 4) });
      }
      walls.push(inner);
    }
  }
  const wallTowers: Pt[] = [];
  if (walled) {
    for (let i = 0; i < nV; i += 3) {
      const p = wallPt((i / nV) * TAU);
      wallTowers.push(p);
    }
  }

  // ---------- gates ----------
  const gates: { x: number; y: number; angle: number; name: Named }[] = [];
  const nGates = Math.max(3, Math.min(6, 2 + Math.round(R / 110)));
  const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
  for (let g = 0; g < nGates; g++) {
    let ang = (g / nGates) * TAU + rng.float(-0.22, 0.22);
    if (coastAngle !== null) {
      let d = Math.abs(((ang - coastAngle + Math.PI * 3) % TAU) - Math.PI);
      if (d < 1.1) ang = coastAngle + 1.1 * Math.sign(((ang - coastAngle + Math.PI * 3) % TAU) - Math.PI || 1);
    }
    const p = wallPt(ang, walled ? 1 : 0.94);
    gates.push({ x: p.x, y: p.y, angle: ang, name: nf.gateName("nordheim", ordinals[g] ?? "Outer") });
  }

  // ---------- streets ----------
  const streets: CityStreet[] = [];
  const mainLines: Pt[][] = [];
  const center = { x: rng.float(-8, 8), y: rng.float(-8, 8) };
  for (const g of gates) {
    const pts: Pt[] = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jx = rng.float(-R * 0.05, R * 0.05);
      const jy = rng.float(-R * 0.05, R * 0.05);
      pts.push({
        x: g.x + (center.x - g.x) * t + (i > 0 && i < steps ? jx : 0),
        y: g.y + (center.y - g.y) * t + (i > 0 && i < steps ? jy : 0),
      });
    }
    mainLines.push(pts);
    for (let i = 0; i < pts.length - 1; i++) {
      streets.push({ ax: pts[i].x, ay: pts[i].y, bx: pts[i + 1].x, by: pts[i + 1].y, w: 2 });
    }
  }
  // ring street
  const ringR = 0.56 + rng.float(-0.05, 0.05);
  const ringPts: Pt[] = [];
  const nRing = 26;
  let ringWobble: number[] = [];
  for (let i = 0; i < nRing; i++) ringWobble.push(rng.float(-0.07, 0.07));
  for (let pass = 0; pass < 2; pass++) {
    ringWobble = ringWobble.map((r, i) => (ringWobble[(i - 1 + nRing) % nRing] + r * 2 + ringWobble[(i + 1) % nRing]) / 4);
  }
  for (let i = 0; i <= nRing; i++) {
    const ang = (i / nRing) * TAU;
    const rr = R * (ringR + ringWobble[i % nRing]);
    ringPts.push({ x: center.x + Math.cos(ang) * rr, y: center.y + Math.sin(ang) * rr });
  }
  for (let i = 0; i < ringPts.length - 1; i++) {
    streets.push({ ax: ringPts[i].x, ay: ringPts[i].y, bx: ringPts[i + 1].x, by: ringPts[i + 1].y, w: 1 });
  }
  // branches off main roads
  const squares: { x: number; y: number; r: number }[] = [];
  squares.push({ x: center.x, y: center.y, r: rng.float(12, 20) });
  for (const line of mainLines) {
    for (let b = 0; b < 3; b++) {
      const at = rng.int(1, line.length - 2);
      const p0 = line[at];
      const prev = line[at - 1] ?? center;
      const dirAng = Math.atan2(p0.y - prev.y, p0.x - prev.x) + rng.pick([1, -1]) * rng.float(0.9, 2.0);
      const len = rng.float(0.2, 0.46) * R;
      const p1 = { x: p0.x + Math.cos(dirAng) * len * 0.55, y: p0.y + Math.sin(dirAng) * len * 0.55 };
      const p2 = { x: p1.x + Math.cos(dirAng + rng.float(-0.7, 0.7)) * len * 0.5, y: p1.y + Math.sin(dirAng + rng.float(-0.7, 0.7)) * len * 0.5 };
      streets.push({ ax: p0.x, ay: p0.y, bx: p1.x, by: p1.y, w: 1 });
      streets.push({ ax: p1.x, ay: p1.y, bx: p2.x, by: p2.y, w: 0 });
      if (rng.chance(0.5)) squares.push({ x: p1.x, y: p1.y, r: rng.float(8, 15) });
    }
  }
  // organic alley crawl
  const nCrawl = Math.round(R / 8);
  const insideWall = (p: Pt, margin = 6): boolean => {
    const ang = Math.atan2(p.y, p.x);
    const w = wallPt(ang);
    return Math.hypot(p.x, p.y) < Math.hypot(w.x, w.y) - margin;
  };
  for (let c = 0; c < nCrawl; c++) {
    const seedSeg = streets[rng.int(0, streets.length - 1)];
    const t = rng.next();
    let p = { x: seedSeg.ax + (seedSeg.bx - seedSeg.ax) * t, y: seedSeg.ay + (seedSeg.by - seedSeg.ay) * t };
    let ang = rng.float(0, TAU);
    const steps = rng.int(3, 7);
    for (let i = 0; i < steps; i++) {
      ang += rng.float(-0.65, 0.65);
      const len = rng.float(9, 18);
      const q = { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
      if (!insideWall(q, 5)) break;
      streets.push({ ax: p.x, ay: p.y, bx: q.x, by: q.y, w: 0 });
      p = q;
    }
  }

  // ---------- river ----------
  let river: Pt[] | null = null;
  if (s.kind === "river") {
    const ang = rng.float(0, TAU);
    const nR = 10;
    river = [];
    for (let i = 0; i <= nR; i++) {
      const t = i / nR;
      const lin = { x: Math.cos(ang) * (t * 2 - 1) * R * 1.5, y: Math.sin(ang) * (t * 2 - 1) * R * 1.5 };
      const off = Math.sin(t * Math.PI) * rng.float(-0.3, 0.3) * R;
      river.push({ x: lin.x - Math.sin(ang) * off * 0.4, y: lin.y + Math.cos(ang) * off * 0.4 });
    }
  }

  // ---------- districts ----------
  const seeds: DistrictSeed[] = [];
  const addSeed = (type: DistrictType, ang: number, r: number, w = 1) => {
    seeds.push({ type, x: center.x + Math.cos(ang) * r, y: center.y + Math.sin(ang) * r, w });
  };
  addSeed("market", rng.float(0, TAU), 0, 1.4);
  const castleAngle = rng.float(0, TAU);
  if (hasCastle) {
    addSeed("castle", castleAngle, R * 0.5, 1.2);
    addSeed("military", castleAngle + rng.float(0.5, 0.9), R * 0.55, 0.9);
    addSeed("noble", castleAngle + rng.float(-1.2, 1.2), R * 0.42, 0.9);
  }
  if (s.kind === "religious" || s.rank === "metropolis" || s.rank === "capital" || rng.chance(0.5)) {
    addSeed("religious", rng.float(0, TAU), R * 0.3, 1);
  }
  if (isPort && coastAngle !== null) {
    addSeed("harbor", coastAngle, R * 0.62, 1.3);
    addSeed("warehouse", coastAngle, R * 0.4, 0.9);
  }
  if (s.kind === "mining") addSeed("artisan", rng.float(0, TAU), R * 0.3, 1.1);
  addSeed("artisan", rng.float(0, TAU), R * 0.5, 1);
  const poorAngle = rng.float(0, TAU);
  addSeed("poor", poorAngle, R * 0.68, 1.1);
  const nRes = 2 + (s.rank === "metropolis" || s.rank === "capital" ? 1 : 0);
  for (let i = 0; i < nRes; i++) addSeed("residential", rng.float(0, TAU), R * rng.float(0.3, 0.6), 1);
  if (s.population > 25000 && !hasCastle) addSeed("noble", rng.float(0, TAU), R * 0.45, 0.8);

  const districtOf = (p: Pt): DistrictType => {
    let best: DistrictSeed = seeds[0];
    let bd = Infinity;
    for (const sd of seeds) {
      const d = Math.hypot(p.x - sd.x, p.y - sd.y) / sd.w;
      if (d < bd) { bd = d; best = sd; }
    }
    return best.type;
  };

  // ---------- landmarks ----------
  const landmarks: CityPlan["landmarks"] = [];
  let lmId = 0;
  if (hasCastle) {
    const cp = seeds.find((x) => x.type === "castle") ?? seeds[0];
    const a = rng.float(0, TAU);
    const sz = Math.max(14, Math.min(30, R * 0.09));
    const ca = Math.cos(a), sa = Math.sin(a);
    const corners: Pt[] = [[-1, -0.7], [1, -0.7], [1, 0.7], [-1, 0.7]].map(([ux, uy]) => ({
      x: cp.x + (ux * sz) * ca - (uy * sz) * sa,
      y: cp.y + (ux * sz) * sa + (uy * sz) * ca,
    }));
    landmarks.push({ id: lmId++, type: "keep", x: cp.x, y: cp.y, angle: a, poly: corners, name: { text: `${s.name.text} Keep`, lang: s.name.lang, meaning: "seat of the city's lord" } });
  }
  const relSeed = seeds.find((x) => x.type === "religious");
  if (relSeed && (s.rank === "metropolis" || s.rank === "capital" || s.kind === "religious" || s.rank === "city")) {
    const saints = ["Aldric", "Maren", "Oswin", "Cedd", "Helga", "Bricius", "Tomas", "Eyda", "Ruan", "Sighvat"];
    const nm = s.rank === "metropolis" || s.rank === "capital" ? "Cathedral" : s.kind === "religious" ? "Abbey" : "Minster";
    landmarks.push({ id: lmId++, type: "cathedral", x: relSeed.x + rng.float(-20, 20), y: relSeed.y + rng.float(-20, 20), angle: rng.float(0, TAU), name: { text: `${nm} of St. ${rng.pick(saints)}`, lang: s.name.lang, meaning: "the city's principal shrine" } });
  }
  if (s.rank !== "hamlet" && s.rank !== "village") {
    landmarks.push({ id: lmId++, type: "townhall", x: center.x + rng.float(-14, 14), y: center.y + rng.float(-14, 14), angle: rng.float(0, TAU), name: { text: rng.pick(["Guildhall", "Town Hall", "Hall of the Charter"]), lang: s.name.lang, meaning: "seat of the burghers" } });
  }
  if (isPort && coastAngle !== null) {
    const hp = seeds.find((x) => x.type === "harbor");
    landmarks.push({ id: lmId++, type: "docks", x: hp ? hp.x : Math.cos(coastAngle) * R * 0.8, y: hp ? hp.y : Math.sin(coastAngle) * R * 0.8, angle: coastAngle, name: { text: "The Quays", lang: s.name.lang, meaning: "wharves and moles of the harbour" } });
  }
  if (s.kind === "mining") {
    const g = gates[rng.int(0, gates.length - 1)];
    landmarks.push({ id: lmId++, type: "mine", x: g.x * 1.22, y: g.y * 1.22, angle: g.angle, name: { text: `${s.name.text} Pits`, lang: s.name.lang, meaning: "worked iron and stone outside the wall" } });
  }
  for (const g of gates) {
    landmarks.push({ id: lmId++, type: "gate", x: g.x, y: g.y, angle: g.angle, name: g.name });
  }

  // ---------- buildings ----------
  const buildings: CityBuilding[] = [];
  const target = Math.max(110, Math.min(1500, Math.round(pop / 30)));
  const occupied = new Set<string>();
  const occKey = (x: number, y: number) => `${Math.round(x / 5)}:${Math.round(y / 5)}`;
  let bid = 0;
  let guard = 0;
  const weights = (d: DistrictType) => buildingWeights(d, s.rank);
  while (buildings.length < target && guard++ < target * 30) {
    const seg = streets[rng.int(0, streets.length - 1)];
    const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
    if (len < 8) continue;
    const side = rng.pick([1, -1]);
    const t = rng.float(0.05, 0.95);
    const cx = seg.ax + (seg.bx - seg.ax) * t;
    const cy = seg.ay + (seg.by - seg.ay) * t;
    const dx = (seg.bx - seg.ax) / len;
    const dy = (seg.by - seg.ay) / len;
    const nx = -dy * side, ny = dx * side;
    const mid = { x: cx, y: cy };
    const district = districtOf(mid);
    const type = rng.weighted(weights(district));
    const big = type === "mansion" || type === "warehouse" || type === "granary";
    const small = district === "poor";
    const w = small ? rng.float(4, 7) : big ? rng.float(10, 16) : rng.float(5, 11);
    const d = small ? rng.float(4, 6.5) : big ? rng.float(9, 13) : rng.float(5, 10);
    const setBack = seg.w === 2 ? 3.2 : seg.w === 1 ? 2.4 : 1.7;
    const px = cx + nx * (setBack + d / 2);
    const py = cy + ny * (setBack + d / 2);
    const bp = { x: px, y: py };
    if (!insideWall(bp, 4)) continue;
    let ok = true;
    for (const sq of squares) if (dist(bp, sq) < sq.r + 2) { ok = false; break; }
    if (!ok) continue;
    if (river) {
      for (let ri = 0; ri < river.length - 1; ri++) {
        if (distToSeg(bp, river[ri], river[ri + 1]) < 10) { ok = false; break; }
      }
      if (!ok) continue;
    }
    for (const lm of landmarks) {
      if (lm.type === "keep" || lm.type === "cathedral" || lm.type === "townhall") {
        if (dist(bp, lm) < 17) { ok = false; break; }
      }
    }
    if (!ok) continue;
    if (occupied.has(occKey(px, py))) continue;
    occupied.add(occKey(px, py));
    const ang = Math.atan2(dy, dx);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const poly: Pt[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
      .map(([ux, uy]) => ({ x: px + ux * ca - uy * sa, y: py + ux * sa + uy * ca }));
    const b: CityBuilding = { id: bid++, poly, type, district };
    if (type === "tavern" || type === "inn") b.name = nf.tavernName();
    if (type === "smithy" && rng.chance(0.7)) b.name = `${s.name.text} Smithy`;
    buildings.push(b);
  }

  // ---------- district hulls for tinted wards ----------
  const byDistrict = new Map<DistrictType, Pt[]>();
  for (const b of buildings) {
    const cxp = b.poly.reduce((acc, p) => acc + p.x, 0) / 4;
    const cyp = b.poly.reduce((acc, p) => acc + p.y, 0) / 4;
    const arr = byDistrict.get(b.district) ?? [];
    arr.push({ x: cxp, y: cyp });
    byDistrict.set(b.district, arr);
  }
  const districts = [...byDistrict.entries()]
    .filter(([, pts]) => pts.length >= 14)
    .map(([type, pts]) => ({ type, hull: shrinkHull(convexHull(pts), 0.86) }));

  // ---------- named main streets ----------
  const namedStreets = mainLines.slice(0, Math.min(4, mainLines.length)).map((line) => {
    const a = line[Math.floor(line.length * 0.3)];
    const b = line[Math.min(line.length - 1, Math.floor(line.length * 0.3) + 1)];
    return {
      name: nf.streetName("nordheim"),
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  });

  return {
    settlementId: s.id,
    radius: R,
    walls, wallTowers, gates,
    streets, buildings, districts, landmarks, squares,
    river, coastAngle, namedStreets,
  };
}
