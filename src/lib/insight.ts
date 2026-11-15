import type { ClimateSummary } from "./climate";
import type { SoilAssessment } from "./soil";

/**
 * Turn the headline numbers into 2–4 plain insights using simple, transparent
 * thresholds. No AI — every item maps to a rule you can read here. Output is
 * STRUCTURED (code + numbers) so the UI renders it in any language from a
 * template, rather than translating finished English sentences.
 *
 * Soil is optional: when a SoilGrids assessment is available we add one
 * soil-driven item (e.g. low organic carbon → grow legumes, cut monoculture).
 */
export type InsightCode =
  | "heatHotter"
  | "heatCooler"
  | "heatStable"
  | "rainDown"
  | "rainUp"
  | "rainStable"
  | "hotMore"
  | "hotFewer"
  | "soilLowCarbon"
  | "soilAlkaline"
  | "soilAcidic";

export interface InsightItem {
  code: InsightCode;
  /** Numbers for the template: deg (°C), pct (%), n (count). */
  params?: { deg?: number; pct?: number; n?: number };
}

export function buildInsight(
  s: ClimateSummary,
  soil?: SoilAssessment | null,
): InsightItem[] {
  const items: InsightItem[] = [];

  // --- Summer heat -------------------------------------------------------
  if (s.summerTempChangeC >= 0.5) {
    items.push({ code: "heatHotter", params: { deg: Number(s.summerTempChangeC.toFixed(1)) } });
  } else if (s.summerTempChangeC <= -0.5) {
    items.push({
      code: "heatCooler",
      params: { deg: Number(Math.abs(s.summerTempChangeC).toFixed(1)) },
    });
  } else {
    items.push({ code: "heatStable" });
  }

  // --- Rainfall ----------------------------------------------------------
  if (s.annualPrecipChangePct <= -5) {
    items.push({ code: "rainDown", params: { pct: Math.abs(Math.round(s.annualPrecipChangePct)) } });
  } else if (s.annualPrecipChangePct >= 5) {
    items.push({ code: "rainUp", params: { pct: Math.round(s.annualPrecipChangePct) } });
  } else {
    items.push({ code: "rainStable" });
  }

  // --- Extreme heat (only when it clearly moved) -------------------------
  if (s.hotMonthChange >= 2) {
    items.push({ code: "hotMore", params: { n: s.hotMonthChange } });
  } else if (s.hotMonthChange <= -2) {
    items.push({ code: "hotFewer" });
  }

  // Keep the climate part short — three items is the most a farmer needs.
  const out = items.slice(0, 3);

  // --- Soil (one extra item, only when we have data) ---------------------
  if (soil) {
    if (soil.socRating === "low") {
      out.push({ code: "soilLowCarbon" });
    } else if (soil.phRating === "alkaline") {
      out.push({ code: "soilAlkaline" });
    } else if (soil.phRating === "acidic") {
      out.push({ code: "soilAcidic" });
    }
  }

  return out;
}
