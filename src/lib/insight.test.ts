import { describe, expect, it } from "vitest";
import type { ClimateSummary } from "./climate";
import { buildInsight } from "./insight";

const base: ClimateSummary = {
  summerTempChangeC: 0,
  annualPrecipChangePct: 0,
  hotMonthChange: 0,
  hotMonthsBaseline: 0,
  hotMonthsRecent: 0,
  trendPerDecadeC: 0,
};

describe("buildInsight", () => {
  it("flags hotter summers above the +0.5 °C threshold", () => {
    const out = buildInsight({ ...base, summerTempChangeC: 0.9 });
    expect(out[0].code).toBe("heatHotter");
    expect(out[0].params?.deg).toBe(0.9);
  });

  it("flags cooler summers below the -0.5 °C threshold", () => {
    const out = buildInsight({ ...base, summerTempChangeC: -1.2 });
    expect(out[0].code).toBe("heatCooler");
    expect(out[0].params?.deg).toBe(1.2);
  });

  it("flags drier conditions when rainfall drops 5% or more", () => {
    const out = buildInsight({ ...base, annualPrecipChangePct: -12 });
    expect(out[1].code).toBe("rainDown");
    expect(out[1].params?.pct).toBe(12);
  });

  it("flags wetter conditions when rainfall rises 5% or more", () => {
    const out = buildInsight({ ...base, annualPrecipChangePct: 20 });
    expect(out[1].code).toBe("rainUp");
    expect(out[1].params?.pct).toBe(20);
  });

  it("adds a third item only when hot months clearly move", () => {
    expect(buildInsight({ ...base, hotMonthChange: 1 })).toHaveLength(2);
    const moved = buildInsight({ ...base, hotMonthChange: 3 });
    expect(moved).toHaveLength(3);
    expect(moved[2].code).toBe("hotMore");
    expect(moved[2].params?.n).toBe(3);
  });

  it("never returns more than three climate items without soil", () => {
    const out = buildInsight({
      ...base,
      summerTempChangeC: 2,
      annualPrecipChangePct: -30,
      hotMonthChange: 5,
    });
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it("adds a legumes item when soil organic carbon is low", () => {
    const out = buildInsight(base, {
      texture: "Sandy loam",
      socPct: 0.6,
      socRating: "low",
      ph: 6.8,
      phRating: "neutral",
    });
    expect(out[out.length - 1].code).toBe("soilLowCarbon");
  });

  it("adds an alkaline-soil item when carbon is fine but pH is high", () => {
    const out = buildInsight(base, {
      texture: "Clay loam",
      socPct: 1.18,
      socRating: "medium",
      ph: 7.87,
      phRating: "alkaline",
    });
    expect(out[out.length - 1].code).toBe("soilAlkaline");
  });
});
