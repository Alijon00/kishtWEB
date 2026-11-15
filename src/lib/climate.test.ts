import { describe, expect, it } from "vitest";
import type { MonthlyRecord } from "./types";
import {
  annualPrecipChangePct,
  annualPrecipMean,
  BASELINE,
  deriveSeasonalClimate,
  hotMonthChange,
  hotMonthCount,
  monthlyPrecipProfile,
  RECENT,
  soilMoistureMean,
  soilMoistureSummary,
  summarize,
  summerMeanTemp,
  summerTempChange,
  summerTrend,
  yearlySummerTemps,
} from "./climate";

function rec(partial: Partial<MonthlyRecord> & Pick<MonthlyRecord, "year" | "month">): MonthlyRecord {
  return { t2m: 20, t2mMax: 25, precipMm: 10, ...partial };
}

describe("soilMoisture (GWETROOT)", () => {
  const dryingRecs: MonthlyRecord[] = [
    rec({ year: 1996, month: 6, gwetroot: 0.4 }),
    rec({ year: 1998, month: 7, gwetroot: 0.4 }),
    rec({ year: 2016, month: 6, gwetroot: 0.3 }),
    rec({ year: 2018, month: 7, gwetroot: 0.3 }),
  ];

  it("averages GWETROOT only within the period, ignoring records without it", () => {
    const recs = [
      ...dryingRecs,
      rec({ year: 2000, month: 1 }),
    ];
    expect(soilMoistureMean(recs, BASELINE)).toBeCloseTo(0.4, 10);
    expect(soilMoistureMean(recs, RECENT)).toBeCloseTo(0.3, 10);
  });

  it("classifies a clear drop as falling", () => {
    const s = soilMoistureSummary(dryingRecs);
    expect(s.hasData).toBe(true);
    expect(s.baseline).toBeCloseTo(0.4, 10);
    expect(s.recent).toBeCloseTo(0.3, 10);
    expect(s.delta).toBeCloseTo(-0.1, 10);
    expect(s.trend).toBe("falling");
  });

  it("classifies a tiny change as stable and a clear rise as rising", () => {
    const stable = soilMoistureSummary([
      rec({ year: 1996, month: 6, gwetroot: 0.4 }),
      rec({ year: 2016, month: 6, gwetroot: 0.405 }),
    ]);
    expect(stable.trend).toBe("stable");

    const rising = soilMoistureSummary([
      rec({ year: 1996, month: 6, gwetroot: 0.3 }),
      rec({ year: 2016, month: 6, gwetroot: 0.4 }),
    ]);
    expect(rising.trend).toBe("rising");
  });

  it("reports hasData:false when no record carries GWETROOT", () => {
    const s = soilMoistureSummary([rec({ year: 1996, month: 6 }), rec({ year: 2016, month: 6 })]);
    expect(s.hasData).toBe(false);
  });
});

describe("summerMeanTemp", () => {
  it("averages only Jun–Aug within the period", () => {
    const recs = [
      rec({ year: 2000, month: 6, t2m: 30 }),
      rec({ year: 2000, month: 7, t2m: 32 }),
      rec({ year: 2000, month: 8, t2m: 34 }),
      rec({ year: 2000, month: 1, t2m: 5 }),
      rec({ year: 2000, month: 9, t2m: 25 }),
      rec({ year: 2010, month: 7, t2m: 99 }),
    ];
    expect(summerMeanTemp(recs, [2000, 2000])).toBeCloseTo(32, 10);
  });

  it("returns NaN when no summer data exists in the period", () => {
    const recs = [rec({ year: 2000, month: 1, t2m: 5 })];
    expect(Number.isNaN(summerMeanTemp(recs, [2000, 2000]))).toBe(true);
  });
});

describe("summerTempChange", () => {
  it("is recent minus baseline mean summer temp", () => {
    const recs = [
      rec({ year: 1995, month: 7, t2m: 20 }),
      rec({ year: 2004, month: 7, t2m: 20 }),
      rec({ year: 2015, month: 7, t2m: 22 }),
      rec({ year: 2024, month: 7, t2m: 23 }),
    ];
    expect(summerTempChange(recs)).toBeCloseTo(2.5, 10);
  });
});

describe("annualPrecipMean & annualPrecipChangePct", () => {
  const recs = [
    rec({ year: 1995, month: 1, precipMm: 100 }),
    rec({ year: 1996, month: 1, precipMm: 120 }),
    rec({ year: 1996, month: 2, precipMm: 80 }),
    rec({ year: 2015, month: 1, precipMm: 300 }),
  ];

  it("sums within a year then averages across years", () => {
    expect(annualPrecipMean(recs, [1995, 1996])).toBeCloseTo(150, 10);
    expect(annualPrecipMean(recs, [2015, 2015])).toBeCloseTo(300, 10);
  });

  it("expresses the baseline→recent change as a percent of baseline", () => {
    expect(annualPrecipChangePct(recs)).toBeCloseTo(100, 10);
  });

  it("returns NaN when the baseline total is zero", () => {
    const dry = [rec({ year: 2015, month: 1, precipMm: 50 })];
    expect(Number.isNaN(annualPrecipChangePct(dry))).toBe(true);
  });
});

describe("hotMonthCount & hotMonthChange", () => {
  const recs = [
    rec({ year: 1995, month: 7, t2mMax: 36 }),
    rec({ year: 1995, month: 8, t2mMax: 35 }),
    rec({ year: 2015, month: 6, t2mMax: 40 }),
    rec({ year: 2015, month: 7, t2mMax: 38 }),
    rec({ year: 2015, month: 8, t2mMax: 30 }),
  ];

  it("counts months strictly above 35 °C within a period", () => {
    expect(hotMonthCount(recs, BASELINE)).toBe(1);
    expect(hotMonthCount(recs, RECENT)).toBe(2);
  });

  it("reports the change between periods", () => {
    expect(hotMonthChange(recs)).toBe(1);
  });
});

describe("yearlySummerTemps & summerTrend", () => {
  it("builds one point per year from summer months", () => {
    const recs = [
      rec({ year: 2000, month: 6, t2m: 10 }),
      rec({ year: 2000, month: 7, t2m: 20 }),
      rec({ year: 2001, month: 7, t2m: 25 }),
    ];
    expect(yearlySummerTemps(recs)).toEqual([
      { year: 2000, temp: 15 },
      { year: 2001, temp: 25 },
    ]);
  });

  it("fits a known positive slope exactly", () => {
    const recs = Array.from({ length: 10 }, (_, i) =>
      rec({ year: 2000 + i, month: 7, t2m: 20 + i * 0.1 }),
    );
    const fit = summerTrend(recs);
    expect(fit.slopePerYear).toBeCloseTo(0.1, 10);
    expect(fit.slopePerDecade).toBeCloseTo(1.0, 10);
  });

  it("returns NaN slope with fewer than two years", () => {
    const fit = summerTrend([rec({ year: 2000, month: 7, t2m: 20 })]);
    expect(Number.isNaN(fit.slopePerDecade)).toBe(true);
  });
});

describe("monthlyPrecipProfile", () => {
  it("returns 12 months, averaging each calendar month across years", () => {
    const recs = [
      rec({ year: 2015, month: 1, precipMm: 10 }),
      rec({ year: 2016, month: 1, precipMm: 30 }),
      rec({ year: 2015, month: 2, precipMm: 5 }),
    ];
    const profile = monthlyPrecipProfile(recs, [2015, 2016]);
    expect(profile).toHaveLength(12);
    expect(profile[0]).toEqual({ month: 1, precipMm: 20 });
    expect(profile[1]).toEqual({ month: 2, precipMm: 5 });
    expect(profile[5]).toEqual({ month: 6, precipMm: 0 });
  });
});

describe("deriveSeasonalClimate", () => {
  const sunDriven: MonthlyRecord[] = [];
  for (let y = 2015; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      const warm = m >= 5 && m <= 9;
      sunDriven.push(rec({ year: y, month: m, t2m: warm ? 28 : 10, precipMm: warm ? 80 : 15 }));
    }
  }

  it("uses sun seasons in the northern temperate zone (lat 40)", () => {
    const s = deriveSeasonalClimate(sunDriven, 40);
    expect(s.kind).toBe("temperate");
    expect(s.summer.months).toEqual([5, 6, 7, 8, 9]);
    expect(s.summer.meanTempC).toBeCloseTo(28, 6);
  });

  it("flips the seasons in the southern temperate zone (lat −40)", () => {
    const s = deriveSeasonalClimate(sunDriven, -40);
    expect(s.kind).toBe("temperate");
    expect(s.summer.months).toEqual([11, 12, 1, 2, 3]);
  });

  it("uses the two rainiest windows in the tropics (bimodal, lat 0)", () => {
    const bimodal: MonthlyRecord[] = [];
    for (let y = 2015; y <= 2024; y++) {
      for (let m = 1; m <= 12; m++) {
        const longR = m >= 3 && m <= 5;
        const shortR = m >= 10 && m <= 12;
        bimodal.push(rec({ year: y, month: m, t2m: 17, precipMm: longR ? 250 : shortR ? 180 : 40 }));
      }
    }
    const s = deriveSeasonalClimate(bimodal, 0);
    expect(s.kind).toBe("tropical");
    expect(s.summer.months).toContain(4);
    expect(s.winter.months).toContain(11);
    expect(s.summer.months.some((m) => s.winter.months.includes(m))).toBe(false);
  });
});

describe("summarize", () => {
  it("bundles every headline figure together", () => {
    const recs = [
      rec({ year: 1995, month: 7, t2m: 20, t2mMax: 36, precipMm: 100 }),
      rec({ year: 2015, month: 7, t2m: 22, t2mMax: 40, precipMm: 200 }),
    ];
    const s = summarize(recs);
    expect(s.summerTempChangeC).toBeCloseTo(2, 10);
    expect(s.annualPrecipChangePct).toBeCloseTo(100, 10);
    expect(s.hotMonthsBaseline).toBe(1);
    expect(s.hotMonthsRecent).toBe(1);
    expect(s.hotMonthChange).toBe(0);
  });
});
