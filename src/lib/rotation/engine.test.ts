import { describe, expect, it } from "vitest";
import { CROP_BY_ID } from "../../data/crops";
import {
  applyScenario,
  buildCurrentPlan,
  buildPlans,
  filterCrops,
  maxCropsPerYear,
  perennialBlockPlans,
  slotSpecs,
} from "./engine";
import { CROPS } from "../../data/crops";
import { cropReliability, erosionAdjustment, soilScore, waterScore } from "./scoring";
import type { PlanSlot, Priorities, Scenario, SiteConditions } from "./types";

const PR: Priorities = { water: 6, soil: 6, income: 5, reliability: 6 };
const NOW: Scenario = { rainDeltaPct: 0, tempDeltaC: 0 };
const HOT: Scenario = { rainDeltaPct: 0, tempDeltaC: 2 };
const BOTH: Scenario = { rainDeltaPct: -20, tempDeltaC: 2 };

const MILD: SiteConditions = {
  seasonKind: "temperate",
  summerTempC: 26,
  winterTempC: 10,
  summerTmaxC: 33,
  winterTmaxC: 18,
  annualRainMm: 600,
  summerRainMm: 400,
  winterRainMm: 200,
  rainChangePct: -3,
  tempChangeC: 0.5,
  socPct: 1.5,
  socLevel: "medium",
  ph: 7.0,
  texture: "Loam",
  groundwater: "stable",
};

const PUNJAB: SiteConditions = {
  seasonKind: "temperate",
  summerTempC: 32,
  winterTempC: 17,
  summerTmaxC: 39,
  winterTmaxC: 25,
  annualRainMm: 650,
  summerRainMm: 560,
  winterRainMm: 90,
  rainChangePct: -5,
  tempChangeC: 1.1,
  socPct: 0.45,
  socLevel: "low",
  ph: 7.8,
  texture: "Loam",
  groundwater: "falling",
  groundwaterTrendCm: -3.0,
};

const COOL_HIGHLAND: SiteConditions = {
  seasonKind: "tropical",
  summerTempC: 18,
  winterTempC: 17,
  summerTmaxC: 26,
  winterTmaxC: 25,
  annualRainMm: 900,
  summerRainMm: 620,
  winterRainMm: 280,
  rainChangePct: 2,
  tempChangeC: 0.8,
  socPct: 2.8,
  socLevel: "good",
  ph: 6.2,
  texture: "Clay loam",
  groundwater: "stable",
};

const VAKHSH: SiteConditions = {
  seasonKind: "temperate",
  summerTempC: 29,
  winterTempC: 8,
  summerTmaxC: 37,
  winterTmaxC: 16,
  annualRainMm: 300,
  summerRainMm: 60,
  winterRainMm: 180,
  rainChangePct: -8,
  tempChangeC: 1.3,
  socPct: 0.6,
  socLevel: "low",
  ph: 8.0,
  texture: "Loam",
  groundwater: "stable",
  groundwaterTrendCm: -0.7,
};

const RAINFED: SiteConditions = {
  ...MILD,
  annualRainMm: 220,
  summerRainMm: 150,
  winterRainMm: 70,
  groundwater: "unknown",
};

const SALINE: SiteConditions = { ...PUNJAB, ph: 8.9 };

const ids = (slots: PlanSlot[]) => slots.map((s) => s.crop?.id ?? null);
const key = (slots: PlanSlot[]) => ids(slots).join(">");
const planted = (slots: PlanSlot[]) => slots.filter((s) => s.crop != null);

describe("applyScenario", () => {
  it("raises temps and scales every rainfall field", () => {
    const s = applyScenario(MILD, BOTH);
    expect(s.summerTmaxC).toBe(35);
    expect(s.summerTempC).toBe(28);
    expect(s.annualRainMm).toBeCloseTo(480, 6);
    expect(s.summerRainMm).toBeCloseTo(320, 6);
    expect(s.winterRainMm).toBeCloseTo(160, 6);
  });
});

describe("filterCrops — hard vs soft", () => {
  it("still excludes a crop that is too hot", () => {
    const hot = { ...MILD, summerTmaxC: 46 };
    const rice = filterCrops(hot).excluded.find((e) => e.crop.id === "rice");
    expect(rice?.reason).toMatch(/Too hot/);
  });

  it("still excludes a warm-season crop that is too cool", () => {
    const cotton = filterCrops(COOL_HIGHLAND).excluded.find((e) => e.crop.id === "cotton");
    expect(cotton?.reason).toMatch(/Too cool/);
  });

  it("does NOT exclude salt-sensitive crops on very alkaline soil (soft penalty instead)", () => {
    const { excluded, allowed } = filterCrops(SALINE);
    expect(excluded.some((e) => /alkaline|salin|pH/i.test(e.reason))).toBe(false);
    expect(allowed.some((c) => c.id === "chickpea")).toBe(true);
  });

  it("does NOT exclude maize in a cool tropical highland (Nakuru)", () => {
    const { excluded, allowed } = filterCrops(COOL_HIGHLAND);
    expect(excluded.some((e) => e.crop.id === "maize")).toBe(false);
    expect(allowed.some((c) => c.id === "maize")).toBe(true);
  });

  it("keeps cotton in Vakhsh even under +2 °C", () => {
    const hot = applyScenario(VAKHSH, HOT);
    expect(filterCrops(hot).allowed.some((c) => c.id === "cotton")).toBe(true);
  });

  it("keeps rice and maize in Punjab as-now", () => {
    const { allowed } = filterCrops(PUNJAB);
    expect(allowed.some((c) => c.id === "rice")).toBe(true);
    expect(allowed.some((c) => c.id === "maize")).toBe(true);
  });
});

describe("8-slot season model", () => {
  it("builds plans of 8 slots (4 years × summer/winter)", () => {
    const { plans } = buildPlans(MILD, PR, NOW);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      expect(p.slots).toHaveLength(8);
      const specs = slotSpecs();
      p.slots.forEach((s, i) => {
        expect(s.year).toBe(specs[i].year);
        expect(s.season).toBe(specs[i].season);
      });
    }
  });

  it("only plants a crop in a slot of its own season (perennials excepted)", () => {
    for (const site of [MILD, PUNJAB, COOL_HIGHLAND]) {
      const { plans } = buildPlans(site, PR, NOW);
      for (const p of plans) {
        for (const s of p.slots) {
          if (s.crop && !s.crop.perennial) expect(s.crop.season).toBe(s.season);
        }
      }
    }
  });

  it("never puts the same plant family in two adjacent slots (unless it's one perennial stand)", () => {
    for (const site of [MILD, PUNJAB, COOL_HIGHLAND]) {
      const { plans } = buildPlans(site, PR, NOW);
      for (const p of plans) {
        for (let i = 1; i < p.slots.length; i++) {
          const a = p.slots[i - 1].crop;
          const b = p.slots[i].crop;
          if (a && b && a.id !== b.id) expect(a.family).not.toBe(b.family);
        }
      }
    }
  });
});

describe("main-cereal rule", () => {
  it("gives every year at least one cereal when cereals are available", () => {
    const { plans } = buildPlans(PUNJAB, PR, NOW);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      for (const year of [2027, 2028, 2029, 2030]) {
        const yearSlots = p.slots.filter((s) => s.year === year);
        if (yearSlots.some((s) => s.crop?.perennial)) continue;
        expect(yearSlots.some((s) => s.crop?.family === "Poaceae")).toBe(true);
      }
    }
  });

  it("does not force a cereal when the farmer unticked them all", () => {
    const noCereal = new Set(
      ["chickpea", "lentil", "soybean", "mung_bean", "sunflower", "potato", "cotton", "sesame"],
    );
    const { plans } = buildPlans(MILD, PR, NOW, noCereal);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      for (const s of p.slots) {
        if (s.crop) expect(s.crop.family).not.toBe("Poaceae");
      }
    }
  });
});

describe("legume rule when soil carbon is low", () => {
  it("includes at least one legume slot", () => {
    const { plans } = buildPlans(PUNJAB, PR, NOW);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      expect(p.slots.some((s) => s.crop?.fixesNitrogen)).toBe(true);
    }
  });
});

describe("single-season mode for dry rainfed land", () => {
  it("caps a dry, no-groundwater site at one crop per year", () => {
    expect(maxCropsPerYear(RAINFED)).toBe(1);
    expect(maxCropsPerYear(PUNJAB)).toBe(2);
    const { plans } = buildPlans(RAINFED, PR, NOW);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      for (const year of [2027, 2028, 2029, 2030]) {
        const crops = p.slots.filter((s) => s.year === year && s.crop).length;
        expect(crops).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("water saver excludes thirsty crops", () => {
  it("never contains a crop needing more than 600 mm", () => {
    const { plans } = buildPlans(PUNJAB, { ...PR, water: 10 }, NOW);
    const ws = plans.find((p) => p.id === "water-saver");
    if (ws) {
      for (const s of ws.slots) {
        if (s.crop) {
          const mid = (s.crop.waterNeedMm[0] + s.crop.waterNeedMm[1]) / 2;
          expect(mid).toBeLessThanOrEqual(600);
        }
      }
    }
  });

  it("potato water need is in the FAO 500–700 mm range", () => {
    expect(CROP_BY_ID.potato.waterNeedMm).toEqual([500, 700]);
  });
});

describe("pH is a soft reliability penalty, not an exclusion", () => {
  it("docks a salt-sensitive crop's reliability on alkaline soil", () => {
    const chickpea = CROP_BY_ID.chickpea;
    const neutral = cropReliability(chickpea, { ...PUNJAB, ph: 7.0 });
    const alkaline = cropReliability(chickpea, { ...PUNJAB, ph: 8.9 });
    expect(alkaline).toBeLessThan(neutral);
  });

  it("leaves a salt-tolerant crop's reliability unchanged by pH", () => {
    const barley = CROP_BY_ID.barley;
    const neutral = cropReliability(barley, { ...PUNJAB, ph: 7.0 });
    const alkaline = cropReliability(barley, { ...PUNJAB, ph: 8.9 });
    expect(alkaline).toBeCloseTo(neutral, 6);
  });
});

describe("score spread (not everything 8.2 / 10)", () => {
  it("rice–wheat monoculture scores far lower on soil than a diverse plan", () => {
    const monoculture: PlanSlot[] = slotSpecs().map((spec) => ({
      year: spec.year,
      season: spec.season,
      crop: spec.season === "summer" ? CROP_BY_ID.rice : CROP_BY_ID.wheat,
    }));
    const diverse: PlanSlot[] = slotSpecs().map((spec, i) => ({
      year: spec.year,
      season: spec.season,
      crop:
        spec.season === "summer"
          ? [CROP_BY_ID.maize, CROP_BY_ID.soybean][i % 4 === 0 ? 0 : 1]
          : [CROP_BY_ID.chickpea, CROP_BY_ID.lentil][i % 4 === 1 ? 0 : 1],
    }));
    expect(soilScore(monoculture)).toBeLessThan(4);
    expect(soilScore(diverse)).toBeGreaterThan(6);
    expect(soilScore(diverse) - soilScore(monoculture)).toBeGreaterThan(3);
  });

  it("water score separates a dry-season crop from a monsoon crop", () => {
    const winterOnly: PlanSlot[] = slotSpecs().map((spec) => ({
      year: spec.year,
      season: spec.season,
      crop: spec.season === "winter" ? CROP_BY_ID.wheat : null,
    }));
    const summerOnly: PlanSlot[] = slotSpecs().map((spec) => ({
      year: spec.year,
      season: spec.season,
      crop: spec.season === "summer" ? CROP_BY_ID.maize : null,
    }));
    expect(waterScore(summerOnly, PUNJAB)).toBeGreaterThan(waterScore(winterOnly, PUNJAB));
  });
});

describe("What if? changes the recommended plan", () => {
  it("shifts the best plan under +2 °C / −20 % rain (Punjab, neutral priorities)", () => {
    const neutral: Priorities = { water: 5, soil: 5, income: 5, reliability: 5 };
    const now = buildPlans(PUNJAB, neutral, NOW).plans.find((p) => p.id === "best-fit")!;
    const both = buildPlans(PUNJAB, neutral, BOTH).plans.find((p) => p.id === "best-fit")!;
    expect(key(now.slots)).not.toBe(key(both.slots));
  });

  it("never raises a fixed plan's reliability when it gets hotter", () => {
    const { plans } = buildPlans(MILD, PR, NOW);
    for (const p of plans) {
      const now = applyScenario(MILD, NOW);
      const hot = applyScenario(MILD, HOT);
      for (const s of planted(p.slots)) {
        expect(cropReliability(s.crop!, hot)).toBeLessThanOrEqual(cropReliability(s.crop!, now) + 1e-9);
      }
    }
  });
});

describe("Now (current rotation) comparison", () => {
  it("scores a rice–wheat current rotation, same shape, lower soil than best-fit", () => {
    const now = buildCurrentPlan(PUNJAB, PR, NOW, { summer: "rice", winter: "wheat" });
    expect(now).toBeTruthy();
    expect(now!.slots).toHaveLength(8);
    expect(now!.id).toBe("current");
    const best = buildPlans(PUNJAB, PR, NOW).plans[0];
    expect(now!.scores.soil).toBeLessThan(best.scores.soil);
  });

  it("returns null when the current rotation is all fallow", () => {
    expect(buildCurrentPlan(PUNJAB, PR, NOW, { summer: null, winter: null })).toBeNull();
  });
});

describe("perennial (alfalfa) is a multi-year block", () => {
  it("always fills both seasons of ≥2 consecutive years, with no other crop in those years", () => {
    const annuals = CROPS.filter((c) => !c.perennial);
    const alfalfa = CROPS.find((c) => c.id === "alfalfa")!;
    const plans = perennialBlockPlans(annuals, alfalfa, COOL_HIGHLAND, false, 2);
    expect(plans.length).toBeGreaterThan(0);
    const specs = slotSpecs();
    for (const a of plans) {
      const alfYears = new Set<number>();
      a.forEach((crop, i) => {
        if (crop?.id === "alfalfa") alfYears.add(specs[i].year);
      });
      expect(alfYears.size).toBeGreaterThanOrEqual(2);
      for (const year of alfYears) {
        const yearSlots = a.filter((_, i) => specs[i].year === year);
        expect(yearSlots.every((c) => c?.id === "alfalfa")).toBe(true);
      }
      const sorted = [...alfYears].sort((x, y) => x - y);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBe(1);
    }
  });
});

describe("no crop sits in the same season more than 2 years running", () => {
  it("holds across all plans for several sites", () => {
    const specs = slotSpecs();
    for (const site of [MILD, PUNJAB, COOL_HIGHLAND, VAKHSH]) {
      const { plans } = buildPlans(site, PR, NOW);
      for (const p of plans) {
        for (let start = 0; start < 2; start++) {
          let run = 1;
          for (let k = start + 2; k < specs.length; k += 2) {
            const prev = p.slots[k - 2].crop?.id ?? null;
            const cur = p.slots[k].crop?.id ?? null;
            run = cur != null && cur === prev ? run + 1 : 1;
            expect(run).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});

describe("water score punishes a depleting-aquifer monoculture", () => {
  it("Punjab rice–wheat at GRACE −4.2 cm/yr scores ≤ 3 on water", () => {
    const depleting: SiteConditions = {
      ...PUNJAB,
      groundwater: "falling",
      groundwaterTrendCm: -4.2,
    };
    const riceWheat: PlanSlot[] = slotSpecs().map((spec) => ({
      year: spec.year,
      season: spec.season,
      crop: spec.season === "summer" ? CROP_BY_ID.rice : CROP_BY_ID.wheat,
    }));
    expect(waterScore(riceWheat, depleting)).toBeLessThanOrEqual(3);
  });
});

describe("erosion rule on steep land (SRTM slope)", () => {
  const STEEP: SiteConditions = { ...COOL_HIGHLAND, slopePct: 15, elevationM: 1850 };
  const FLAT: SiteConditions = { ...COOL_HIGHLAND, slopePct: 2, elevationM: 1850 };

  const maizeEverySummer: PlanSlot[] = slotSpecs().map((s) => ({
    year: s.year,
    season: s.season,
    crop: s.season === "summer" ? CROP_BY_ID.maize : CROP_BY_ID.wheat,
  }));
  const alfalfaStand: PlanSlot[] = slotSpecs().map((s) => ({
    year: s.year,
    season: s.season,
    crop: CROP_BY_ID.alfalfa,
  }));

  it("makes no adjustment on flat land or without a slope value", () => {
    expect(erosionAdjustment(maizeEverySummer, FLAT)).toBe(0);
    expect(erosionAdjustment(maizeEverySummer, COOL_HIGHLAND)).toBe(0);
  });

  it("penalises row crops (maize) grown two years running on a steep slope", () => {
    expect(erosionAdjustment(maizeEverySummer, STEEP)).toBeLessThan(0);
    expect(soilScore(maizeEverySummer, STEEP)).toBeLessThan(soilScore(maizeEverySummer, FLAT));
  });

  it("rewards a perennial / legume cover on a steep slope", () => {
    expect(erosionAdjustment(alfalfaStand, STEEP)).toBeGreaterThan(0);
    expect(soilScore(alfalfaStand, STEEP)).toBeGreaterThan(soilScore(alfalfaStand, FLAT));
  });

  it("adds an SRTM erosion reason to every plan on steep land", () => {
    const { plans } = buildPlans(STEEP, PR, NOW);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      const er = p.reasons.find((r) => r.code === "erosion");
      expect(er).toBeTruthy();
      expect(er!.source).toBe("SRTM");
    }
  });

  it("adds no erosion reason on flat land", () => {
    const { plans } = buildPlans(FLAT, PR, NOW);
    for (const p of plans) {
      expect(p.reasons.some((r) => r.code === "erosion")).toBe(false);
    }
  });
});

describe("falling root-zone soil moisture (GWETROOT) raises drought-tolerant reliability", () => {
  const DRYING: SiteConditions = {
    ...PUNJAB,
    soilMoistureTrend: "falling",
    soilMoistureBaseline: 0.4,
    soilMoistureRecent: 0.3,
  };
  const STABLE: SiteConditions = { ...PUNJAB, soilMoistureTrend: "stable" };

  it("raises reliability for a drought-tolerant crop when the soil is drying", () => {
    const sorghum = CROP_BY_ID.sorghum;
    expect(cropReliability(sorghum, DRYING)).toBeGreaterThan(cropReliability(sorghum, STABLE));
  });

  it("leaves a drought-sensitive crop's reliability unchanged", () => {
    const rice = CROP_BY_ID.rice;
    expect(cropReliability(rice, DRYING)).toBeCloseTo(cropReliability(rice, STABLE), 6);
  });

  it("adds a NASA POWER soil-moisture reason to every plan when the trend is known", () => {
    const { plans } = buildPlans(DRYING, PR, NOW);
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      const r = p.reasons.find((x) => x.code === "soilMoisture");
      expect(r).toBeTruthy();
      expect(r!.source).toBe("NASA POWER");
    }
  });

  it("adds no soil-moisture reason when the trend is unknown", () => {
    const { plans } = buildPlans(PUNJAB, PR, NOW);
    for (const p of plans) {
      expect(p.reasons.some((x) => x.code === "soilMoisture")).toBe(false);
    }
  });
});

describe("buildPlans — distinct plans with reason chains", () => {
  it("returns up to three plans that differ and carry a soil reason at index 2", () => {
    const { plans } = buildPlans(PUNJAB, PR, NOW);
    expect(plans.length).toBeGreaterThanOrEqual(2);
    for (const p of plans) {
      expect(p.reasons[2].code).toMatch(/^soil/);
      expect(p.why.length).toBeGreaterThan(0);
    }
    const keys = plans.map((p) => key(p.slots));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
