/**
 * Crop reference table for the rotation engine.
 *
 * Values are APPROXIMATE, drawn from well-known agronomic references and meant
 * to be edited for a specific market/region. Primary sources:
 *  - Seasonal water needs: FAO Irrigation & Drainage Paper No. 56 (Allen et al.)
 *    and FAO No. 33 (Doorenbos & Kassam, "Yield response to water").
 *  - Salinity tolerance: FAO No. 29 (Ayers & Westcot) / USDA salt-tolerance tables.
 *  - Heat/drought tolerance and temperature limits: FAO crop ecology notes and
 *    general extension-service guidance.
 *
 * Tolerances are coarse 1–3 bands (1 = low, 3 = high) on purpose — this is a
 * decision aid, not a yield model. Where a number is a rough guess it carries a
 * TODO so we never pretend to a precision we don't have.
 */

export type CropFamily =
  | "Poaceae"
  | "Fabaceae"
  | "Malvaceae"
  | "Asteraceae"
  | "Solanaceae"
  | "Pedaliaceae";

export type Season = "summer" | "winter";

/** 1 = low, 2 = medium, 3 = high. */
export type Band = 1 | 2 | 3;

export interface Crop {
  id: string;
  name: string;
  family: CropFamily;
  season: Season;
  /** Typical seasonal crop water requirement [min, max], mm. FAO-56 / FAO-33. */
  waterNeedMm: [number, number];
  heatTolerance: Band;
  droughtTolerance: Band;
  /** Salt tolerance (FAO-29). Also used as a proxy for tolerance of the
   *  saline/sodic soils common on very high-pH land in arid regions. */
  salinityTolerance: Band;
  /** Growing-season mean daily-max temperature (°C) above which yield drops
   *  sharply. Calibrated to the engine's temperature scale: each season's mean
   *  temperature (NASA POWER T2M) plus a ~8 °C diurnal offset (see
   *  DIURNAL_MAX_OFFSET_C). We do NOT use POWER's monthly T2M_MAX directly — it
   *  runs several °C hot in arid cells. For winter crops this is their own cool
   *  season, not peak summer. */
  maxTempC: number;
  /** Warm-season floor: the summer daily-max (°C) a heat-loving summer crop
   *  needs to be worth growing. Below it the crop is "too cold here" and is
   *  excluded — this is what keeps cotton/sesame/millet out of cool highlands.
   *  Only meaningful for summer crops; winter crops are cool-season by design
   *  and are never cold-excluded, so they leave this unset. */
  minTempC?: number;
  fixesNitrogen: boolean;
  /** Rough relative profitability, 1 (low) – 5 (high). Shown in the UI as
   *  "rough relative value, edit for your market" — NOT money. */
  incomeIndex: Band | 4 | 5;
  /** Perennial forage (alfalfa) — stays in the ground and builds soil. */
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
    salinityTolerance: 1, // moderately sensitive (ECe threshold ~3 dS/m, FAO-29)
    maxTempC: 43, // flowering heat sterility; grows in Punjab, too hot for Vakhsh-class heat
    minTempC: 28, // a hot lowland crop; not grown in cool highlands
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
    salinityTolerance: 2, // moderately tolerant (threshold ~6 dS/m)
    maxTempC: 32, // grain-fill heat stress above ~32 °C
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
    salinityTolerance: 1, // sensitive (threshold ~1.7 dS/m)
    maxTempC: 43,
    minTempC: 22, // warm-season, but grown into cooler mid-altitude zones
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
    salinityTolerance: 3, // tolerant (threshold ~7.7 dS/m)
    maxTempC: 46,
    minTempC: 30, // needs real heat; absent from cool highlands (e.g. Nakuru)
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
    salinityTolerance: 3, // very tolerant (threshold ~8 dS/m)
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
    salinityTolerance: 2, // moderately tolerant (~6.8 dS/m)
    maxTempC: 47,
    minTempC: 26, // hot-climate cereal
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
    maxTempC: 48, // among the most heat-tolerant cereals
    minTempC: 27, // hot semi-arid crop
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
    salinityTolerance: 2, // moderately tolerant (~5 dS/m)
    maxTempC: 43,
    minTempC: 20, // warm-season but widely adapted
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
    droughtTolerance: 3, // often grown on residual moisture
    salinityTolerance: 1, // sensitive
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
    salinityTolerance: 1, // sensitive
    maxTempC: 45,
    minTempC: 24, // warm-season pulse
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
    salinityTolerance: 1, // sensitive
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
    droughtTolerance: 2, // deep roots help it mine stored water
    salinityTolerance: 2,
    maxTempC: 43,
    minTempC: 18, // tolerates cooler summers than most warm-season crops
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
    salinityTolerance: 1, // sensitive // TODO: references vary; treat as approximate
    maxTempC: 46,
    minTempC: 28, // hot-climate oilseed
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
    salinityTolerance: 1, // moderately sensitive (~1.7 dS/m)
    maxTempC: 28, // tuberization fails in heat; a cool-season crop only
    fixesNitrogen: false,
    incomeIndex: 5,
    source: "FAO-56 water; FAO-29 salinity",
  },
  {
    id: "alfalfa",
    name: "Alfalfa",
    family: "Fabaceae",
    season: "summer",
    waterNeedMm: [800, 1600], // perennial, multiple cuts — high cumulative use
    heatTolerance: 2,
    droughtTolerance: 2, // deep roots, but high total water use
    salinityTolerance: 2, // moderately tolerant
    maxTempC: 46,
    minTempC: 18, // grows from warm plains to cool highlands
    fixesNitrogen: true,
    incomeIndex: 3,
    perennial: true,
    source: "FAO-56 water; FAO-29 salinity",
  },
];

export const CROP_BY_ID: Record<string, Crop> = Object.fromEntries(
  CROPS.map((c) => [c.id, c]),
);

/** Midpoint of a crop's seasonal water need, mm. */
export function waterNeedMid(c: Crop): number {
  return (c.waterNeedMm[0] + c.waterNeedMm[1]) / 2;
}
