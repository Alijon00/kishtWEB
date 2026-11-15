import type { MonthlyRecord } from "./types";

export const BASELINE: [number, number] = [1995, 2004];
export const RECENT: [number, number] = [2015, 2024];

const SUMMER_MONTHS = [6, 7, 8];

const HOT_MONTH_THRESHOLD_C = 35;

const mean = (xs: number[]): number =>
  xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

const inPeriod = (year: number, [start, end]: [number, number]): boolean =>
  year >= start && year <= end;

const isSummer = (r: MonthlyRecord): boolean => SUMMER_MONTHS.includes(r.month);

const MONTHS_IN_YEAR = 12;

export function completeYears(records: MonthlyRecord[]): Set<number> {
  const count = new Map<number, number>();
  for (const r of records) count.set(r.year, (count.get(r.year) ?? 0) + 1);
  return new Set(
    [...count.entries()].filter(([, c]) => c === MONTHS_IN_YEAR).map(([y]) => y),
  );
}

export function dropPartialYears(records: MonthlyRecord[]): MonthlyRecord[] {
  const keep = completeYears(records);
  return records.filter((r) => keep.has(r.year));
}

export function summerMeanTemp(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  return mean(
    records.filter((r) => isSummer(r) && inPeriod(r.year, period)).map((r) => r.t2m),
  );
}

export function summerTempChange(records: MonthlyRecord[]): number {
  return summerMeanTemp(records, RECENT) - summerMeanTemp(records, BASELINE);
}

export function summerMeanTmax(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  return mean(
    records
      .filter((r) => isSummer(r) && inPeriod(r.year, period))
      .map((r) => r.t2mMax),
  );
}

export function annualPrecipMean(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  const byYear = new Map<number, number>();
  for (const r of records) {
    if (!inPeriod(r.year, period)) continue;
    byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.precipMm);
  }
  return mean([...byYear.values()]);
}

export function annualPrecipChangePct(records: MonthlyRecord[]): number {
  const base = annualPrecipMean(records, BASELINE);
  const recent = annualPrecipMean(records, RECENT);
  if (!(base > 0)) return NaN;
  return ((recent - base) / base) * 100;
}

export function hotMonthCount(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  return records.filter(
    (r) => inPeriod(r.year, period) && r.t2mMax > HOT_MONTH_THRESHOLD_C,
  ).length;
}

export function hotMonthChange(records: MonthlyRecord[]): number {
  return hotMonthCount(records, RECENT) - hotMonthCount(records, BASELINE);
}

export interface YearlySummerTemp {
  year: number;
  temp: number;
}

export function yearlySummerTemps(records: MonthlyRecord[]): YearlySummerTemp[] {
  const byYear = new Map<number, number[]>();
  for (const r of records) {
    if (!isSummer(r)) continue;
    const arr = byYear.get(r.year) ?? [];
    arr.push(r.t2m);
    byYear.set(r.year, arr);
  }
  return [...byYear.entries()]
    .map(([year, temps]) => ({ year, temp: mean(temps) }))
    .filter((p) => !Number.isNaN(p.temp))
    .sort((a, b) => a.year - b.year);
}

export interface LinearFit {
  slopePerYear: number;
  slopePerDecade: number;
  intercept: number;
}

export function summerTrend(records: MonthlyRecord[]): LinearFit {
  const points = yearlySummerTemps(records);
  const n = points.length;
  if (n < 2) return { slopePerYear: NaN, slopePerDecade: NaN, intercept: NaN };

  const xs = points.map((p) => p.year);
  const ys = points.map((p) => p.temp);
  const mx = mean(xs);
  const my = mean(ys);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slopePerYear = den === 0 ? NaN : num / den;
  const intercept = my - slopePerYear * mx;
  return { slopePerYear, slopePerDecade: slopePerYear * 10, intercept };
}

export interface MonthlyPrecip {
  month: number;
  precipMm: number;
}

export function monthlyPrecipProfile(
  records: MonthlyRecord[],
  period: [number, number],
): MonthlyPrecip[] {
  const buckets: number[][] = Array.from({ length: 13 }, () => []);
  for (const r of records) {
    if (!inPeriod(r.year, period)) continue;
    buckets[r.month].push(r.precipMm);
  }
  const out: MonthlyPrecip[] = [];
  for (let m = 1; m <= 12; m++) {
    out.push({ month: m, precipMm: buckets[m].length ? mean(buckets[m]) : 0 });
  }
  return out;
}

export const TROPICS_LAT_DEG = 23.5;

export interface SeasonClimate {
  months: number[];
  meanTempC: number;
  rainMm: number;
}

export interface SeasonalClimate {
  kind: "temperate" | "tropical";
  summer: SeasonClimate;
  winter: SeasonClimate;
}

function monthlyAggregates(records: MonthlyRecord[], period: [number, number]) {
  const rainSum = Array(13).fill(0);
  const rainN = Array(13).fill(0);
  const tempSum = Array(13).fill(0);
  const tempN = Array(13).fill(0);
  for (const r of records) {
    if (!inPeriod(r.year, period)) continue;
    rainSum[r.month] += r.precipMm;
    rainN[r.month]++;
    tempSum[r.month] += r.t2m;
    tempN[r.month]++;
  }
  const rain = Array(13).fill(0);
  const temp = Array(13).fill(0);
  for (let m = 1; m <= 12; m++) {
    rain[m] = rainN[m] ? rainSum[m] / rainN[m] : 0;
    temp[m] = tempN[m] ? tempSum[m] / tempN[m] : 0;
  }
  return { rain, temp };
}

function windowMonths(start: number): number[] {
  return [0, 1, 2].map((i) => ((start - 1 + i) % 12) + 1);
}

function season(months: number[], rain: number[], temp: number[]): SeasonClimate {
  return {
    months,
    rainMm: months.reduce((s, m) => s + rain[m], 0),
    meanTempC: mean(months.map((m) => temp[m])),
  };
}

export function deriveSeasonalClimate(
  records: MonthlyRecord[],
  lat: number,
): SeasonalClimate {
  const { rain, temp } = monthlyAggregates(records, RECENT);

  if (Math.abs(lat) > TROPICS_LAT_DEG) {
    const north = lat > 0;
    const summerMonths = north ? [5, 6, 7, 8, 9] : [11, 12, 1, 2, 3];
    const winterMonths = north ? [10, 11, 12, 1, 2, 3, 4] : [5, 6, 7, 8, 9, 10];
    return {
      kind: "temperate",
      summer: season(summerMonths, rain, temp),
      winter: season(winterMonths, rain, temp),
    };
  }

  const windowRain = (start: number) =>
    windowMonths(start).reduce((s, m) => s + rain[m], 0);
  let primary = 1;
  for (let s = 1; s <= 12; s++) if (windowRain(s) > windowRain(primary)) primary = s;
  const primarySet = new Set(windowMonths(primary));
  let secondary = -1;
  for (let s = 1; s <= 12; s++) {
    if (windowMonths(s).some((m) => primarySet.has(m))) continue;
    if (secondary < 0 || windowRain(s) > windowRain(secondary)) secondary = s;
  }
  if (secondary < 0) secondary = ((primary + 5) % 12) + 1;
  return {
    kind: "tropical",
    summer: season(windowMonths(primary), rain, temp),
    winter: season(windowMonths(secondary), rain, temp),
  };
}

export type SoilMoistureTrend = "falling" | "stable" | "rising";

export const SOIL_MOISTURE_SHIFT = 0.02;

export function soilMoistureMean(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  return mean(
    records
      .filter((r) => inPeriod(r.year, period) && typeof r.gwetroot === "number")
      .map((r) => r.gwetroot as number),
  );
}

export interface SoilMoistureSummary {
  hasData: boolean;
  baseline: number;
  recent: number;
  delta: number;
  trend: SoilMoistureTrend;
}

export function soilMoistureSummary(records: MonthlyRecord[]): SoilMoistureSummary {
  const baseline = soilMoistureMean(records, BASELINE);
  const recent = soilMoistureMean(records, RECENT);
  const hasData = Number.isFinite(baseline) && Number.isFinite(recent);
  const delta = hasData ? recent - baseline : NaN;
  const trend: SoilMoistureTrend = !hasData
    ? "stable"
    : delta <= -SOIL_MOISTURE_SHIFT
      ? "falling"
      : delta >= SOIL_MOISTURE_SHIFT
        ? "rising"
        : "stable";
  return { hasData, baseline, recent, delta, trend };
}

export interface ClimateSummary {
  summerTempChangeC: number;
  annualPrecipChangePct: number;
  hotMonthChange: number;
  hotMonthsBaseline: number;
  hotMonthsRecent: number;
  trendPerDecadeC: number;
}

export function summarize(records: MonthlyRecord[]): ClimateSummary {
  return {
    summerTempChangeC: summerTempChange(records),
    annualPrecipChangePct: annualPrecipChangePct(records),
    hotMonthChange: hotMonthChange(records),
    hotMonthsBaseline: hotMonthCount(records, BASELINE),
    hotMonthsRecent: hotMonthCount(records, RECENT),
    trendPerDecadeC: summerTrend(records).slopePerDecade,
  };
}
