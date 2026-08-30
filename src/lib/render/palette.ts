// Cartographic palettes for each map style.

import { Biome, type MapStyle } from "@/lib/world/types";

export interface StyleDef {
  styleLabel: string;
  biomes: Record<number, string>;
  coastInk: string;
  border: string;
  borderDash: number[];
  river: string;
  road: string;
  trade: string;
  settlement: string;
  settlementStroke: string;
  label: string;
  labelHalo: string;
  regionLabel: string;
  graticule: string;
  oceanLabel: string;
}

export const STYLES: Record<MapStyle, StyleDef> = {
  atlas: {
    styleLabel: "Historical Atlas",
    biomes: {
      [Biome.DeepOcean]: "#cbb98e",
      [Biome.Ocean]: "#d7caa3",
      [Biome.Lake]: "#a8bda5",
      [Biome.Beach]: "#e0cf9d",
      [Biome.Glacier]: "#e8e6d8",
      [Biome.Tundra]: "#c9c5a4",
      [Biome.Taiga]: "#8fa072",
      [Biome.Grassland]: "#b2b577",
      [Biome.TemperateForest]: "#7e9258",
      [Biome.Swamp]: "#93a06b",
      [Biome.Savanna]: "#cbbd74",
      [Biome.Desert]: "#dec488",
      [Biome.Hills]: "#bfa977",
      [Biome.Mountain]: "#a08d6f",
      [Biome.SnowPeak]: "#e6ddc9",
    },
    coastInk: "rgba(74,58,38,0.55)",
    border: "rgba(122,44,32,0.8)",
    borderDash: [5, 3],
    river: "#5d7d8c",
    road: "rgba(120,84,46,0.75)",
    trade: "rgba(148,42,32,0.85)",
    settlement: "#38291a",
    settlementStroke: "#f2e4bd",
    label: "#2c2114",
    labelHalo: "rgba(233,220,188,0.85)",
    regionLabel: "rgba(59,47,30,0.62)",
    graticule: "rgba(90,70,40,0.10)",
    oceanLabel: "rgba(70,60,38,0.5)",
  },
  political: {
    styleLabel: "Political",
    biomes: {
      [Biome.DeepOcean]: "#a8b2b8",
      [Biome.Ocean]: "#bcc4c8",
      [Biome.Lake]: "#aebeb9",
      [Biome.Beach]: "#d8ceae",
      [Biome.Glacier]: "#e6e6de",
      [Biome.Tundra]: "#d2d0bd",
      [Biome.Taiga]: "#b9c1a4",
      [Biome.Grassland]: "#ccc9a8",
      [Biome.TemperateForest]: "#b6bd97",
      [Biome.Swamp]: "#bcc19c",
      [Biome.Savanna]: "#d4c9a3",
      [Biome.Desert]: "#dbd0ac",
      [Biome.Hills]: "#c9bfa1",
      [Biome.Mountain]: "#b2a78f",
      [Biome.SnowPeak]: "#e2ddcf",
    },
    coastInk: "rgba(48,44,36,0.5)",
    border: "rgba(46,36,28,0.95)",
    borderDash: [],
    river: "#4d6d7c",
    road: "rgba(90,64,38,0.55)",
    trade: "rgba(148,42,32,0.7)",
    settlement: "#241c12",
    settlementStroke: "#f4ecd4",
    label: "#1e170e",
    labelHalo: "rgba(238,231,210,0.9)",
    regionLabel: "rgba(52,44,32,0.55)",
    graticule: "rgba(60,50,34,0.08)",
    oceanLabel: "rgba(52,48,38,0.45)",
  },
  strategos: {
    styleLabel: "Strategos",
    biomes: {
      [Biome.DeepOcean]: "#0e141c",
      [Biome.Ocean]: "#131a24",
      [Biome.Lake]: "#182430",
      [Biome.Beach]: "#39402e",
      [Biome.Glacier]: "#5a615c",
      [Biome.Tundra]: "#313b30",
      [Biome.Taiga]: "#1d2b22",
      [Biome.Grassland]: "#28351f",
      [Biome.TemperateForest]: "#1c2b1c",
      [Biome.Swamp]: "#222d26",
      [Biome.Savanna]: "#33381f",
      [Biome.Desert]: "#40351f",
      [Biome.Hills]: "#3a3c2a",
      [Biome.Mountain]: "#4a463c",
      [Biome.SnowPeak]: "#8a877a",
    },
    coastInk: "rgba(190,160,90,0.35)",
    border: "rgba(212,167,75,0.85)",
    borderDash: [6, 4],
    river: "#3d6f8a",
    road: "rgba(200,150,70,0.5)",
    trade: "rgba(224,120,60,0.85)",
    settlement: "#e8c878",
    settlementStroke: "#14100a",
    label: "#e3cf9a",
    labelHalo: "rgba(12,10,6,0.85)",
    regionLabel: "rgba(200,175,110,0.5)",
    graticule: "rgba(200,170,90,0.07)",
    oceanLabel: "rgba(190,160,95,0.4)",
  },
};

export const OCEAN_NAMES = ["The Boundless Sea", "The Pale Tide", "The Sundering Deep", "The Mothertide"];
