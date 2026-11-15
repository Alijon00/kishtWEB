import { describe, expect, it } from "vitest";
import {
  clampValue,
  EARTH_M_PER_DEG_LAT,
  isSmallField,
  MAX_FIELD_HA,
  sampleGrid3x3,
  squareRing,
  squareSideM,
  steepShare,
  toHa,
  toM2,
} from "./fieldSize";

describe("unit conversion", () => {
  it("1 sotka = 100 m²", () => {
    expect(toM2(1, "sotka")).toBe(100);
  });

  it("1 ha = 10,000 m² = 100 sotka", () => {
    expect(toM2(1, "ha")).toBe(10_000);
    expect(toM2(1, "ha")).toBe(toM2(100, "sotka"));
  });

  it("1 km² = 1,000,000 m² = 100 ha", () => {
    expect(toM2(1, "km2")).toBe(1_000_000);
    expect(toM2(1, "km2")).toBe(toM2(100, "ha"));
  });

  it("50 sotka = 0.5 ha (the card example)", () => {
    expect(toHa(toM2(50, "sotka"))).toBeCloseTo(0.5, 10);
  });

  it("clamps to 2,500 ha (5 × 5 km) per unit", () => {
    expect(clampValue(99_999, "ha")).toBe(MAX_FIELD_HA);
    expect(clampValue(99_999, "km2")).toBe(25);
    expect(clampValue(9_999_999, "sotka")).toBe(250_000);
    expect(clampValue(1, "ha")).toBe(1);
    expect(clampValue(-5, "ha")).toBe(0);
  });

  it("flags fields under 25 ha as small (centre point only)", () => {
    expect(isSmallField(toM2(24, "ha"))).toBe(true);
    expect(isSmallField(toM2(25, "ha"))).toBe(false);
    expect(isSmallField(toM2(1, "ha"))).toBe(true);
  });
});

describe("square geometry", () => {
  it("side length is sqrt(area): 1 ha → 100 m", () => {
    expect(squareSideM(10_000)).toBeCloseTo(100, 6);
    expect(squareSideM(25_000_000)).toBeCloseTo(5_000, 6);
  });

  it("returns a closed 5-point ring centred on the pin", () => {
    const ring = squareRing(0, 0, 10_000);
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("a 1 ha square at the equator spans ±50 m ≈ ±0.000449°", () => {
    const ring = squareRing(0, 0, 10_000);
    const halfDeg = 50 / EARTH_M_PER_DEG_LAT;
    const [lon, lat] = ring[0];
    expect(lon).toBeCloseTo(-halfDeg, 9);
    expect(lat).toBeCloseTo(-halfDeg, 9);
    expect(ring[2][0]).toBeCloseTo(halfDeg, 9);
    expect(ring[2][1]).toBeCloseTo(halfDeg, 9);
  });

  it("longitude span widens with latitude (cos correction)", () => {
    const eq = squareRing(0, 0, 1_000_000);
    const north = squareRing(60, 0, 1_000_000);
    const eqWidth = eq[1][0] - eq[0][0];
    const nWidth = north[1][0] - north[0][0];
    // at 60°, cos = 0.5, so the same metric width needs ~2× the degrees
    expect(nWidth / eqWidth).toBeCloseTo(2, 2);
  });

  it("samples a 3×3 grid of 9 points inside the square", () => {
    const pts = sampleGrid3x3(0, 0, 90_000); // 300 m side, third = 100 m
    expect(pts).toHaveLength(9);
    // centre point is the pin itself
    expect(pts[4].lat).toBeCloseTo(0, 9);
    expect(pts[4].lon).toBeCloseTo(0, 9);
    // corner offset is one-third of the side (100 m) each way
    const oneThirdDeg = 100 / EARTH_M_PER_DEG_LAT;
    expect(pts[0].lat).toBeCloseTo(-oneThirdDeg, 9);
    expect(pts[8].lat).toBeCloseTo(oneThirdDeg, 9);
  });
});

describe("slope share (erosion rule)", () => {
  it("is the fraction of samples steeper than the threshold", () => {
    expect(steepShare([2, 3, 9, 10], 8)).toBeCloseTo(0.5, 10);
    expect(steepShare([1, 2, 3], 8)).toBe(0);
    expect(steepShare([9, 10, 11, 12], 8)).toBe(1);
  });

  it("uses an 8% default threshold", () => {
    expect(steepShare([7.9, 8.0, 8.1])).toBeCloseTo(1 / 3, 10);
  });

  it("returns 0 for no samples", () => {
    expect(steepShare([])).toBe(0);
  });
});
