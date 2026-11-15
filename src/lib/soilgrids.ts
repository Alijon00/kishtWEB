import type { SoilProfile } from "./soil";

/**
 * SoilGrids (ISRIC) query + parsing. Values come back as integers that must be
 * divided by a per-property `d_factor`, then averaged over the 0–30 cm root
 * zone weighted by layer thickness (5, 10, 15 cm).
 */

const ENDPOINT = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const TIMEOUT_MS = 15_000;

/** Layer thicknesses (cm) for the three 0–30 cm depth bands, used as weights. */
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

/**
 * Thickness-weighted mean of a layer's 0–30 cm depths, already divided by the
 * property's d_factor. Returns null if no usable (non-null) depth exists.
 */
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

/**
 * Parse a SoilGrids response into a unit-normalized 0–30 cm profile.
 * Returns null if the point has no soil data (ocean, ice, missing layers) —
 * the caller shows a friendly "no farmland data here" message.
 */
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

  const clayPct = weightedMean(clay); // g/kg -> % (d_factor 10)
  const sandPct = weightedMean(sand);
  const siltPct = weightedMean(silt);
  const phVal = weightedMean(ph); // pH*10 -> pH (d_factor 10)
  const socGkg = weightedMean(soc); // dg/kg -> g/kg (d_factor 10)

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
    // g/kg of organic carbon -> % by mass (10 g/kg = 1%).
    socPct: socGkg / 10,
  };
}

const CACHE_VERSION = "v1";

function cacheKey(lat: number, lon: number): string {
  return `kisht:soil:${CACHE_VERSION}:${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/** Cached result wrapper: we cache "no data" too, so we don't re-hit a slow API. */
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
    // best-effort
  }
}

/**
 * Fetch and parse the 0–30 cm soil profile for a point.
 * - 15 s timeout (SoilGrids can be slow / rate-limited).
 * - localStorage cache keyed by coordinates rounded to 3 decimals.
 * - Resolves to null (not a throw) when the point simply has no soil data.
 * - Throws only on network / timeout / HTTP errors so the UI can offer retry.
 */
export async function fetchSoil(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<SoilProfile | null> {
  const cached = readCache(lat, lon);
  if (cached) return cached.profile;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  // Abort if either our timeout or the caller's signal fires.
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

// --- Nearest-farmland fallback ----------------------------------------------
// SoilGrids returns no profile for built-up / water pixels. When the chosen
// point has none, we probe rings at 1, 2 and 5 km and use the nearest valid
// profile, reporting how far away it was ("nearest farmland soil, 2 km away").

/** Radii (km) searched outward when the point itself has no soil data. */
export const SOIL_SEARCH_RINGS_KM = [1, 2, 5];

export interface NearestSoil {
  profile: SoilProfile | null;
  /** 0 when the point itself had soil; otherwise the ring radius (km) used. */
  distanceKm: number;
}

/** Four compass points `km` away from (lat, lon), with cos(lat) longitude scaling. */
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

/**
 * Soil for a point, falling back to the nearest valid farmland pixel within 5 km.
 * Throws (like fetchSoil) only if the point itself errors on the network; ring
 * probes that error are treated as "no soil there" and skipped.
 */
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
