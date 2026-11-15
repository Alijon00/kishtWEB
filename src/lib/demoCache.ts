/**
 * Offline demo cache for the three example fields.
 *
 * On-site at a hackathon the venue Wi-Fi may be flaky, so for the three example
 * points we ship pre-fetched NASA POWER / SoilGrids / GRACE responses in
 * public/data/demo/{id}.json. When a live API call for an example point fails or
 * doesn't answer within the timeout, the hooks fall back to these files and flag
 * the data as cached, so the whole 5-step flow still works with no network
 * (only the map tiles, which come from a tile server, won't load — expected).
 *
 * The files are produced OFFLINE by scripts/demo/build-demo-cache.ts (run with
 * network once) — never hand-edited, never fabricated.
 */

import { parsePowerResponse } from "./nasaPower";
import { parseSoilGrids } from "./soilgrids";
import type { MonthlyRecord } from "./types";
import type { SoilProfile } from "./soil";
import type { GraceResult } from "./grace";
import type { TerrainResult } from "./terrain";

export interface ExamplePoint {
  id: string;
  lat: number;
  lon: number;
}

/**
 * The example fields that ship with a demo cache. Must stay in sync with
 * EXAMPLE_SITES in src/state/field.tsx (kept separate so this data-layer module
 * doesn't depend on the React state layer).
 */
export const DEMO_POINTS: ExamplePoint[] = [
  { id: "vakhsh", lat: 37.7, lon: 68.8 },
  { id: "punjab", lat: 30.80, lon: 75.65 },
  { id: "nakuru", lat: -0.3, lon: 36.07 },
];

/** ~5 km. Picking an example (chip or map) lands exactly on these coordinates. */
const MATCH_TOLERANCE_DEG = 0.05;

/** The example id whose coordinates match this point, or null. */
export function matchExample(lat: number, lon: number): string | null {
  for (const p of DEMO_POINTS) {
    if (Math.abs(p.lat - lat) <= MATCH_TOLERANCE_DEG && Math.abs(p.lon - lon) <= MATCH_TOLERANCE_DEG) {
      return p.id;
    }
  }
  return null;
}

/** Shape of public/data/demo/{id}.json (see scripts/demo/build-demo-cache.ts). */
interface DemoBundle {
  id: string;
  lat: number;
  lon: number;
  fetchedAt: string;
  /** Raw NASA POWER monthly response (fed through parsePowerResponse). */
  power: unknown;
  /** Raw SoilGrids response, or null if the point has no soil data. */
  soil: unknown;
  /** Pre-computed GRACE-FO trend lookup, or null. */
  grace: GraceResult | null;
  /** Pre-computed SRTM elevation/slope (AWS Terrain Tiles), or null. */
  terrain?: TerrainResult | null;
}

// One in-flight fetch per id, cached for the session.
const bundles = new Map<string, Promise<DemoBundle | null>>();

function loadBundle(id: string): Promise<DemoBundle | null> {
  let p = bundles.get(id);
  if (!p) {
    p = fetch(`/data/demo/${id}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<DemoBundle>) : null))
      .catch(() => null);
    bundles.set(id, p);
  }
  return p;
}

/** Cached NASA POWER monthly records for an example point, or null. */
export async function loadDemoClimate(id: string): Promise<MonthlyRecord[] | null> {
  const b = await loadBundle(id);
  if (!b || b.power == null) return null;
  try {
    const records = parsePowerResponse(b.power as Parameters<typeof parsePowerResponse>[0]);
    return records.length > 0 ? records : null;
  } catch {
    return null;
  }
}

/**
 * Cached soil profile for an example point. Returns `{ profile }` (profile may
 * be null for a genuine no-soil point) so the caller can tell "cached, no soil"
 * from "no cache file" (this function returns null for the latter).
 */
export async function loadDemoSoil(id: string): Promise<{ profile: SoilProfile | null } | null> {
  const b = await loadBundle(id);
  if (!b) return null;
  if (b.soil == null) return { profile: null };
  return { profile: parseSoilGrids(b.soil as Parameters<typeof parseSoilGrids>[0]) };
}

/** Cached GRACE-FO trend for an example point, or null. */
export async function loadDemoGrace(id: string): Promise<GraceResult | null> {
  const b = await loadBundle(id);
  return b?.grace ?? null;
}

/** Cached SRTM terrain (elevation/slope) for an example point, or null. */
export async function loadDemoTerrain(id: string): Promise<TerrainResult | null> {
  const b = await loadBundle(id);
  return b?.terrain ?? null;
}

/** How long to wait for a live API before falling back to the demo cache. */
export const DEMO_FALLBACK_TIMEOUT_MS = 8_000;
