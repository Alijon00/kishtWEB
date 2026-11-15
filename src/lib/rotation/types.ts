import type { Crop } from "../../data/crops";

export type SocLevel = "low" | "medium" | "good";

export type SeasonKind = "temperate" | "tropical";
export type Groundwater = "falling" | "stable" | "rising" | "unknown";

export interface SiteConditions {
  seasonKind: SeasonKind;
  summerTempC: number;
  winterTempC: number;
  summerTmaxC: number;
  winterTmaxC: number;
  annualRainMm: number;
  summerRainMm: number;
  winterRainMm: number;
  rainChangePct: number;
  tempChangeC: number;
  baselineYears: [number, number];

  socPct: number;
  socLevel: SocLevel;
  ph: number;
  texture: string;
  soilKnown: boolean;

  groundwater: Groundwater;
  groundwaterTrendCm?: number;

  elevationM?: number;
  slopePct?: number;
  steepSharePct?: number;

  soilMoistureTrend?: "falling" | "stable" | "rising";
  soilMoistureBaseline?: number;
  soilMoistureRecent?: number;
}

export interface Priorities {
  water: number;
  soil: number;
  income: number;
  reliability: number;
}

export interface Scenario {
  rainDeltaPct: 0 | -20;
  tempDeltaC: 0 | 2;
}

export interface Scores {
  water: number;
  soil: number;
  income: number;
  reliability: number;
}

export type ReasonCode =
  | "rain"
  | "heat"
  | "soilLegume"
  | "soilDiversity"
  | "groundwater"
  | "erosion"
  | "soilMoisture"
  | "scenario";

export interface ReasonParams {
  [key: string]: string | number | string[] | undefined;
}

export interface Reason {
  dataPoint: string;
  source: string;
  rule: string;
  effect: string;
  code: ReasonCode;
  params: ReasonParams;
}

export type ReliabilityStatus = "holds" | "uncertain" | "high-risk";

export type SlotSeason = "summer" | "winter";

export interface PlanSlot {
  year: number;
  season: SlotSeason;
  crop: Crop | null;
}

export interface CurrentRotation {
  summer: string | null;
  winter: string | null;
}

export interface Plan {
  id: string;
  title: string;
  badge?: string;
  seasonKind: SeasonKind;
  slots: PlanSlot[];
  scores: Scores;
  matchPct: number;
  reliabilityStatus: ReliabilityStatus;
  reliabilityMessage: string;
  reasons: Reason[];
  why: string;
}

export interface ExcludedCrop {
  crop: Crop;
  reason: string;
}

export interface EngineResult {
  plans: Plan[];
  excluded: ExcludedCrop[];
  allowed: Crop[];
  adjusted: SiteConditions;
}
