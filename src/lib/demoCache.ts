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

export const DEMO_POINTS: ExamplePoint[] = [
  { id: "vakhsh", lat: 37.7, lon: 68.8 },
  { id: "punjab", lat: 30.80, lon: 75.65 },
  { id: "nakuru", lat: -0.3, lon: 36.07 },
];

const MATCH_TOLERANCE_DEG = 0.05;

export function matchExample(lat: number, lon: number): string | null {
  for (const p of DEMO_POINTS) {
    if (Math.abs(p.lat - lat) <= MATCH_TOLERANCE_DEG && Math.abs(p.lon - lon) <= MATCH_TOLERANCE_DEG) {
      return p.id;
    }
  }
  return null;
}

export const DEMO_SOIL_RADIUS_KM = 5;

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function nearestDemoWithin(
  lat: number,
  lon: number,
  maxKm = DEMO_SOIL_RADIUS_KM,
): string | null {
  let best: string | null = null;
  let bestKm = Infinity;
  for (const p of DEMO_POINTS) {
    const km = haversineKm(lat, lon, p.lat, p.lon);
    if (km <= maxKm && km < bestKm) {
      best = p.id;
      bestKm = km;
    }
  }
  return best;
}

interface DemoBundle {
  id: string;
  lat: number;
  lon: number;
  fetchedAt: string;
  power: unknown;
  soil: unknown;
  grace: GraceResult | null;
  terrain?: TerrainResult | null;
}

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

export async function loadDemoSoil(id: string): Promise<{ profile: SoilProfile | null } | null> {
  const b = await loadBundle(id);
  if (!b) return null;
  if (b.soil == null) return { profile: null };
  return { profile: parseSoilGrids(b.soil as Parameters<typeof parseSoilGrids>[0]) };
}

export async function loadDemoGrace(id: string): Promise<GraceResult | null> {
  const b = await loadBundle(id);
  return b?.grace ?? null;
}

export async function loadDemoTerrain(id: string): Promise<TerrainResult | null> {
  const b = await loadBundle(id);
  return b?.terrain ?? null;
}

export const DEMO_FALLBACK_TIMEOUT_MS = 8_000;
