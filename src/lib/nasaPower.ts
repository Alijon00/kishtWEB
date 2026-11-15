import type { MonthlyRecord, Site } from "./types";

/** NASA POWER fill value for "no data". */
const FILL_VALUE = -999;

/** Days per month, index 1–12. Index 0 unused. NASA POWER monthly values are
 * long-term climatological means, so a fixed non-leap calendar is accurate
 * enough for converting mm/day → mm/month. */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The three demo fields. Coordinates are hard-coded for Part 1 (no map yet). */
export const SITES: Site[] = [
  { id: "vakhsh", name: "Vakhsh valley, Tajikistan", lat: 37.7, lon: 68.8 },
  { id: "punjab", name: "Punjab, India", lat: 30.80, lon: 75.65 },
  { id: "nakuru", name: "Kenya, Nakuru", lat: -0.3, lon: 36.07 },
];

const START_YEAR = 1995;
const END_YEAR = 2024;

export function powerUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    // GWETROOT = root-zone soil wetness (0–1), from MERRA-2 — available in the
    // monthly API for community=AG. Drives the soil-moisture card + rule (Part 5).
    parameters: "T2M,T2M_MAX,PRECTOTCORR,GWETROOT",
    community: "AG",
    latitude: String(lat),
    longitude: String(lon),
    start: String(START_YEAR),
    end: String(END_YEAR),
    format: "JSON",
  });
  return `https://power.larc.nasa.gov/api/temporal/monthly/point?${params}`;
}

/** Shape of the parts of the NASA POWER response we rely on. */
interface PowerResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

/**
 * Turn a raw NASA POWER monthly response into clean, unit-normalized records.
 *
 * - Keys are "YYYYMM"; the "YYYY13" annual rollup is skipped.
 * - -999 fill values cause that whole month to be dropped (we never want a
 *   sentinel leaking into an average).
 * - Precipitation is converted from mm/day to mm for the calendar month.
 */
export function parsePowerResponse(json: PowerResponse): MonthlyRecord[] {
  const param = json?.properties?.parameter;
  if (!param || !param.T2M || !param.T2M_MAX || !param.PRECTOTCORR) {
    throw new Error("Unexpected NASA POWER response: missing parameter data.");
  }

  const t2m = param.T2M;
  const t2mMax = param.T2M_MAX;
  const precip = param.PRECTOTCORR;
  // GWETROOT is optional: older cached responses were fetched without it.
  const gwet = param.GWETROOT;

  const records: MonthlyRecord[] = [];
  for (const key of Object.keys(t2m)) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    if (month === 13 || month < 1 || month > 12) continue; // annual rollup / bad key

    const tm = t2m[key];
    const tmx = t2mMax[key];
    const pr = precip[key];
    if (tm === FILL_VALUE || tmx === FILL_VALUE || pr === FILL_VALUE) continue;
    if (tm == null || tmx == null || pr == null) continue;

    // Root-zone soil wetness — only kept when present and not a fill value, so a
    // month missing GWETROOT still contributes its temperature/rain.
    const gw = gwet?.[key];
    const gwetroot = gw == null || gw === FILL_VALUE ? undefined : gw;

    records.push({
      year,
      month,
      t2m: tm,
      t2mMax: tmx,
      precipMm: pr * DAYS_IN_MONTH[month],
      ...(gwetroot !== undefined ? { gwetroot } : {}),
    });
  }

  records.sort((a, b) => a.year - b.year || a.month - b.month);
  return records;
}

// v2 adds GWETROOT (root-zone soil wetness) to each record; bump so returning
// users re-fetch instead of reading v1 records that lack soil moisture.
const CACHE_VERSION = "v2";

function cacheKey(lat: number, lon: number): string {
  return `kisht:power:${CACHE_VERSION}:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function readCache(lat: number, lon: number): MonthlyRecord[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MonthlyRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, records: MonthlyRecord[]): void {
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify(records));
  } catch {
    // Storage full or unavailable — caching is best-effort, ignore.
  }
}

/**
 * Fetch monthly climate records for a point, using localStorage as a cache so
 * the demo keeps working offline once a site has been loaded.
 */
export async function fetchMonthly(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<MonthlyRecord[]> {
  const cached = readCache(lat, lon);
  if (cached) return cached;

  const res = await fetch(powerUrl(lat, lon), { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`NASA POWER request failed (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as PowerResponse;
  const records = parsePowerResponse(json);
  if (records.length === 0) {
    throw new Error("NASA POWER returned no usable data for this point.");
  }
  writeCache(lat, lon, records);
  return records;
}
