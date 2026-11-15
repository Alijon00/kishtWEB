/**
 * Pure soil-science helpers: USDA texture classification and simple agronomic
 * ratings for organic carbon and pH. No I/O here — everything is a pure
 * function of already-parsed, unit-normalized numbers (see soilgrids.ts).
 */

/** Weighted-average soil properties for the 0–30 cm root zone. */
export interface SoilProfile {
  /** % of the mineral fraction. */
  sandPct: number;
  siltPct: number;
  clayPct: number;
  /** pH in water. */
  ph: number;
  /** Soil organic carbon, as a percent by mass. */
  socPct: number;
}

/**
 * USDA soil textural class from sand/silt/clay percentages.
 *
 * Implements the standard USDA textural-triangle decision rules (as used by
 * USDA-NRCS and the R `soiltexture` package). Inputs are percentages that
 * should sum to ~100; order of the checks matters.
 */
export function usdaTexture(sand: number, silt: number, clay: number): string {
  if (silt + 1.5 * clay < 15) return "Sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "Loamy sand";
  if (
    (clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) ||
    (clay < 7 && silt < 50 && silt + 2 * clay >= 30)
  )
    return "Sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "Loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12))
    return "Silt loam";
  if (silt >= 80 && clay < 12) return "Silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "Sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "Clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "Silty clay loam";
  if (clay >= 35 && sand > 45) return "Sandy clay";
  if (clay >= 40 && silt >= 40) return "Silty clay";
  if (clay >= 40 && sand <= 45 && silt < 40) return "Clay";
  // Fallback for the rare rounding case that misses every band above.
  return "Loam";
}

export type SocRating = "low" | "medium" | "good";

/**
 * Organic-carbon rating thresholds, in % SOC by mass.
 *
 * General agronomic guidance (FAO / common extension services): topsoil organic
 * carbon below ~1% is low, 1–2% is medium, above 2% is good for most arable
 * soils. These are deliberately simple, transparent cut-offs for a farmer tool.
 */
export const SOC_LOW_MAX_PCT = 1.0;
export const SOC_GOOD_MIN_PCT = 2.0;

export function socRating(socPct: number): SocRating {
  if (socPct < SOC_LOW_MAX_PCT) return "low";
  if (socPct >= SOC_GOOD_MIN_PCT) return "good";
  return "medium";
}

export type PhRating = "acidic" | "neutral" | "alkaline";

/**
 * pH rating thresholds.
 *
 * Standard soil-pH bands: below 6.5 is acidic, 6.5–7.5 is neutral (ideal for
 * most crops), above 7.5 is alkaline.
 */
export const PH_ACIDIC_MAX = 6.5;
export const PH_ALKALINE_MIN = 7.5;

export function phRating(ph: number): PhRating {
  if (ph < PH_ACIDIC_MAX) return "acidic";
  if (ph > PH_ALKALINE_MIN) return "alkaline";
  return "neutral";
}

/** The ready-to-display soil assessment. */
export interface SoilAssessment {
  texture: string;
  socPct: number;
  socRating: SocRating;
  ph: number;
  phRating: PhRating;
}

export function assessSoil(p: SoilProfile): SoilAssessment {
  return {
    texture: usdaTexture(p.sandPct, p.siltPct, p.clayPct),
    socPct: p.socPct,
    socRating: socRating(p.socPct),
    ph: p.ph,
    phRating: phRating(p.ph),
  };
}
