"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CityPlan, LayerState, MapStyle, Selection, WorldData } from "@/lib/world/types";
import { drawWorldScene, nearestSettlement, type View } from "@/lib/render/worldCanvas";
import { drawCityScene, nearestBuilding, nearestLandmark } from "@/lib/render/cityCanvas";

export interface FocusRequest {
  x: number;
  y: number;
  scale: number;
  nonce: number;
}

export interface MapCanvasProps {
  world: WorldData | null;
  style: MapStyle;
  layers: LayerState;
  selection: Selection;
  mode: "world" | "city";
  cityPlan: CityPlan | null;
  worldView: React.RefObject<View>;
  cityView: React.RefObject<View>;
  onViewChange: (v: View) => void;
  onSelect: (sel: Selection) => void;
  onEnterCity: (id: number) => void;
  focusRequest: FocusRequest | null;
  settlementName: string | null;
}

export default function MapCanvas(props: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const animRef = useRef<number | null>(null);
  const lastNotifyRef = useRef(0);

  const sizeOf = () => {
    const cv = canvasRef.current;
    return { w: cv?.clientWidth ?? 800, h: cv?.clientHeight ?? 600 };
  };

  const notify = useCallback(() => {
    const p = propsRef.current;
    const now = performance.now();
    if (now - lastNotifyRef.current > 120) {
      lastNotifyRef.current = now;
      p.onViewChange(p.mode === "city" ? { ...p.cityView.current } : { ...p.worldView.current });
    }
  }, []);

  const viewOf = useCallback((): View => {
    const p = propsRef.current;
    return p.mode === "city" ? p.cityView.current : p.worldView.current;
  }, []);

  const clampView = useCallback((v: View) => {
    const p = propsRef.current;
    const { w, h } = sizeOf();
    if (p.mode === "world" && p.world) {
      const fit = Math.min(w / p.world.width, h / p.world.height) * 0.96;
      v.scale = Math.max(fit * 0.92, Math.min(52, v.scale));
      v.cx = Math.max(-p.world.width * 0.3, Math.min(p.world.width * 1.3, v.cx));
      v.cy = Math.max(-p.world.height * 0.3, Math.min(p.world.height * 1.3, v.cy));
    } else if (p.mode === "city" && p.cityPlan) {
      const R = p.cityPlan.radius;
      v.scale = Math.max(0.16, Math.min(18, v.scale));
      v.cx = Math.max(-R * 2.6, Math.min(R * 2.6, v.cx));
      v.cy = Math.max(-R * 2.6, Math.min(R * 2.6, v.cy));
    }
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = propsRef.current;
    if (p.mode === "world" && p.world) {
      drawWorldScene(ctx, w, h, p.world, p.worldView.current, p.style, p.layers, p.selection);
    } else if (p.mode === "city" && p.cityPlan) {
      drawCityScene(ctx, w, h, p.cityPlan, p.cityView.current, p.selection, p.settlementName ?? "City");
    }
  }, []);

  // redraw on prop changes
  useEffect(() => {
    draw();
  }, [draw, props.world, props.style, props.layers, props.selection, props.mode, props.cityPlan]);

  // one-time listeners
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const toWorld = (e: { clientX: number; clientY: number }) => {
      const rect = cv.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const v = viewOf();
      const { w, h } = sizeOf();
      return {
        wx: v.cx + (px - w / 2) / v.scale,
        wy: v.cy + (py - h / 2) / v.scale,
        px, py,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      cv.setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
      cv.classList.add("dragging");
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const v = viewOf();
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      v.cx -= dx / v.scale;
      v.cy -= dy / v.scale;
      d.x = e.clientX;
      d.y = e.clientY;
      clampView(v);
      draw();
      notify();
    };
    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      cv.classList.remove("dragging");
      const p = propsRef.current;
      if (d && !d.moved) {
        const { wx, wy } = toWorld(e);
        if (p.mode === "world" && p.world) {
          const s = nearestSettlement(p.world, wx, wy, p.worldView.current);
          if (s) {
            p.onSelect({ kind: "settlement", id: s.id });
          } else {
            const tx = Math.floor(wx), ty = Math.floor(wy);
            if (tx >= 0 && ty >= 0 && tx < p.world.width && ty < p.world.height) {
              const kid = p.world.kingdomTile[ty * p.world.width + tx];
              p.onSelect(kid >= 0 ? { kind: "kingdom", id: kid } : null);
            } else {
              p.onSelect(null);
            }
          }
        } else if (p.mode === "city" && p.cityPlan) {
          const lm = nearestLandmark(p.cityPlan, wx, wy, p.cityView.current.scale);
          if (lm) {
            p.onSelect({ kind: "landmark", cityId: p.cityPlan.settlementId, id: lm.id });
          } else {
            const b = nearestBuilding(p.cityPlan, wx, wy, p.cityView.current.scale);
            p.onSelect(b ? { kind: "building", cityId: p.cityPlan.settlementId, id: b.id } : null);
          }
        }
        draw();
      }
      const p2 = propsRef.current;
      p2.onViewChange(p2.mode === "city" ? { ...p2.cityView.current } : { ...p2.worldView.current });
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewOf();
      const { wx, wy } = toWorld(e);
      const ns = v.scale * Math.exp(-e.deltaY * 0.00115);
      v.scale = ns;
      clampView(v);
      const rect = cv.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { w, h } = sizeOf();
      v.cx = wx - (px - w / 2) / v.scale;
      v.cy = wy - (py - h / 2) / v.scale;
      clampView(v);
      draw();
      notify();
    };
    const onDbl = (e: MouseEvent) => {
      const p = propsRef.current;
      if (p.mode !== "world" || !p.world) return;
      const { wx, wy } = toWorld(e);
      const s = nearestSettlement(p.world, wx, wy, p.worldView.current);
      if (s) p.onEnterCity(s.id);
    };

    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", onDbl);
    return () => {
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("dblclick", onDbl);
    };
  }, [clampView, draw, notify, viewOf]);

  // resize observer
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      clampView(viewOf());
      draw();
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [clampView, draw, viewOf]);

  // fly-to animation
  useEffect(() => {
    const fr = props.focusRequest;
    if (!fr) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const v = viewOf();
    const p = propsRef.current;
    const start = { cx: v.cx, cy: v.cy, scale: v.scale };
    let target = { cx: fr.x, cy: fr.y, scale: fr.scale };
    const { w, h } = sizeOf();
    if (fr.scale === -1 && p.world) {
      target = {
        cx: p.world.width / 2,
        cy: p.world.height / 2,
        scale: Math.min(w / p.world.width, h / p.world.height) * 0.96,
      };
    } else if (fr.scale === -2 && p.cityPlan) {
      const R = p.cityPlan.radius;
      target = { cx: 0, cy: 0, scale: Math.min(w, h) / (R * 2.75) };
    }
    const t0 = performance.now();
    const dur = 700;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      v.cx = start.cx + (target.cx - start.cx) * e;
      v.cy = start.cy + (target.cy - start.cy) * e;
      v.scale = start.scale + (target.scale - start.scale) * e;
      clampView(v);
      draw();
      if (k < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        const p = propsRef.current;
        p.onViewChange({ ...v });
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusRequest]);

  return <canvas ref={canvasRef} className="map-canvas absolute inset-0 h-full w-full" />;
}
