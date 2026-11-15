export type SizeUnit = "sotka" | "ha" | "km2";

export const M2_PER_UNIT: Record<SizeUnit, number> = {
  sotka: 100,
  ha: 10_000,
  km2: 1_000_000,
};

export const DEFAULT_SIZE_VALUE = 1;
export const DEFAULT_SIZE_UNIT: SizeUnit = "ha";

export const MAX_FIELD_HA = 2_500;
export const MAX_FIELD_M2 = MAX_FIELD_HA * M2_PER_UNIT.ha;

export const SMALL_FIELD_HA = 25;
export const SMALL_FIELD_M2 = SMALL_FIELD_HA * M2_PER_UNIT.ha;

export const STEEP_SLOPE_PCT = 8;
export const EROSION_FIELD_SHARE = 0.25;

export const EARTH_M_PER_DEG_LAT = 111_320;

export function isSizeUnit(x: string): x is SizeUnit {
  return x === "sotka" || x === "ha" || x === "km2";
}

export function toM2(value: number, unit: SizeUnit): number {
  return value * M2_PER_UNIT[unit];
}

export function toHa(m2: number): number {
  return m2 / M2_PER_UNIT.ha;
}

export function toUnit(m2: number, unit: SizeUnit): number {
  return m2 / M2_PER_UNIT[unit];
}

export function fmtArea(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = n >= 100 ? Math.round(n) : Number(n.toPrecision(3));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function clampM2(m2: number): number {
  if (!(m2 > 0)) return M2_PER_UNIT.ha;
  return Math.min(m2, MAX_FIELD_M2);
}

export function clampValue(value: number, unit: SizeUnit): number {
  const maxForUnit = MAX_FIELD_M2 / M2_PER_UNIT[unit];
  if (!(value > 0)) return 0;
  return Math.min(value, maxForUnit);
}

export function isSmallField(m2: number): boolean {
  return m2 < SMALL_FIELD_M2;
}

function mPerDegLon(lat: number): number {
  return EARTH_M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export interface LatLon {
  lat: number;
  lon: number;
}

export function squareSideM(m2: number): number {
  return Math.sqrt(m2);
}

export function squareRing(lat: number, lon: number, m2: number): [number, number][] {
  const half = squareSideM(m2) / 2;
  const dLat = half / EARTH_M_PER_DEG_LAT;
  const dLon = half / mPerDegLon(lat);
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
}

export function sampleGrid3x3(lat: number, lon: number, m2: number): LatLon[] {
  const third = squareSideM(m2) / 3;
  const offsets = [-third, 0, third];
  const mLat = EARTH_M_PER_DEG_LAT;
  const mLon = mPerDegLon(lat);
  const points: LatLon[] = [];
  for (const dy of offsets) {
    for (const dx of offsets) {
      points.push({ lat: lat + dy / mLat, lon: lon + dx / mLon });
    }
  }
  return points;
}

export function steepShare(
  slopePcts: number[],
  threshold = STEEP_SLOPE_PCT,
): number {
  if (slopePcts.length === 0) return 0;
  const steep = slopePcts.filter((s) => s > threshold).length;
  return steep / slopePcts.length;
}
