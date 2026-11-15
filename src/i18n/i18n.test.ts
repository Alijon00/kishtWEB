import { describe, expect, it } from "vitest";
import en from "./en";
import ru from "./ru";
import tg from "./tg";
import { cropName, renderReason, type RenderedReason } from "./index";
import { buildPlans } from "../lib/rotation/engine";
import type { Priorities, Scenario, SiteConditions } from "../lib/rotation/types";

const SITE: SiteConditions = {
  seasonKind: "temperate",
  summerTempC: 33,
  winterTempC: 18,
  summerTmaxC: 40,
  winterTmaxC: 26,
  annualRainMm: 600,
  summerRainMm: 450,
  winterRainMm: 150,
  rainChangePct: -10,
  tempChangeC: 1,
  socPct: 0.5,
  socLevel: "low",
  ph: 8,
  texture: "Sandy loam",
  groundwater: "falling",
  groundwaterTrendCm: -2.3,
  // Steep + drying, so the erosion and soil-moisture reasons are generated too.
  elevationM: 1850,
  slopePct: 15,
  soilMoistureTrend: "falling",
  soilMoistureBaseline: 0.4,
  soilMoistureRecent: 0.3,
};
const PR: Priorities = { water: 7, soil: 6, income: 5, reliability: 6 };
const WHATIF: Scenario = { rainDeltaPct: -20, tempDeltaC: 2 };

const DICTS = { en, ru, tg };

describe("i18n crop names", () => {
  it("translates crop names distinctly per language", () => {
    expect(cropName(en, "rice")).toBe("Rice");
    expect(cropName(ru, "rice")).toBe("Рис");
    expect(cropName(tg, "rice")).toBe("Шолӣ");
  });
});

describe("renderReason", () => {
  it("fills every reason phrase in all three languages, with numbers substituted", () => {
    const { plans } = buildPlans(SITE, PR, WHATIF);
    expect(plans.length).toBeGreaterThan(0);
    for (const [, dict] of Object.entries(DICTS)) {
      for (const plan of plans) {
        // Includes the scenario reason (WHATIF active) and the GRACE reason (trend set).
        expect(plan.reasons.some((r) => r.code === "scenario")).toBe(true);
        expect(plan.reasons.some((r) => r.code === "groundwater")).toBe(true);
        expect(plan.reasons.some((r) => r.code === "erosion")).toBe(true);
        expect(plan.reasons.some((r) => r.code === "soilMoisture")).toBe(true);
        for (const reason of plan.reasons) {
          const out: RenderedReason = renderReason(dict, reason);
          expect(out.dataPoint).toBeTruthy();
          expect(out.source).toBeTruthy();
          expect(out.rule).toBeTruthy();
          expect(out.effect).toBeTruthy();
          // dataPoint always carries at least one real number.
          expect(out.dataPoint).toMatch(/\d/);
        }
      }
    }
  });
});
