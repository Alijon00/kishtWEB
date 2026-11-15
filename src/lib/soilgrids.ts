import type { SoilProfile } from "./soil";

const ENDPOINT = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const TIMEOUT_MS = 15_000;

const DEPTH_WEIGHTS: Record<string, number> = {
  "0-5cm": 5,
  "5-15cm": 10,
  "15-30cm": 15,
};

export function soilGridsUrl(lat: number, lon: number): string {
  const params = new URLSearchParams();
  params.set("lon", String(lon));
  params.set("lat", String(lat));
  for (const p of ["soc", "phh2o", "clay", "sand", "silt"]) {
    params.append("property", p);
  }
  for (const d of ["0-5cm", "5-15cm", "15-30cm"]) {
    params.append("depth", d);
  }
  params.set("value", "mean");
  return `${ENDPOINT}?${params}`;
}

interface SoilGridsDepth {
  label: string;
  values: { mean: number | null };
}
interface SoilGridsLayer {
  name: string;
  unit_measure: { d_factor: number };
  depths: SoilGridsDepth[];
}
interface SoilGridsResponse {
  properties?: { layers?: SoilGridsLayer[] };
}

function weightedMean(layer: SoilGridsLayer): number | null {
  const d = layer.unit_measure?.d_factor || 1;
  let sum = 0;
  let weight = 0;
  for (const depth of layer.depths) {
    const w = DEPTH_WEIGHTS[depth.label];
    const mean = depth.values?.mean;
    if (w == null || mean == null) continue;
    sum += (mean / d) * w;
    weight += w;
  }
  return weight === 0 ? null : sum / weight;
}

export function parseSoilGrids(json: SoilGridsResponse): SoilProfile | null {
  const layers = json?.properties?.layers;
  if (!layers || layers.length === 0) return null;

  const byName = new Map<string, SoilGridsLayer>();
  for (const l of layers) byName.set(l.name, l);

  const clay = byName.get("clay");
  const sand = byName.get("sand");
  const silt = byName.get("silt");
  const ph = byName.get("phh2o");
  const soc = byName.get("soc");
  if (!clay || !sand || !silt || !ph || !soc) return null;

  const clayPct = weightedMean(clay);
  const sandPct = weightedMean(sand);
  const siltPct = weightedMean(silt);
  const phVal = weightedMean(ph);
  const socGkg = weightedMean(soc);

  if (
    clayPct == null ||
    sandPct == null ||
    siltPct == null ||
    phVal == null ||
    socGkg == null
  ) {
    return null;
  }

  return {
    clayPct,
    sandPct,
    siltPct,
    ph: phVal,
    socPct: socGkg / 10,
  };
}

const CACHE_VERSION = "v1";

function cacheKey(lat: number, lon: number): string {
  return `kisht:soil:${CACHE_VERSION}:${lat.toFixed(3)},${lon.toFixed(3)}`;
}

interface CachedSoil {
  profile: SoilProfile | null;
}

function readCache(lat: number, lon: number): CachedSoil | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon));
    return raw ? (JSON.parse(raw) as CachedSoil) : null;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, value: CachedSoil): void {
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify(value));
  } catch {
  }
}

export async function fetchSoil(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<SoilProfile | null> {
  const cached = readCache(lat, lon);
  if (cached) return cached.profile;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  opts.signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(soilGridsUrl(lat, lon), { signal: timeout.signal });
    if (!res.ok) {
      throw new Error(`SoilGrids request failed (HTTP ${res.status}).`);
    }
    const json = (await res.json()) as SoilGridsResponse;
    const profile = parseSoilGrids(json);
    writeCache(lat, lon, { profile });
    return profile;
  } catch (err) {
    if (timeout.signal.aborted && !opts.signal?.aborted) {
      throw new Error("Soil data request timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export const SOIL_SEARCH_RINGS_KM = [1, 2, 5];

export interface NearestSoil {
  profile: SoilProfile | null;
  distanceKm: number;
}

function ringPoints(lat: number, lon: number, km: number): { lat: number; lon: number }[] {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  return [
    { lat: lat + dLat, lon },
    { lat, lon: lon + dLon },
    { lat: lat - dLat, lon },
    { lat, lon: lon - dLon },
  ];
}

export async function fetchSoilNearest(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<NearestSoil> {
  const atPoint = await fetchSoil(lat, lon, opts);
  if (atPoint) return { profile: atPoint, distanceKm: 0 };

  for (const km of SOIL_SEARCH_RINGS_KM) {
    const results = await Promise.all(
      ringPoints(lat, lon, km).map((p) => fetchSoil(p.lat, p.lon, opts).catch(() => null)),
    );
    const hit = results.find((r) => r != null) ?? null;
    if (hit) return { profile: hit, distanceKm: km };
  }
  return { profile: null, distanceKm: 0 };
}
