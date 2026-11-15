import { describe, expect, it } from "vitest";
import { parsePowerResponse } from "./nasaPower";

/** Minimal response resembling NASA POWER's shape. */
function response(params: Record<string, Record<string, number>>) {
  return { properties: { parameter: params } };
}

describe("parsePowerResponse", () => {
  it("converts precipitation from mm/day to mm for the calendar month", () => {
    // January has 31 days, so 2 mm/day -> 62 mm.
    const json = response({
      T2M: { "199501": 5 },
      T2M_MAX: { "199501": 10 },
      PRECTOTCORR: { "199501": 2 },
    });
    const recs = parsePowerResponse(json);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toEqual({ year: 1995, month: 1, t2m: 5, t2mMax: 10, precipMm: 62 });
  });

  it("drops the YYYY13 annual rollup", () => {
    const json = response({
      T2M: { "199507": 30, "199513": 18 },
      T2M_MAX: { "199507": 40, "199513": 25 },
      PRECTOTCORR: { "199507": 1, "199513": 1 },
    });
    const recs = parsePowerResponse(json);
    expect(recs.map((r) => r.month)).toEqual([7]);
  });

  it("drops any month with a -999 fill value in any parameter", () => {
    const json = response({
      T2M: { "199501": -999, "199502": 6 },
      T2M_MAX: { "199501": 10, "199502": 12 },
      PRECTOTCORR: { "199501": 1, "199502": 1 },
    });
    const recs = parsePowerResponse(json);
    expect(recs.map((r) => r.month)).toEqual([2]);
  });

  it("returns records sorted by year then month", () => {
    const json = response({
      T2M: { "199602": 6, "199501": 5, "199512": 4 },
      T2M_MAX: { "199602": 12, "199501": 10, "199512": 8 },
      PRECTOTCORR: { "199602": 1, "199501": 1, "199512": 1 },
    });
    const recs = parsePowerResponse(json);
    expect(recs.map((r) => `${r.year}-${r.month}`)).toEqual(["1995-1", "1995-12", "1996-2"]);
  });

  it("throws when parameter data is missing", () => {
    expect(() => parsePowerResponse({})).toThrow();
  });
});
