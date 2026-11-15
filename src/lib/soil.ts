export interface SoilProfile {
  sandPct: number;
  siltPct: number;
  clayPct: number;
  ph: number;
  socPct: number;
}

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
  return "Loam";
}

export type SocRating = "low" | "medium" | "good";

export const SOC_LOW_MAX_PCT = 1.0;
export const SOC_GOOD_MIN_PCT = 2.0;

export function socRating(socPct: number): SocRating {
  if (socPct < SOC_LOW_MAX_PCT) return "low";
  if (socPct >= SOC_GOOD_MIN_PCT) return "good";
  return "medium";
}

export type PhRating = "acidic" | "neutral" | "alkaline";

export const PH_ACIDIC_MAX = 6.5;
export const PH_ALKALINE_MIN = 7.5;

export function phRating(ph: number): PhRating {
  if (ph < PH_ACIDIC_MAX) return "acidic";
  if (ph > PH_ALKALINE_MIN) return "alkaline";
  return "neutral";
}

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
