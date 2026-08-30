// World orchestrator: terrain -> civilization -> naming -> stats.
// Deterministic from (seed, params); user overrides (renames, city seeds)
// are applied on top so saved worlds are tiny.

import { generateTerrain } from "./terrain";
import { generateCivilization } from "./civilization";
import { makeNameFactory } from "./names";
import { EMPTY_OVERRIDES, type CultureId, type Settlement, type WorldData, type WorldOverrides, type WorldParams } from "./types";

export const CULTURE_BY_X: CultureId[] = ["kaelan", "nordheim", "mahlden", "vaelora", "stravia"];

export function generateWorld(params: WorldParams, overrides: WorldOverrides = EMPTY_OVERRIDES): WorldData {
  const terrain = generateTerrain(params);
  const civ = generateCivilization(params, terrain);

  // name rivers with the culture at their mouth
  const riverNf = makeNameFactory(params.seed, "river-names");
  for (const river of terrain.rivers) {
    const mouth = river.points[river.points.length - 1];
    const mx = mouth % terrain.width;
    const kid = civ.kingdomTile[mouth];
    const culture = kid >= 0 && civ.kingdoms[kid] ? civ.kingdoms[kid].culture : CULTURE_BY_X[Math.max(0, Math.min(4, Math.floor((mx / terrain.width) * 5)))];
    river.name = riverNf.riverName(culture);
  }

  // apply user overrides
  if (overrides.renames) {
    for (const [key, val] of Object.entries(overrides.renames)) {
      const [p, idStr] = key.split(":");
      const id = Number(idStr);
      if (!val) continue;
      if (p === "s" && civ.settlements[id]) civ.settlements[id].name = { ...civ.settlements[id].name, text: val, meaning: "named by the mapmaker" };
      if (p === "k" && civ.kingdoms[id]) civ.kingdoms[id].name = { ...civ.kingdoms[id].name, text: val, meaning: "named by the mapmaker" };
      if (p === "r" && terrain.rivers[id]) terrain.rivers[id].name = { ...terrain.rivers[id].name, text: val, meaning: "named by the mapmaker" };
    }
  }
  if (overrides.citySeeds) {
    for (const [idStr, seed] of Object.entries(overrides.citySeeds)) {
      const s = civ.settlements[Number(idStr)];
      if (s) s.citySeed = seed >>> 0;
    }
  }

  // apply custom city seeds to nothing else; stats
  const totalPopulation = civ.kingdoms.reduce((a, k) => a + k.population, 0);
  const world: WorldData = {
    params,
    width: terrain.width,
    height: terrain.height,
    elevation: terrain.elevation,
    moisture: terrain.moisture,
    temperature: terrain.temperature,
    biome: terrain.biome,
    riverTile: terrain.riverTile,
    kingdomTile: civ.kingdomTile,
    settlements: civ.settlements,
    kingdoms: civ.kingdoms,
    roads: civ.roads,
    rivers: terrain.rivers,
    regions: terrain.regions,
    coastSegs: terrain.coastSegs,
    borderSegs: civ.borderSegs,
    stats: {
      landTiles: terrain.landTiles,
      totalPopulation,
      urbanPopulation: civ.urbanPopulation,
      buildingEstimate: Math.round(civ.urbanPopulation / 30),
    },
  };
  return world;
}

export function applyRename(world: WorldData, overrides: WorldOverrides): WorldData {
  return generateWorld(world.params, overrides);
}

export function cultureOfSettlement(world: WorldData, s: Settlement): CultureId {
  if (s.kingdomId >= 0 && world.kingdoms[s.kingdomId]) return world.kingdoms[s.kingdomId].culture;
  return CULTURE_BY_X[Math.max(0, Math.min(4, Math.floor((s.x / world.width) * 5)))];
}

export function regenerateCitySeed(_world: WorldData, settlementId: number, overrides: WorldOverrides): WorldOverrides {
  const next = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return { ...overrides, citySeeds: { ...overrides.citySeeds, [String(settlementId)]: next } };
}
