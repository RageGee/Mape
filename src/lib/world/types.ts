// Shared world-model types. Everything on the map is structured data.

export type WorldSize = "small" | "medium" | "large";

export interface WorldParams {
  seed: number;
  seedText: string;
  size: WorldSize;
  oceanCoverage: number; // % of map that is sea 20..75
  mountainDensity: number; // 0..100
  forestDensity: number; // 0..100
  riverDensity: number; // 0..100
  aridity: number; // 0..100 -> deserts/drylands
  population: number; // 30..300 settlement abundance %
  politicalFragmentation: number; // 0..100 -> more, smaller realms
  civilizationAge: number; // 150..1300 years of recorded history
  tradeIntensity: number; // 0..100
  wallFrequency: number; // 0..100
}

export const DEFAULT_PARAMS: WorldParams = {
  seed: 78439215,
  seedText: "78439215",
  size: "medium",
  oceanCoverage: 52,
  mountainDensity: 55,
  forestDensity: 56,
  riverDensity: 55,
  aridity: 38,
  population: 120,
  politicalFragmentation: 46,
  civilizationAge: 760,
  tradeIntensity: 62,
  wallFrequency: 68,
};

export enum Biome {
  DeepOcean = 0,
  Ocean = 1,
  Lake = 2,
  Beach = 3,
  Glacier = 4,
  Tundra = 5,
  Taiga = 6,
  Grassland = 7,
  TemperateForest = 8,
  Swamp = 9,
  Savanna = 10,
  Desert = 11,
  Hills = 12,
  Mountain = 13,
  SnowPeak = 14,
}

export const BIOME_NAME: Record<Biome, string> = {
  [Biome.DeepOcean]: "Deep Ocean",
  [Biome.Ocean]: "Sea",
  [Biome.Lake]: "Lake",
  [Biome.Beach]: "Coast",
  [Biome.Glacier]: "Glacier",
  [Biome.Tundra]: "Tundra",
  [Biome.Taiga]: "Taiga Forest",
  [Biome.Grassland]: "Grassland",
  [Biome.TemperateForest]: "Forest",
  [Biome.Swamp]: "Swamp",
  [Biome.Savanna]: "Savanna",
  [Biome.Desert]: "Desert",
  [Biome.Hills]: "Hills",
  [Biome.Mountain]: "Mountains",
  [Biome.SnowPeak]: "High Peaks",
};

export type CultureId = "nordheim" | "vaelora" | "stravia" | "kaelan" | "mahlden";

export interface Named {
  text: string;
  lang: string; // culture label
  meaning: string;
}

export type SettlementRank = "metropolis" | "capital" | "city" | "town" | "village" | "hamlet";

export type SettlementKind =
  | "market"
  | "port"
  | "fishing"
  | "river"
  | "mining"
  | "castle"
  | "farming"
  | "frontier"
  | "religious";

export const RANK_LABEL: Record<SettlementRank, string> = {
  metropolis: "Great Capital",
  capital: "Capital City",
  city: "City",
  town: "Town",
  village: "Village",
  hamlet: "Hamlet",
};

export interface Settlement {
  id: number;
  x: number;
  y: number; // tile coordinates
  name: Named;
  rank: SettlementRank;
  kind: SettlementKind;
  kingdomId: number; // -1 = independent
  population: number;
  founded: number; // founding year (world calendar, "Year of Embers" epoch)
  founder: string;
  industries: string[];
  exports: string[];
  imports: string[];
  wealth: number; // 1..5
  walled: boolean;
  tradeRoutes: number;
  blurb: string;
  citySeed: number; // deterministic seed for the city plan generator
}

export interface Kingdom {
  id: number;
  name: Named;
  title: string; // e.g. "Kingdom of"
  color: string;
  culture: CultureId;
  capitalId: number;
  ruler: string;
  rulerTitle: string;
  population: number;
  area: number; // tiles
  settlementCount: number;
  island: boolean;
}

export interface RoadEdge {
  id: number;
  a: number;
  b: number;
  path: number[]; // tile indices
  trade: boolean;
  bridges: number[]; // tile indices that cross rivers
}

export interface River {
  id: number;
  name: Named;
  points: number[]; // tile indices from source to mouth
  length: number;
}

export interface NamedRegion {
  id: number;
  kind: "mountains" | "forest" | "desert" | "swamp";
  name: Named;
  x: number;
  y: number;
  size: number; // tiles
}

export interface WorldData {
  params: WorldParams;
  width: number;
  height: number;
  elevation: Float32Array;
  moisture: Float32Array;
  temperature: Float32Array;
  biome: Uint8Array;
  riverTile: Int16Array; // river id + 1, 0 = none
  kingdomTile: Int16Array; // kingdom id, -1 = none
  settlements: Settlement[];
  kingdoms: Kingdom[];
  roads: RoadEdge[];
  rivers: River[];
  regions: NamedRegion[];
  coastSegs: Float32Array; // x1,y1,x2,y2 coastline ink segments
  borderSegs: Float32Array; // x1,y1,x2,y2 political border segments
  stats: {
    landTiles: number;
    totalPopulation: number;
    urbanPopulation: number;
    buildingEstimate: number;
  };
}

// ---------- City plan ----------

export type BuildingType =
  | "house"
  | "mansion"
  | "shop"
  | "workshop"
  | "smithy"
  | "bakery"
  | "tannery"
  | "warehouse"
  | "inn"
  | "tavern"
  | "stable"
  | "granary"
  | "chapel";

export type DistrictType =
  | "market"
  | "castle"
  | "noble"
  | "religious"
  | "harbor"
  | "warehouse"
  | "artisan"
  | "residential"
  | "military"
  | "poor";

export const DISTRICT_LABEL: Record<DistrictType, string> = {
  market: "Market District",
  castle: "Castle Ward",
  noble: "Noble Quarter",
  religious: "Temple Quarter",
  harbor: "Harbor District",
  warehouse: "Warehouse Row",
  artisan: "Artisan Quarter",
  residential: "Residential Ward",
  military: "Garrison Ward",
  poor: "Beggars' Quarter",
};

export interface Pt {
  x: number;
  y: number;
}

export interface CityBuilding {
  id: number;
  poly: Pt[];
  type: BuildingType;
  district: DistrictType;
  name?: string;
}

export interface CityLandmark {
  id: number;
  type: "keep" | "cathedral" | "townhall" | "gate" | "docks" | "mine";
  x: number;
  y: number;
  angle: number;
  name?: Named;
  poly?: Pt[];
}

export interface CityStreet {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  w: 0 | 1 | 2; // 0 lane, 1 street, 2 main road
}

export interface NamedStreet {
  name: Named;
  x: number;
  y: number;
  angle: number;
}

export interface CityDistrictHull {
  type: DistrictType;
  hull: Pt[];
}

export interface CityPlan {
  settlementId: number;
  radius: number;
  walls: Pt[][]; // outer first, inner rings after
  wallTowers: Pt[];
  gates: { x: number; y: number; angle: number; name: Named }[];
  streets: CityStreet[];
  buildings: CityBuilding[];
  districts: CityDistrictHull[];
  landmarks: CityLandmark[];
  squares: { x: number; y: number; r: number }[];
  river: Pt[] | null;
  coastAngle: number | null; // direction of open water, radians
  namedStreets: NamedStreet[];
}

// ---------- UI ----------

export type MapStyle = "atlas" | "political" | "strategos";

export interface LayerState {
  borders: boolean;
  rivers: boolean;
  roads: boolean;
  tradeRoutes: boolean;
  settlements: boolean;
  labels: boolean;
  regions: boolean;
  relief: boolean;
}

export const DEFAULT_LAYERS: LayerState = {
  borders: true,
  rivers: true,
  roads: true,
  tradeRoutes: true,
  settlements: true,
  labels: true,
  regions: true,
  relief: true,
};

export type Selection =
  | { kind: "settlement"; id: number }
  | { kind: "kingdom"; id: number }
  | { kind: "river"; id: number }
  | { kind: "building"; cityId: number; id: number }
  | { kind: "landmark"; cityId: number; id: number }
  | null;

export interface WorldOverrides {
  renames: Record<string, string>; // "s:12" | "k:3" | "r:4" -> custom name
  citySeeds: Record<string, number>; // settlementId -> overridden city seed
}

export const EMPTY_OVERRIDES: WorldOverrides = { renames: {}, citySeeds: {} };
