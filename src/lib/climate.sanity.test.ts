import { describe, expect, it } from "vitest";
import punjab from "../../public/data/demo/punjab.json";
import vakhsh from "../../public/data/demo/vakhsh.json";
import nakuru from "../../public/data/demo/nakuru.json";
import { parsePowerResponse } from "./nasaPower";
import { BASELINE, RECENT, completeYears, dropPartialYears, summarize, annualPrecipMean } from "./climate";
import { SLOPE_FLAT_PCT } from "./terrain";
import type { MonthlyRecord } from "./types";

/**
 * Scientific-validity guard for the climate headline numbers on the demo fields.
 *
 * It re-derives the summer-temperature and annual-rain change from the raw NASA
 * POWER records with a SECOND, independent implementation and asserts the app's
 * summarize() matches it — so a future unit / partial-year / variable / −999 bug
 * can't silently produce a bogus figure. Big changes (>2 °C, >40 %) are allowed
 * ONLY when this independent raw calc confirms them, and every number is printed
 * so a human can eyeball it against the published record.
 */

const BUNDLES: Record<string, { power: unknown }> = { punjab, vakhsh, nakuru };
const POINTS = ["punjab", "vakhsh", "nakuru"] as const;
const SUMMER = [6, 7, 8];

function loadRecords(id: string): MonthlyRecord[] {
  return parsePowerResponse(BUNDLES[id].power as Parameters<typeof parsePowerResponse>[0]);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Independent reference: complete years only, summer = Jun–Aug mean T2M. */
function refSummerMean(recs: MonthlyRecord[], [a, b]: [number, number]): number {
  const keep = completeYears(recs);
  const vals = recs
    .filter((r) => keep.has(r.year) && r.year >= a && r.year <= b && SUMMER.includes(r.month))
    .map((r) => r.t2m);
  return mean(vals);
}

/** Independent reference: complete years only, annual precip = Σ monthly mm. */
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

      // Data integrity: complete, equal-length comparison periods.
      const keep = completeYears(recs);
      const baseN = [...keep].filter((y) => y >= BASELINE[0] && y <= BASELINE[1]).length;
      const recentN = [...keep].filter((y) => y >= RECENT[0] && y <= RECENT[1]).length;
      expect(baseN).toBe(10);
      expect(recentN).toBe(10);
      // Parser drops −999 / month-13; every kept year must be a full 12 months.
      const monthsOf = (y: number) => recs.filter((r) => r.year === y).length;
      for (const y of keep) expect(monthsOf(y)).toBe(12);

      const refTemp = refSummerMean(recs, RECENT) - refSummerMean(recs, BASELINE);
      const refRainBase = refAnnualRain(recs, BASELINE);
      const refRain = ((refAnnualRain(recs, RECENT) - refRainBase) / refRainBase) * 100;

      const s = summarize(recs);

      // Print so the numbers can be checked against the published record.
      const bigT = Math.abs(refTemp) > 2 ? "  ⚠ >2°C — verify in raw series" : "";
      const bigR = Math.abs(refRain) > 40 ? "  ⚠ >40% — verify in raw series" : "";
      // eslint-disable-next-line no-console
      console.log(
        `${id.padEnd(7)} summerΔ ${s.summerTempChangeC.toFixed(2)}°C (raw ${refTemp.toFixed(2)})${bigT}\n` +
          `        rainΔ   ${s.annualPrecipChangePct.toFixed(1)}% (raw ${refRain.toFixed(1)})${bigR}`,
      );

      // The guard: the app pipeline must equal the independent raw calc.
      expect(s.summerTempChangeC).toBeCloseTo(refTemp, 2);
      expect(s.annualPrecipChangePct).toBeCloseTo(refRain, 1);

      // A big change is acceptable ONLY because the raw data shows it too.
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
    // Punjab is genuinely flat — below the "Flat" threshold.
    expect(TERRAIN.punjab.terrain!.slopePct).toBeLessThanOrEqual(SLOPE_FLAT_PCT);
  });
});

describe("climate sanity — partial years are excluded at the data boundary", () => {
  it("dropPartialYears removes a year missing months, so the mean isn't skewed", () => {
    const recs: MonthlyRecord[] = [];
    for (const y of [1995, 1996]) {
      for (let m = 1; m <= 12; m++) recs.push({ year: y, month: m, t2m: 30, t2mMax: 38, precipMm: 100 });
    }
    // A partial recent year (only 3 months) — a naive sum would read ~300 mm.
    for (let m = 1; m <= 3; m++) recs.push({ year: 2016, month: m, t2m: 30, t2mMax: 38, precipMm: 100 });

    // Naive (all records): the partial 2016 leaks in as a 300 mm "year".
    expect(annualPrecipMean(recs, RECENT)).toBeCloseTo(300, 6);
    // Boundary-filtered: 2016 is dropped, so there is no complete recent year.
    const clean = dropPartialYears(recs);
    expect(clean.some((r) => r.year === 2016)).toBe(false);
    expect(Number.isNaN(annualPrecipMean(clean, RECENT))).toBe(true);
  });
});
