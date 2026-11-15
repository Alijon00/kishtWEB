export type CropFamily =
  | "Poaceae"
  | "Fabaceae"
  | "Malvaceae"
  | "Asteraceae"
  | "Solanaceae"
  | "Pedaliaceae";

export type Season = "summer" | "winter";

export type Band = 1 | 2 | 3;

export interface Crop {
  id: string;
  name: string;
  family: CropFamily;
  season: Season;
  waterNeedMm: [number, number];
  heatTolerance: Band;
  droughtTolerance: Band;
  salinityTolerance: Band;
  maxTempC: number;
  minTempC?: number;
  fixesNitrogen: boolean;
  incomeIndex: Band | 4 | 5;
  perennial?: boolean;
  source: string;
}

export const CROPS: Crop[] = [
  {
    id: "rice",
    name: "Rice",
    family: "Poaceae",
    season: "summer",
    waterNeedMm: [1000, 2000],
    heatTolerance: 2,
    droughtTolerance: 1,
    salinityTolerance: 1,
    maxTempC: 43,
    minTempC: 28,
    fixesNitrogen: false,
    incomeIndex: 4,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "wheat",
    name: "Wheat",
    family: "Poaceae",
    season: "winter",
    waterNeedMm: [450, 650],
    heatTolerance: 1,
    droughtTolerance: 2,
    salinityTolerance: 2,
    maxTempC: 32,
    fixesNitrogen: false,
    incomeIndex: 3,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "maize",
    name: "Maize",
    family: "Poaceae",
    season: "summer",
    waterNeedMm: [500, 800],
    heatTolerance: 2,
    droughtTolerance: 2,
    salinityTolerance: 1,
    maxTempC: 43,
    minTempC: 22,
    fixesNitrogen: false,
    incomeIndex: 3,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "cotton",
    name: "Cotton",
    family: "Malvaceae",
    season: "summer",
    waterNeedMm: [700, 1300],
    heatTolerance: 3,
    droughtTolerance: 2,
    salinityTolerance: 3,
    maxTempC: 46,
    minTempC: 30,
    fixesNitrogen: false,
    incomeIndex: 5,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "barley",
    name: "Barley",
    family: "Poaceae",
    season: "winter",
    waterNeedMm: [400, 600],
    heatTolerance: 2,
    droughtTolerance: 3,
    salinityTolerance: 3,
    maxTempC: 33,
    fixesNitrogen: false,
    incomeIndex: 2,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "sorghum",
    name: "Sorghum",
    family: "Poaceae",
    season: "summer",
    waterNeedMm: [450, 650],
    heatTolerance: 3,
    droughtTolerance: 3,
    salinityTolerance: 2,
    maxTempC: 47,
    minTempC: 26,
    fixesNitrogen: false,
    incomeIndex: 2,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "pearl_millet",
    name: "Pearl millet",
    family: "Poaceae",
    season: "summer",
    waterNeedMm: [350, 500],
    heatTolerance: 3,
    droughtTolerance: 3,
    salinityTolerance: 2,
    maxTempC: 48,
    minTempC: 27,
    fixesNitrogen: false,
    incomeIndex: 2,
    source: "FAO crop ecology; FAO-56 water",
  },
  {
    id: "soybean",
    name: "Soybean",
    family: "Fabaceae",
    season: "summer",
    waterNeedMm: [450, 700],
    heatTolerance: 2,
    droughtTolerance: 2,
    salinityTolerance: 2,
    maxTempC: 43,
    minTempC: 20,
    fixesNitrogen: true,
    incomeIndex: 4,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "chickpea",
    name: "Chickpea",
    family: "Fabaceae",
    season: "winter",
    waterNeedMm: [300, 400],
    heatTolerance: 2,
    droughtTolerance: 3,
    salinityTolerance: 1,
    maxTempC: 32,
    fixesNitrogen: true,
    incomeIndex: 4,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "mung_bean",
    name: "Mung bean",
    family: "Fabaceae",
    season: "summer",
    waterNeedMm: [300, 450],
    heatTolerance: 3,
    droughtTolerance: 2,
    salinityTolerance: 1,
    maxTempC: 45,
    minTempC: 24,
    fixesNitrogen: true,
    incomeIndex: 3,
    source: "FAO crop ecology; FAO-56 water",
  },
  {
    id: "lentil",
    name: "Lentil",
    family: "Fabaceae",
    season: "winter",
    waterNeedMm: [300, 400],
    heatTolerance: 1,
    droughtTolerance: 2,
    salinityTolerance: 1,
    maxTempC: 30,
    fixesNitrogen: true,
    incomeIndex: 4,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "sunflower",
    name: "Sunflower",
    family: "Asteraceae",
    season: "summer",
    waterNeedMm: [500, 900],
    heatTolerance: 2,
    droughtTolerance: 2,
    salinityTolerance: 2,
    maxTempC: 43,
    minTempC: 18,
    fixesNitrogen: false,
    incomeIndex: 3,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "sesame",
    name: "Sesame",
    family: "Pedaliaceae",
    season: "summer",
    waterNeedMm: [300, 500],
    heatTolerance: 3,
    droughtTolerance: 3,
    salinityTolerance: 1,
    maxTempC: 46,
    minTempC: 28,
    fixesNitrogen: false,
    incomeIndex: 4,
    source: "FAO crop ecology; FAO-56 water",
  },
  {
    id: "potato",
    name: "Potato",
    family: "Solanaceae",
    season: "winter",
    waterNeedMm: [500, 700],
    heatTolerance: 1,
    droughtTolerance: 1,
    salinityTolerance: 1,
    maxTempC: 28,
    fixesNitrogen: false,
    incomeIndex: 5,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "alfalfa",
    name: "Alfalfa",
    family: "Fabaceae",
    season: "summer",
    waterNeedMm: [800, 1600],
    heatTolerance: 2,
    droughtTolerance: 2,
    salinityTolerance: 2,
    maxTempC: 46,
    minTempC: 18,
    fixesNitrogen: true,
    incomeIndex: 3,
    perennial: true,
    source: "FAO-56 water; FAO-29 salinity",
  },
];

export const CROP_BY_ID: Record<string, Crop> = Object.fromEntries(
  CROPS.map((c) => [c.id, c]),
);

export function waterNeedMid(c: Crop): number {
  return (c.waterNeedMm[0] + c.waterNeedMm[1]) / 2;
}
