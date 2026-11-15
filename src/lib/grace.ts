import {
  GRACE_FALLING_MAX_CM_PER_YEAR,
  GRACE_RISING_MIN_CM_PER_YEAR,
} from "./rotation/constants";
import type { Groundwater } from "./rotation/types";

export interface GraceGrid {
  meta: {
    source: string;
    variable: string;
    quantity: string;
    units: string;
    trendPeriod: string;
    resolutionKm: number;
    [key: string]: unknown;
  };
  grid: {
    lat0: number;
    lon0: number;
    dlat: number;
    dlon: number;
    nlat: number;
    nlon: number;
    lonConvention: string;
  };
  values: (number | null)[][];
}

export type GraceCategory = "falling" | "stable" | "rising";

export interface GraceResult {
  trendCmPerYear: number;
  category: GraceCategory;
  groundwater: Groundwater;
  cell: { lat: number; lon: number };
}

export function classifyTrend(cmPerYear: number): GraceCategory {
  if (cmPerYear < GRACE_FALLING_MAX_CM_PER_YEAR) return "falling";
  if (cmPerYear > GRACE_RISING_MIN_CM_PER_YEAR) return "rising";
  return "stable";
}

export function toGroundwater(category: GraceCategory): Groundwater {
  return category === "falling" ? "falling" : category === "rising" ? "rising" : "stable";
}

const clampIndex = (idx: number, n: number) => Math.max(0, Math.min(n - 1, idx));

export function lookupGrace(
  grid: GraceGrid,
  lat: number,
  lon: number,
): GraceResult | null {
  const g = grid.grid;
  let lonQ = lon;
  if (g.lonConvention === "0..360" && lonQ < 0) lonQ += 360;

  const iRaw = Math.round((lat - g.lat0) / g.dlat);
  const jRaw = Math.round((lonQ - g.lon0) / g.dlon);

  if (iRaw < -1 || iRaw > g.nlat || jRaw < -1 || jRaw > g.nlon) return null;

  const i = clampIndex(iRaw, g.nlat);
  const j = clampIndex(jRaw, g.nlon);
  const value = grid.values[i]?.[j];
  if (value == null || !Number.isFinite(value)) return null;

  const category = classifyTrend(value);
  return {
    trendCmPerYear: value,
    category,
    groundwater: toGroundwater(category),
    cell: { lat: g.lat0 + i * g.dlat, lon: g.lon0 + j * g.dlon },
  };
}

const GRACE_URL = "/data/grace_trend.json";
let gridPromise: Promise<GraceGrid | null> | null = null;

export function loadGraceGrid(): Promise<GraceGrid | null> {
  if (!gridPromise) {
    gridPromise = fetch(GRACE_URL)
      .then((res) => (res.ok ? (res.json() as Promise<GraceGrid>) : null))
      .catch(() => null);
  }
  return gridPromise;
}

export async function fetchGraceTrend(
  lat: number,
  lon: number,
): Promise<GraceResult | null> {
  const grid = await loadGraceGrid();
  if (!grid) return null;
  return lookupGrace(grid, lat, lon);
}
