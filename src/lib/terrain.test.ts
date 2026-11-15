import { describe, expect, it } from "vitest";
import {
  decodeElevation,
  groundResolutionM,
  lonLatToTilePixel,
  slopePctFromWindow,
  terrainFromPixels,
  terrainSquareFromPixels,
  TERRAIN_ZOOM,
} from "./terrain";

// Terrarium RGB for an integer elevation (inverse of decodeElevation, B = 0).
function encodeElevation(e: number): [number, number, number] {
  const n = e + 32768;
  return [Math.floor(n / 256), n % 256, 0];
}

// Build a WxW RGBA tile whose elevation is `elev(col,row)` metres.
function tile(width: number, elev: (col: number, row: number) => number): Uint8Array {
  const data = new Uint8Array(width * width * 4);
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const [r, g, b] = encodeElevation(elev(col, row));
      const i = (row * width + col) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe("decodeElevation", () => {
  it("uses the terrarium formula R*256 + G + B/256 − 32768", () => {
    expect(decodeElevation(128, 0, 0)).toBe(0);
    expect(decodeElevation(129, 0, 0)).toBe(256);
    expect(decodeElevation(128, 0, 128)).toBe(0.5);
    expect(decodeElevation(128, 100, 0)).toBe(100);
  });
});

describe("slopePctFromWindow (Horn's method)", () => {
  it("is 0 on a flat window", () => {
    const flat = [
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ];
    expect(slopePctFromWindow(flat, 30)).toBe(0);
  });

  it("gives 100% when elevation rises one cell-size per pixel in x", () => {
    const ramp = [
      [0, 10, 20],
      [0, 10, 20],
      [0, 10, 20],
    ];
    expect(slopePctFromWindow(ramp, 10)).toBeCloseTo(100, 6);
  });

  it("combines x and y gradients", () => {
    const ramp = [
      [0, 10, 20],
      [10, 20, 30],
      [20, 30, 40],
    ];
    expect(slopePctFromWindow(ramp, 10)).toBeCloseTo(Math.sqrt(2) * 100, 4);
  });
});

describe("groundResolutionM", () => {
  it("is ~38 m/pixel at zoom 12 on the equator", () => {
    expect(groundResolutionM(0, 12)).toBeCloseTo(38.2, 1);
  });

  it("shrinks with the cosine of latitude", () => {
    expect(groundResolutionM(60, 12)).toBeCloseTo(groundResolutionM(0, 12) * 0.5, 1);
  });
});

describe("lonLatToTilePixel", () => {
  it("maps a known point into a valid tile and in-range pixel", () => {
    const n = 2 ** TERRAIN_ZOOM;
    const t = lonLatToTilePixel(-0.3, 36.07, TERRAIN_ZOOM);
    expect(Number.isInteger(t.tileX)).toBe(true);
    expect(Number.isInteger(t.tileY)).toBe(true);
    expect(t.tileX).toBeGreaterThanOrEqual(0);
    expect(t.tileX).toBeLessThan(n);
    expect(t.tileY).toBeGreaterThanOrEqual(0);
    expect(t.tileY).toBeLessThan(n);
    expect(t.px).toBeGreaterThanOrEqual(0);
    expect(t.px).toBeLessThan(256);
    expect(t.py).toBeGreaterThanOrEqual(0);
    expect(t.py).toBeLessThan(256);
  });
});

describe("terrainFromPixels", () => {
  it("reads the centre pixel's elevation and slope from a 5×5 RGB buffer ramp", () => {
    const width = 5;
    const channels = 3;
    const cols = [0, 10, 20, 30, 40];
    const data: number[] = [];
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) data.push(128, cols[x], 0);
    }
    const res = terrainFromPixels(data, width, 2, 2, 10, channels);
    expect(res.elevationM).toBe(20);
    expect(res.slopePct).toBeCloseTo(100, 1);
  });

  it("reads flat (near-0 %) land even with single-pixel noise", () => {
    const width = 5;
    const noise = [
      [0, 1, -1, 0, 1],
      [-1, 0, 1, 0, -1],
      [1, -1, 0, 1, 0],
      [0, 1, 0, -1, 1],
      [-1, 0, 1, 0, 0],
    ];
    const data: number[] = [];
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) data.push(128, 100 + noise[y][x], 0);
    }
    const res = terrainFromPixels(data, width, 2, 2, 65, 3);
    expect(res.slopePct).toBeLessThan(2);
  });

  it("rounds elevation to a whole metre and slope to one decimal", () => {
    const width = 5;
    const data: number[] = [];
    for (let i = 0; i < width * width; i++) data.push(128, 42, 64);
    const res = terrainFromPixels(data, width, 2, 2, 30, 3);
    expect(res.elevationM).toBe(42);
    expect(res.slopePct).toBe(0);
  });
});

describe("terrainSquareFromPixels (slope share across the field)", () => {
  const CELL = 30;
  const WIDTH = 64;

  it("a uniform 15% plane reads 100% of the field steeper than 8%", () => {
    // elevation ramps 0.15 m per metre east → 15% slope everywhere
    const data = tile(WIDTH, (col) => Math.round(0.15 * col * CELL));
    const res = terrainSquareFromPixels(data, WIDTH, 32, 32, CELL, 20);
    expect(res.steepSharePct).toBe(100);
    expect(res.maxSlopePct).toBeGreaterThan(8);
    expect(res.meanSlopePct).toBeGreaterThan(8);
  });

  it("a flat field reads 0% steep", () => {
    const data = tile(WIDTH, () => 1000);
    const res = terrainSquareFromPixels(data, WIDTH, 32, 32, CELL, 20);
    expect(res.steepSharePct).toBe(0);
    expect(res.maxSlopePct).toBe(0);
    expect(res.meanSlopePct).toBe(0);
  });

  it("half-steep field reads a partial share", () => {
    // flat west of centre, 15% ramp east of centre
    const data = tile(WIDTH, (col) => (col < 32 ? 1000 : Math.round(1000 + 0.15 * (col - 32) * CELL)));
    const res = terrainSquareFromPixels(data, WIDTH, 32, 32, CELL, 20);
    expect(res.steepSharePct).toBeGreaterThan(20);
    expect(res.steepSharePct).toBeLessThan(80);
  });

  it("a tiny field (sub-pixel span) collapses to the centre point", () => {
    const data = tile(WIDTH, (col) => Math.round(0.15 * col * CELL));
    const res = terrainSquareFromPixels(data, WIDTH, 32, 32, CELL, 0.2);
    expect(res.steepSharePct).toBe(100); // centre pixel is on the 15% plane
    expect(res.meanSlopePct).toBe(res.slopePct);
  });
});
