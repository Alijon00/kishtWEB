/**
 * GRACE / GRACE-FO total-water-storage trend lookup.
 *
 * The browser can't read the raw NetCDF (it's gigabytes behind a NASA Earthdata
 * login), so `scripts/grace/build.py` precomputes a small grid of linear trends
 * (cm/year, 2003–2024) into public/data/grace_trend.json. This module finds the
 * nearest cell for a point and classifies the trend.
 *
 * HONESTY: this is TOTAL water storage — groundwater + soil moisture + snow +
 * surface water — at ~300 km resolution. It is NOT a well-water level. The UI
 * wording ("Water stored underground and in soil") reflects that.
 */

import {
  GRACE_FALLING_MAX_CM_PER_YEAR,
  GRACE_RISING_MIN_CM_PER_YEAR,
} from "./rotation/constants";
import type { Groundwater } from "./rotation/types";

/** Shape of public/data/grace_trend.json (see scripts/grace/build.py). */
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
  /** values[i][j] = trend (cm/yr) at lat0 + i*dlat, lon0 + j*dlon; null = no data. */
  values: (number | null)[][];
}

export type GraceCategory = "falling" | "stable" | "rising";

export interface GraceResult {
  /** Trend in cm/year of liquid-water-equivalent thickness. */
  trendCmPerYear: number;
  category: GraceCategory;
  /** The engine's groundwater enum (rising/stable both map to no penalty). */
  groundwater: Groundwater;
  /** Centre of the grid cell actually used. */
  cell: { lat: number; lon: number };
}

/** Classify a trend (cm/yr) into falling / stable / rising. */
export function classifyTrend(cmPerYear: number): GraceCategory {
  if (cmPerYear < GRACE_FALLING_MAX_CM_PER_YEAR) return "falling";
  if (cmPerYear > GRACE_RISING_MIN_CM_PER_YEAR) return "rising";
  return "stable";
}

/** The engine only penalises "falling"; rising/stable carry no penalty. */
export function toGroundwater(category: GraceCategory): Groundwater {
  return category === "falling" ? "falling" : category === "rising" ? "rising" : "stable";
}

const clampIndex = (idx: number, n: number) => Math.max(0, Math.min(n - 1, idx));

/**
 * Nearest-cell lookup. Returns null when the point lies outside the grid's
 * region or the nearest cell has no data (ocean/fill) — callers treat null as
 * "unknown".
 */
export function lookupGrace(
  grid: GraceGrid,
  lat: number,
  lon: number,
): GraceResult | null {
  const g = grid.grid;
  // Normalise longitude to the grid's convention.
  let lonQ = lon;
  if (g.lonConvention === "0..360" && lonQ < 0) lonQ += 360;

  const iRaw = Math.round((lat - g.lat0) / g.dlat);
  const jRaw = Math.round((lonQ - g.lon0) / g.dlon);

  // If the point is well outside the grid, don't pretend we have data.
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

// --- Browser fetch (cached) --------------------------------------------------

const GRACE_URL = "/data/grace_trend.json";
let gridPromise: Promise<GraceGrid | null> | null = null;

/**
 * Load the precomputed grid once and cache it. Returns null (not an error) when
 * the file isn't there yet — the app then shows groundwater as "unknown" and
 * keeps working, exactly as before Part 4's data step.
 */
export function loadGraceGrid(): Promise<GraceGrid | null> {
  if (!gridPromise) {
    gridPromise = fetch(GRACE_URL)
      .then((res) => (res.ok ? (res.json() as Promise<GraceGrid>) : null))
      .catch(() => null);
  }
  return gridPromise;
}

/** Convenience: load the grid (cached) and look up one point. */
export async function fetchGraceTrend(
  lat: number,
  lon: number,
): Promise<GraceResult | null> {
  const grid = await loadGraceGrid();
  if (!grid) return null;
  return lookupGrace(grid, lat, lon);
}
