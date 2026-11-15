import type { MonthlyRecord, Site } from "./types";

const FILL_VALUE = -999;

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SITES: Site[] = [
  { id: "vakhsh", name: "Vakhsh valley, Tajikistan", lat: 37.7, lon: 68.8 },
  { id: "sughd", name: "Sughd, Tajikistan", lat: 40.2, lon: 69.2 },
  { id: "hissar", name: "Hissar valley, Tajikistan", lat: 38.55, lon: 68.65 },
];

const CURRENT_YEAR = new Date().getFullYear();
const END_YEAR = CURRENT_YEAR - 1;
const START_YEAR = CURRENT_YEAR - 31;

export function powerUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
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

interface PowerResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

export function parsePowerResponse(json: PowerResponse): MonthlyRecord[] {
  const param = json?.properties?.parameter;
  if (!param || !param.T2M || !param.T2M_MAX || !param.PRECTOTCORR) {
    throw new Error("Unexpected NASA POWER response: missing parameter data.");
  }

  const t2m = param.T2M;
  const t2mMax = param.T2M_MAX;
  const precip = param.PRECTOTCORR;
  const gwet = param.GWETROOT;

  const records: MonthlyRecord[] = [];
  for (const key of Object.keys(t2m)) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    if (month === 13 || month < 1 || month > 12) continue;

    const tm = t2m[key];
    const tmx = t2mMax[key];
    const pr = precip[key];
    if (tm === FILL_VALUE || tmx === FILL_VALUE || pr === FILL_VALUE) continue;
    if (tm == null || tmx == null || pr == null) continue;

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

const CACHE_VERSION = "v3";

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
  }
}

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
