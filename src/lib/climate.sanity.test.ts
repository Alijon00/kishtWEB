import { describe, expect, it } from "vitest";
import punjab from "../../public/data/demo/punjab.json";
import vakhsh from "../../public/data/demo/vakhsh.json";
import nakuru from "../../public/data/demo/nakuru.json";
import { parsePowerResponse } from "./nasaPower";
import { RECENT, climatePeriods, completeYears, dropPartialYears, summarize, annualPrecipMean } from "./climate";
import { SLOPE_FLAT_PCT } from "./terrain";
import type { MonthlyRecord } from "./types";

const BUNDLES: Record<string, { power: unknown }> = { punjab, vakhsh, nakuru };
const POINTS = ["punjab", "vakhsh", "nakuru"] as const;
const SUMMER = [6, 7, 8];

function loadRecords(id: string): MonthlyRecord[] {
  return parsePowerResponse(BUNDLES[id].power as Parameters<typeof parsePowerResponse>[0]);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function refSummerMean(recs: MonthlyRecord[], [a, b]: [number, number]): number {
  const keep = completeYears(recs);
  const vals = recs
    .filter((r) => keep.has(r.year) && r.year >= a && r.year <= b && SUMMER.includes(r.month))
    .map((r) => r.t2m);
  return mean(vals);
}

function refAnnualRain(recs: MonthlyRecord[], [a, b]: [number, number]): number {
  const keep = completeYears(recs);
  const byYear = new Map<number, number>();
  for (const r of recs) {
    if (!keep.has(r.year) || r.year < a || r.year > b) continue;
    byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.precipMm);
  }
  return mean([...byYear.values()]);
}

describe("climate sanity — demo fields vs raw NASA POWER", () => {
  for (const id of POINTS) {
    it(`${id}: summarize() matches an independent raw recomputation`, () => {
      const recs = dropPartialYears(loadRecords(id));
      const p = climatePeriods(recs);

      const keep = completeYears(recs);
      const baseN = [...keep].filter((y) => y >= p.baseline[0] && y <= p.baseline[1]).length;
      const recentN = [...keep].filter((y) => y >= p.recent[0] && y <= p.recent[1]).length;
      expect(baseN).toBe(10);
      expect(recentN).toBe(10);
      const monthsOf = (y: number) => recs.filter((r) => r.year === y).length;
      for (const y of keep) expect(monthsOf(y)).toBe(12);

      const refTemp = refSummerMean(recs, p.recent) - refSummerMean(recs, p.baseline);
      const refRainBase = refAnnualRain(recs, p.baseline);
      const refRain = ((refAnnualRain(recs, p.recent) - refRainBase) / refRainBase) * 100;

      const s = summarize(recs);

      const bigT = Math.abs(refTemp) > 2 ? "  ⚠ >2°C — verify in raw series" : "";
      const bigR = Math.abs(refRain) > 40 ? "  ⚠ >40% — verify in raw series" : "";
      // eslint-disable-next-line no-console
      console.log(
        `${id.padEnd(7)} summerΔ ${s.summerTempChangeC.toFixed(2)}°C (raw ${refTemp.toFixed(2)})${bigT}\n` +
          `        rainΔ   ${s.annualPrecipChangePct.toFixed(1)}% (raw ${refRain.toFixed(1)})${bigR}`,
      );

      expect(s.summerTempChangeC).toBeCloseTo(refTemp, 2);
      expect(s.annualPrecipChangePct).toBeCloseTo(refRain, 1);

      if (Math.abs(s.summerTempChangeC) > 2) expect(Math.abs(refTemp)).toBeGreaterThan(2);
      if (Math.abs(s.annualPrecipChangePct) > 40) expect(Math.abs(refRain)).toBeGreaterThan(40);
    });
  }
});

describe("terrain sanity — flat valley floors read as flat", () => {
  const TERRAIN: Record<string, { terrain?: { elevationM: number; slopePct: number } }> = {
    punjab,
    vakhsh,
    nakuru,
  };
  it("Punjab and the Vakhsh valley floor compute under 3% slope", () => {
    for (const id of ["punjab", "vakhsh"] as const) {
      const t = TERRAIN[id].terrain;
      expect(t).toBeTruthy();
      // eslint-disable-next-line no-console
      console.log(`${id.padEnd(7)} elevation ${t!.elevationM} m · slope ${t!.slopePct}%`);
      expect(t!.slopePct).toBeLessThan(3);
    }
    expect(TERRAIN.punjab.terrain!.slopePct).toBeLessThanOrEqual(SLOPE_FLAT_PCT);
  });
});

describe("climate sanity — partial years are excluded at the data boundary", () => {
  it("dropPartialYears removes a year missing months, so the mean isn't skewed", () => {
    const recs: MonthlyRecord[] = [];
    for (const y of [1995, 1996]) {
      for (let m = 1; m <= 12; m++) recs.push({ year: y, month: m, t2m: 30, t2mMax: 38, precipMm: 100 });
    }
    for (let m = 1; m <= 3; m++) recs.push({ year: 2016, month: m, t2m: 30, t2mMax: 38, precipMm: 100 });

    expect(annualPrecipMean(recs, RECENT)).toBeCloseTo(300, 6);
    const clean = dropPartialYears(recs);
    expect(clean.some((r) => r.year === 2016)).toBe(false);
    expect(Number.isNaN(annualPrecipMean(clean, RECENT))).toBe(true);
  });
});
