import { describe, expect, it } from "vitest";
import { classifyTrend, lookupGrace, toGroundwater, type GraceGrid } from "./grace";

// A tiny 3×3 fixture: lat 30–32, lon 68–70, 1° cells.
const GRID: GraceGrid = {
  meta: {
    source: "test",
    variable: "lwe_thickness",
    quantity: "total water storage",
    units: "cm/year",
    trendPeriod: "2003..2024",
    resolutionKm: 300,
  },
  grid: { lat0: 30, lon0: 68, dlat: 1, dlon: 1, nlat: 3, nlon: 3, lonConvention: "-180..180" },
  values: [
    [-2.5, -0.3, 1.8], // lat 30
    [null, 0.0, -1.0], // lat 31
    [3.0, -4.2, 0.5], // lat 32
  ],
};

describe("classifyTrend", () => {
  it("uses the ±1 cm/yr bands", () => {
    expect(classifyTrend(-2.5)).toBe("falling");
    expect(classifyTrend(-1.0)).toBe("stable"); // boundary: not < -1
    expect(classifyTrend(-0.3)).toBe("stable");
    expect(classifyTrend(1.0)).toBe("stable"); // boundary: not > 1
    expect(classifyTrend(1.8)).toBe("rising");
  });
});

describe("toGroundwater", () => {
  it("only 'falling' maps to the penalised enum", () => {
    expect(toGroundwater("falling")).toBe("falling");
    expect(toGroundwater("stable")).toBe("stable");
    expect(toGroundwater("rising")).toBe("rising");
  });
});

describe("lookupGrace", () => {
  it("snaps to the nearest cell and reports its trend", () => {
    const r = lookupGrace(GRID, 30.1, 68.1);
    expect(r).not.toBeNull();
    expect(r!.trendCmPerYear).toBe(-2.5);
    expect(r!.category).toBe("falling");
    expect(r!.groundwater).toBe("falling");
    expect(r!.cell).toEqual({ lat: 30, lon: 68 });
  });

  it("reports rising where the column is gaining water", () => {
    const r = lookupGrace(GRID, 30.0, 70.0);
    expect(r!.category).toBe("rising");
    expect(r!.groundwater).toBe("rising");
  });

  it("returns null for a no-data (null) cell", () => {
    expect(lookupGrace(GRID, 31.0, 68.0)).toBeNull();
  });

  it("returns null for a point outside the grid region", () => {
    expect(lookupGrace(GRID, 50, 68)).toBeNull();
    expect(lookupGrace(GRID, 31, 120)).toBeNull();
  });
});
