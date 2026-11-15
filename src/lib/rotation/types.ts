import type { Crop } from "../../data/crops";

export type SocLevel = "low" | "medium" | "good";

/** How a point's two cropping seasons are defined. */
export type SeasonKind = "temperate" | "tropical";
/**
 * Trend of total water stored under/around the field (GRACE-FO). Only "falling"
 * changes the scoring (it penalises irrigation deficits); "rising"/"stable" are
 * kept distinct so the UI can tell the farmer which it is, and "unknown" is the
 * default when we have no GRACE value for the point.
 */
export type Groundwater = "falling" | "stable" | "rising" | "unknown";

/** Everything the engine knows about a field, from Parts 1 & 2. */
export interface SiteConditions {
  // --- Climate (NASA POWER, Part 1) ---
  /** Whether seasons are set by the sun (temperate) or by rainfall (tropical). */
  seasonKind: SeasonKind;
  /** Mean temperature of the summer / long-rains growing season, °C. */
  summerTempC: number;
  /** Mean temperature of the winter / short-rains growing season, °C. */
  winterTempC: number;
  /** Summer growing-season mean daily-max temperature, °C (season mean + offset). */
  summerTmaxC: number;
  /** Winter growing-season mean daily-max temperature, °C (season mean + offset). */
  winterTmaxC: number;
  /** Recent mean annual rainfall total, mm. */
  annualRainMm: number;
  /** Recent mean rainfall in the summer / long-rains season, mm. */
  summerRainMm: number;
  /** Recent mean rainfall in the winter / short-rains season, mm. */
  winterRainMm: number;
  /** Rainfall change, recent vs baseline, %. */
  rainChangePct: number;
  /** Summer temperature change, recent vs baseline, °C. */
  tempChangeC: number;

  // --- Soil (SoilGrids, Part 2) ---
  socPct: number;
  socLevel: SocLevel;
  ph: number;
  texture: string;

  // --- Hydrology (GRACE-FO, Part 4) ---
  groundwater: Groundwater;
  /** Total-water-storage trend, cm/yr, when a GRACE-FO value exists for the point. */
  groundwaterTrendCm?: number;

  // --- Terrain (SRTM / AWS Terrain Tiles, Part 5) ---
  /** Elevation at the point, metres, when terrain was read. */
  elevationM?: number;
  /** Slope at the point, percent, when terrain was read. Drives the erosion rule. */
  slopePct?: number;

  // --- Root-zone soil moisture (NASA POWER GWETROOT / MERRA-2, Part 5) ---
  /** Trend of root-zone soil wetness, recent vs baseline. "falling" raises
   *  reliability for drought-tolerant crops. Absent when no GWETROOT data. */
  soilMoistureTrend?: "falling" | "stable" | "rising";
  /** Mean root-zone wetness (0–1) for the baseline / recent periods, for display. */
  soilMoistureBaseline?: number;
  soilMoistureRecent?: number;
}

/** Farmer priority weights, 0–10 each. */
export interface Priorities {
  water: number;
  soil: number;
  income: number;
  reliability: number;
}

/** A "what if?" climate scenario layered on top of current conditions. */
export interface Scenario {
  rainDeltaPct: 0 | -20;
  tempDeltaC: 0 | 2;
}

/** The four 0–10 sub-scores every plan gets. */
export interface Scores {
  water: number;
  soil: number;
  income: number;
  reliability: number;
}

/**
 * A machine-readable tag for each reason so the UI can render it in any
 * language from templates (with the real numbers/crop ids substituted in),
 * instead of translating the pre-built English strings.
 */
export type ReasonCode =
  | "rain"
  | "heat"
  | "soilLegume"
  | "soilDiversity"
  | "groundwater"
  | "erosion"
  | "soilMoisture"
  | "scenario";

/** Values plugged into a reason's localized template. */
export interface ReasonParams {
  [key: string]: string | number | string[] | undefined;
}

/** One link in the "data → rule → decision" chain shown on the Why screen. */
export interface Reason {
  /** The number this is based on, e.g. "Summer max 39 °C". (English fallback.) */
  dataPoint: string;
  /** Where the number came from, e.g. "NASA POWER". */
  source: string;
  /** The rule applied, in one phrase. (English fallback.) */
  rule: string;
  /** What it changed in the plan, e.g. "adds pearl millet in 2029". (English fallback.) */
  effect: string;
  /** Tag + params so the UI can rebuild dataPoint/rule/effect in any language. */
  code: ReasonCode;
  params: ReasonParams;
}

export type ReliabilityStatus = "holds" | "uncertain" | "high-risk";

/** The two cropping windows within a year. */
export type SlotSeason = "summer" | "winter";

/** One season of one year. `crop: null` means the slot is left fallow. */
export interface PlanSlot {
  year: number;
  season: SlotSeason;
  crop: Crop | null;
}

/**
 * A farmer's current practice, as a crop repeated every year in each season
 * (null = that season is left fallow). Used to build the "Now" comparison card.
 */
export interface CurrentRotation {
  summer: string | null;
  winter: string | null;
}

export interface Plan {
  id: string;
  title: string;
  badge?: string;
  /** How to label the two seasons in the UI (sun- vs rain-defined). */
  seasonKind: SeasonKind;
  /** 8 slots: 4 years × (summer, winter). A slot's crop may be null (fallow). */
  slots: PlanSlot[];
  scores: Scores;
  /** Weighted match against the farmer's priorities, 0–100. */
  matchPct: number;
  reliabilityStatus: ReliabilityStatus;
  reliabilityMessage: string;
  reasons: Reason[];
  why: string;
}

/** A crop the engine refused, with a human-readable reason. */
export interface ExcludedCrop {
  crop: Crop;
  reason: string;
}

export interface EngineResult {
  plans: Plan[];
  excluded: ExcludedCrop[];
  /** Crops that survived filtering and were available to the search. */
  allowed: Crop[];
  /** The scenario-adjusted conditions the plans were built against. */
  adjusted: SiteConditions;
}
