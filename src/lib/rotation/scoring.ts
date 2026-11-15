import { waterNeedMid, type Crop } from "../../data/crops";
import * as C from "./constants";
import type {
  PlanSlot,
  Priorities,
  ReliabilityStatus,
  Scores,
  SiteConditions,
} from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The crops actually planted in a plan (fallow slots dropped). */
function planted(slots: PlanSlot[]): Crop[] {
  return slots.map((s) => s.crop).filter((c): c is Crop => c != null);
}

/**
 * The mean daily-max temperature a crop faces in its own growing season —
 * each season's own (scenario-adjusted) value, derived by latitude upstream.
 */
export function effectiveGrowingTmax(crop: Crop, site: SiteConditions): number {
  return crop.season === "summer" ? site.summerTmaxC : site.winterTmaxC;
}

/** Rainfall available to a crop, counted in ITS growing season. */
export function seasonRainForCrop(crop: Crop, site: SiteConditions): number {
  return crop.season === "summer" ? site.summerRainMm : site.winterRainMm;
}

/** Unmet water demand (mm) for one crop: seasonal need minus that season's rain. */
export function waterDeficitMm(crop: Crop, site: SiteConditions): number {
  return Math.max(0, waterNeedMid(crop) - seasonRainForCrop(crop, site));
}

/**
 * 0–10: lower irrigation deficit = higher score. Blends the plan-wide AVERAGE
 * deficit with the SINGLE thirstiest crop (WATER_PEAK_WEIGHT) so one hungry crop
 * can't hide behind dry ones; worse again where groundwater is falling.
 */
/** Deficit multiplier for a falling aquifer, scaled by the GRACE depletion rate. */
export function fallingPenalty(site: SiteConditions): number {
  if (site.groundwater !== "falling") return 1;
  if (typeof site.groundwaterTrendCm === "number") {
    return 1 + C.FALLING_PENALTY_PER_CM * Math.abs(site.groundwaterTrendCm);
  }
  return C.FALLING_GROUNDWATER_PENALTY;
}

export function waterScore(slots: PlanSlot[], site: SiteConditions): number {
  const crops = planted(slots);
  if (crops.length === 0) return 10; // nothing planted, nothing to irrigate
  const deficits = crops.map((c) => waterDeficitMm(c, site));
  const avg = mean(deficits);
  const peak = Math.max(...deficits);
  const blended = (1 - C.WATER_PEAK_WEIGHT) * avg + C.WATER_PEAK_WEIGHT * peak;
  const effective = blended * fallingPenalty(site);
  return clamp(10 - effective / C.WATER_DEFICIT_PER_POINT_MM, 0, 10);
}

/** The crops planted in each year's summer then winter slot (null = fallow). */
const isRowCrop = (c: Crop) => C.EROSION_ROW_CROP_IDS.includes(c.id);

/**
 * Erosion adjustment (points added to the soil score) for steep land only.
 * On slopes above EROSION_SLOPE_PCT (from SRTM / AWS Terrain Tiles):
 *  + a perennial stand, and legumes, earn a bonus (cover + roots hold soil)
 *  − row crops (cotton, maize) grown two years running take a penalty (back-to-
 *    back bare cultivation is what erodes a hillside)
 * Returns 0 when we have no slope, or the land is flat enough not to matter.
 */
export function erosionAdjustment(slots: PlanSlot[], site: SiteConditions): number {
  if (typeof site.slopePct !== "number" || site.slopePct <= C.EROSION_SLOPE_PCT) return 0;
  const crops = planted(slots);
  if (crops.length === 0) return 0;

  let adj = 0;
  if (crops.some((c) => c.perennial)) adj += C.EROSION_PERENNIAL_BONUS;
  const legumeSlots = crops.filter((c) => c.fixesNitrogen).length;
  adj += Math.min(legumeSlots, C.EROSION_MAX_LEGUME_SLOTS) * C.EROSION_PER_LEGUME_SLOT;

  // Penalty for each pair of consecutive years that both carry a row crop.
  // Slots are ordered [y0 summer, y0 winter, y1 summer, …]; a year "has a row
  // crop" if either of its two slots is cotton/maize.
  const yearHasRow: boolean[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const summer = slots[i]?.crop;
    const winter = slots[i + 1]?.crop;
    yearHasRow.push((summer != null && isRowCrop(summer)) || (winter != null && isRowCrop(winter)));
  }
  for (let y = 1; y < yearHasRow.length; y++) {
    if (yearHasRow[y] && yearHasRow[y - 1]) adj -= C.EROSION_ROW_CROP_PENALTY;
  }
  return adj;
}

/**
 * 0–10: nitrogen fixers, plant-family diversity and a perennial build soil.
 * Scored across all planted slots so a two-crop cereal monoculture (rice–wheat)
 * sits near the base and a diverse, legume-rich plan approaches 10. On steep
 * land (SRTM slope) an erosion adjustment nudges the score up for cover crops
 * and down for back-to-back row crops.
 */
export function soilScore(slots: PlanSlot[], site?: SiteConditions): number {
  const crops = planted(slots);
  if (crops.length === 0) return 0;
  const legumeSlots = crops.filter((c) => c.fixesNitrogen).length;
  const families = new Set(crops.map((c) => c.family)).size;
  const hasPerennial = crops.some((c) => c.perennial);
  const score =
    C.SOIL_BASE +
    Math.min(legumeSlots, C.SOIL_MAX_LEGUME_SLOTS) * C.SOIL_PER_LEGUME_SLOT +
    (families - 1) * C.SOIL_PER_EXTRA_FAMILY +
    (hasPerennial ? C.SOIL_PERENNIAL_BONUS : 0) +
    (site ? erosionAdjustment(slots, site) : 0);
  return clamp(score, 0, 10);
}

/** 0–10: average crop value across ALL slots, so fallow slots cost income. */
export function incomeScore(slots: PlanSlot[]): number {
  const total = slots.reduce((s, sl) => s + (sl.crop ? sl.crop.incomeIndex : 0), 0);
  return clamp((total / slots.length) * C.INCOME_SCALE, 0, 10);
}

/** 0–10 reliability for a single crop under the given (adjusted) conditions. */
export function cropReliability(crop: Crop, site: SiteConditions): number {
  const headroom = crop.maxTempC - effectiveGrowingTmax(crop, site);
  const heat = clamp(
    C.HEAT_SCORE_AT_ZERO_HEADROOM + headroom * C.HEAT_SCORE_PER_DEG,
    0,
    10,
  );
  const stress = clamp(
    waterDeficitMm(crop, site) / C.DROUGHT_DEFICIT_PER_POINT_MM,
    0,
    C.DROUGHT_MAX_STRESS,
  );
  const drought = clamp(
    C.DROUGHT_SCORE_BASE + (crop.droughtTolerance - 1) * C.DROUGHT_PER_BAND - stress,
    0,
    10,
  );
  let rel = 0.5 * heat + 0.5 * drought;
  // Salinity risk is a soft penalty, not an exclusion: pH is not an EC reading,
  // so we dock reliability for salt-sensitive crops on saline-risk (very
  // alkaline or very acidic) soil rather than ruling them out.
  if (
    crop.salinityTolerance === 1 &&
    (site.ph >= C.STRONG_ALKALINE_PH || site.ph <= C.STRONG_ACIDIC_PH)
  ) {
    rel -= C.SALINITY_RELIABILITY_PENALTY;
  }
  // Root-zone soil moisture falling (GWETROOT): reward drought-tolerant crops,
  // which hold up better as the soil dries year-on-year.
  if (site.soilMoistureTrend === "falling") {
    rel += (crop.droughtTolerance - 1) * C.SOIL_MOISTURE_DROUGHT_BONUS;
  }
  return clamp(rel, 0, 10);
}

/** 0–10: how comfortably the planted crops cope with heat and dryness. */
export function reliabilityScore(slots: PlanSlot[], site: SiteConditions): number {
  const crops = planted(slots);
  if (crops.length === 0) return 0;
  return mean(crops.map((c) => cropReliability(c, site)));
}

export function scoreSlots(slots: PlanSlot[], site: SiteConditions): Scores {
  return {
    water: waterScore(slots, site),
    soil: soilScore(slots, site),
    income: incomeScore(slots),
    reliability: reliabilityScore(slots, site),
  };
}

/** Weighted match (0–100) of a plan's scores against farmer priorities. */
export function matchPct(scores: Scores, pr: Priorities): number {
  const wSum = pr.water + pr.soil + pr.income + pr.reliability;
  if (wSum === 0) {
    const avg = (scores.water + scores.soil + scores.income + scores.reliability) / 4;
    return Math.round(avg * 10);
  }
  const weighted =
    (scores.water * pr.water +
      scores.soil * pr.soil +
      scores.income * pr.income +
      scores.reliability * pr.reliability) /
    wSum;
  return Math.round(weighted * 10);
}

export function reliabilityStatus(
  relScore: number,
  waterScoreVal: number,
): { status: ReliabilityStatus; message: string } {
  if (relScore < C.RELIABILITY_RISK_MAX) {
    return { status: "high-risk", message: "High risk: harvest may suffer" };
  }
  if (relScore < C.RELIABILITY_HOLDS_MIN || waterScoreVal < C.WATER_SHORT_MAX) {
    return { status: "uncertain", message: "Uncertain: water may run short" };
  }
  return { status: "holds", message: "Holds up in this scenario" };
}
