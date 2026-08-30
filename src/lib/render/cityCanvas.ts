// City plan renderer: districts, organic streets, walls, gates, individual
// buildings and landmarks drawn in an engraved-plot style.

import {
  DISTRICT_LABEL, type BuildingType, type CityBuilding, type CityLandmark,
  type CityPlan, type Selection,
} from "@/lib/world/types";
import type { View } from "./worldCanvas";

const PAL = {
  parchment: "#e2d3a8",
  parchmentDeep: "#d8c794",
  water: "#a9bfa8",
  waterInk: "#6d8577",
  streetCasing: "#a68d60",
  streetFill: "#efe4c3",
  laneFill: "#ecdfc0",
  square: "#e9dcba",
  wall: "#4a3b28",
  wallInner: "#5d4c36",
  ink: "#33261a",
  roof: {
    house: "#cbb289",
    mansion: "#ddd0b2",
    shop: "#ccab74",
    workshop: "#b99868",
    smithy: "#8d7d70",
    bakery: "#d8bc7e",
    tannery: "#a48c5e",
    warehouse: "#b08055",
    inn: "#c99263",
    tavern: "#bd7550",
    stable: "#a2905c",
    granary: "#d3a95f",
    chapel: "#b9b4a4",
  } as Record<BuildingType, string>,
  district: {
    market: "rgba(201,164,110,0.28)",
    castle: "rgba(120,110,120,0.22)",
    noble: "rgba(190,170,210,0.20)",
    religious: "rgba(214,204,168,0.30)",
    harbor: "rgba(140,170,158,0.26)",
    warehouse: "rgba(176,128,85,0.22)",
    artisan: "rgba(185,152,104,0.22)",
    residential: "rgba(203,178,137,0.14)",
    military: "rgba(160,120,100,0.20)",
    poor: "rgba(140,120,90,0.22)",
  } as Record<string, string>,
};

export function drawCityScene(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  plan: CityPlan,
  view: View,
  selection: Selection,
  settlementName: string,
): void {
  const toSX = (wx: number) => (wx - view.cx) * view.scale + cw / 2;
  const toSY = (wy: number) => (wy - view.cy) * view.scale + ch / 2;
  const S = view.scale; // px per meter

  ctx.fillStyle = "#241d12";
  ctx.fillRect(0, 0, cw, ch);

  const R = plan.radius;

  // ground
  ctx.fillStyle = PAL.parchment;
  ctx.fillRect(toSX(-R * 2.4), toSY(-R * 2.4), R * 4.8 * S, R * 4.8 * S);
  // subtle radial darken outside walls
  ctx.save();
  ctx.beginPath();
  ctx.rect(toSX(-R * 2.4), toSY(-R * 2.4), R * 4.8 * S, R * 4.8 * S);
  if (plan.walls[0]) {
    const w0 = plan.walls[0];
    ctx.moveTo(toSX(w0[0].x), toSY(w0[0].y));
    for (let i = 1; i <= w0.length; i++) {
      const p = w0[i % w0.length];
      ctx.lineTo(toSX(p.x), toSY(p.y));
    }
  }
  ctx.fillStyle = PAL.parchmentDeep;
  ctx.globalAlpha = 0.65;
  ctx.fill("evenodd");
  ctx.restore();
  ctx.globalAlpha = 1;

  // harbor water
  if (plan.coastAngle !== null) {
    const ca = plan.coastAngle;
    const cx = Math.cos(ca) * R * 1.35;
    const cy = Math.sin(ca) * R * 1.35;
    ctx.beginPath();
    ctx.arc(toSX(cx), toSY(cy), R * 1.05 * S, 0, Math.PI * 2);
    ctx.fillStyle = PAL.water;
    ctx.fill();
    ctx.strokeStyle = PAL.waterInk;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // farmland scatter outside
  ctx.save();
  ctx.strokeStyle = "rgba(130,105,64,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.13 * i;
    const rr = R * (1.12 + (i % 5) * 0.08);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (plan.coastAngle !== null) {
      let d = Math.abs(((a - plan.coastAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < 1.1) continue;
    }
    const w = 14 + (i % 4) * 7;
    ctx.strokeRect(toSX(px - w / 2), toSY(py - w / 3), w * S, (w * 0.66) * S);
  }
  ctx.restore();

  // river
  if (plan.river) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    plan.river.forEach((p, i) => (i === 0 ? ctx.moveTo(toSX(p.x), toSY(p.y)) : ctx.lineTo(toSX(p.x), toSY(p.y))));
    ctx.strokeStyle = PAL.waterInk;
    ctx.lineWidth = Math.max(2, 17 * S);
    ctx.stroke();
    ctx.strokeStyle = PAL.water;
    ctx.lineWidth = Math.max(1.4, 14 * S);
    ctx.stroke();
  }

  // districts tint
  for (const d of plan.districts) {
    if (d.hull.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(toSX(d.hull[0].x), toSY(d.hull[0].y));
    for (let i = 1; i < d.hull.length; i++) ctx.lineTo(toSX(d.hull[i].x), toSY(d.hull[i].y));
    ctx.closePath();
    ctx.fillStyle = PAL.district[d.type];
    ctx.fill();
  }

  // squares & plazas
  for (const sq of plan.squares) {
    ctx.beginPath();
    ctx.ellipse(toSX(sq.x), toSY(sq.y), sq.r * S, sq.r * 0.8 * S, 0, 0, Math.PI * 2);
    ctx.fillStyle = PAL.square;
    ctx.fill();
    ctx.strokeStyle = "rgba(120,95,58,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // streets
  const drawStreetPass = (casing: boolean) => {
    for (const s of plan.streets) {
      const mw = (s.w === 2 ? 5.2 : s.w === 1 ? 3.2 : 1.9) + (casing ? 1.5 : 0);
      ctx.strokeStyle = casing ? PAL.streetCasing : s.w === 0 ? PAL.laneFill : PAL.streetFill;
      ctx.lineWidth = Math.max(casing ? 0.8 : 0.5, mw * S);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(toSX(s.ax), toSY(s.ay));
      ctx.lineTo(toSX(s.bx), toSY(s.by));
      ctx.stroke();
    }
  };
  drawStreetPass(true);
  drawStreetPass(false);

  // buildings
  const showBuildings = S > 0.28;
  if (showBuildings) {
    for (const b of plan.buildings) {
      ctx.beginPath();
      ctx.moveTo(toSX(b.poly[0].x), toSY(b.poly[0].y));
      for (let i = 1; i < b.poly.length; i++) ctx.lineTo(toSX(b.poly[i].x), toSY(b.poly[i].y));
      ctx.closePath();
      ctx.fillStyle = PAL.roof[b.type];
      ctx.fill();
      if (S > 0.75) {
        ctx.strokeStyle = "rgba(74,56,34,0.55)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      const sel = selection?.kind === "building" && selection.id === b.id;
      if (sel) {
        ctx.strokeStyle = "#c8391f";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // walls
  plan.walls.forEach((wall, wi) => {
    ctx.beginPath();
    ctx.moveTo(toSX(wall[0].x), toSY(wall[0].y));
    for (let i = 1; i <= wall.length; i++) {
      const p = wall[i % wall.length];
      ctx.lineTo(toSX(p.x), toSY(p.y));
    }
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.strokeStyle = wi === 0 ? PAL.wall : PAL.wallInner;
    ctx.lineWidth = Math.max(1.2, (wi === 0 ? 4.6 : 3.2) * S);
    ctx.stroke();
  });
  // towers
  for (const t of plan.wallTowers) {
    const s2 = Math.max(1.6, 4.4 * S);
    ctx.fillStyle = PAL.wall;
    ctx.fillRect(toSX(t.x) - s2 / 2, toSY(t.y) - s2 / 2, s2, s2);
  }
  // gates
  for (const g of plan.gates) {
    const gx = toSX(g.x), gy = toSY(g.y);
    ctx.beginPath();
    ctx.arc(gx, gy, Math.max(2.4, 5.4 * S), 0, Math.PI * 2);
    ctx.fillStyle = PAL.streetFill;
    ctx.fill();
    ctx.strokeStyle = PAL.wall;
    ctx.lineWidth = Math.max(1, 1.6 * S);
    ctx.stroke();
    const sel = selection?.kind === "landmark" && plan.landmarks.some((l) => l.type === "gate" && l.x === g.x && selection.id === l.id);
    if (sel) {
      ctx.strokeStyle = "#c8391f";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // landmarks
  for (const lm of plan.landmarks) {
    const px = toSX(lm.x), py = toSY(lm.y);
    const sel = selection?.kind === "landmark" && selection.id === lm.id;
    if (lm.type === "keep" && lm.poly) {
      ctx.beginPath();
      ctx.moveTo(toSX(lm.poly[0].x), toSY(lm.poly[0].y));
      for (let i = 1; i < lm.poly.length; i++) ctx.lineTo(toSX(lm.poly[i].x), toSY(lm.poly[i].y));
      ctx.closePath();
      ctx.fillStyle = "#54432e";
      ctx.fill();
      ctx.strokeStyle = "#241a10";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = "#e2d3a8";
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 4 * S, py - 4 * S, 8 * S, 8 * S);
    } else if (lm.type === "cathedral") {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(lm.angle);
      ctx.fillStyle = "#6b6154";
      ctx.fillRect(-13 * S, -5 * S, 26 * S, 10 * S);
      ctx.fillRect(-5 * S, -11 * S, 10 * S, 22 * S);
      ctx.strokeStyle = "#241a10";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-13 * S, -5 * S, 26 * S, 10 * S);
      ctx.restore();
    } else if (lm.type === "townhall") {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(lm.angle);
      ctx.fillStyle = "#74583c";
      ctx.fillRect(-11 * S, -6 * S, 22 * S, 12 * S);
      ctx.strokeStyle = "#241a10";
      ctx.strokeRect(-11 * S, -6 * S, 22 * S, 12 * S);
      ctx.restore();
    } else if (lm.type === "docks") {
      ctx.strokeStyle = "#4a3b28";
      for (let i = -2; i <= 2; i++) {
        const a = lm.angle + i * 0.22;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * 4 * S, py + Math.sin(a) * 4 * S);
        ctx.lineTo(px + Math.cos(a) * 30 * S, py + Math.sin(a) * 30 * S);
        ctx.lineWidth = Math.max(1, 2.6 * S);
        ctx.stroke();
      }
    } else if (lm.type === "mine") {
      ctx.fillStyle = "#54432e";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(px + (i - 1) * 8 * S, py + (i % 2) * 6 * S, Math.max(1.6, 3.4 * S), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (sel) {
      ctx.beginPath();
      ctx.strokeStyle = "#c8391f";
      ctx.lineWidth = 2;
      ctx.arc(px, py, Math.max(8, 16 * S), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // labels
  ctx.textAlign = "center";
  const drawText = (text: string, px: number, py: number, size: number, color: string, italic = false) => {
    ctx.font = `${italic ? "italic " : ""}${size}px "EB Garamond", Georgia, serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(226,211,168,0.85)";
    ctx.strokeText(text, px, py);
    ctx.fillStyle = color;
    ctx.fillText(text, px, py);
  };
  if (S > 0.32) {
    for (const d of plan.districts) {
      const cx = d.hull.reduce((a, p) => a + p.x, 0) / d.hull.length;
      const cy = d.hull.reduce((a, p) => a + p.y, 0) / d.hull.length;
      drawText(DISTRICT_LABEL[d.type].toUpperCase(), toSX(cx), toSY(cy), Math.max(9, Math.min(14, R * 0.034 * S + 7)), "rgba(60,44,28,0.6)", true);
    }
  }
  if (S > 0.5) {
    for (const lm of plan.landmarks) {
      if (lm.type === "gate" && S < 1.15) continue;
      drawText(lm.name?.text ?? "", toSX(lm.x), toSY(lm.y) - Math.max(8, 15 * S), 11, PAL.ink);
    }
    for (const ns of plan.namedStreets) {
      if (S < 1.0) break;
      ctx.save();
      ctx.translate(toSX(ns.x), toSY(ns.y));
      ctx.rotate(ns.angle);
      ctx.font = `italic 9.5px "EB Garamond", Georgia, serif`;
      ctx.fillStyle = "rgba(80,60,38,0.75)";
      ctx.fillText(ns.name.text, 0, -3);
      ctx.restore();
    }
  }
  if (S <= 0.32) {
    drawText(settlementName.toUpperCase(), cw / 2, ch / 2 - R * S - 26, 17, PAL.ink);
  }
}

export function nearestBuilding(plan: CityPlan, wx: number, wy: number, S: number): CityBuilding | null {
  const tol = 7 / S;
  let best: CityBuilding | null = null;
  let bd = Infinity;
  for (const b of plan.buildings) {
    const cx = b.poly.reduce((a, p) => a + p.x, 0) / 4;
    const cy = b.poly.reduce((a, p) => a + p.y, 0) / 4;
    const d = Math.hypot(cx - wx, cy - wy);
    if (d < Math.max(8, tol + 4) && d < bd) { bd = d; best = b; }
  }
  return best;
}

export function nearestLandmark(plan: CityPlan, wx: number, wy: number, S: number): CityLandmark | null {
  const tol = 16 / S;
  for (const lm of plan.landmarks) {
    if (Math.hypot(lm.x - wx, lm.y - wy) < Math.max(12, tol + 6)) return lm;
  }
  return null;
}
