import type { ClimateSummary } from "./climate";
import type { SoilAssessment } from "./soil";

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
  params?: { deg?: number; pct?: number; n?: number };
}

export function buildInsight(
  s: ClimateSummary,
  soil?: SoilAssessment | null,
): InsightItem[] {
  const items: InsightItem[] = [];

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

  if (s.annualPrecipChangePct <= -5) {
    items.push({ code: "rainDown", params: { pct: Math.abs(Math.round(s.annualPrecipChangePct)) } });
  } else if (s.annualPrecipChangePct >= 5) {
    items.push({ code: "rainUp", params: { pct: Math.round(s.annualPrecipChangePct) } });
  } else {
    items.push({ code: "rainStable" });
  }

  if (s.hotMonthChange >= 2) {
    items.push({ code: "hotMore", params: { n: s.hotMonthChange } });
  } else if (s.hotMonthChange <= -2) {
    items.push({ code: "hotFewer" });
  }

  const out = items.slice(0, 3);

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
