import type { MonthlyRecord } from "./types";

/** The two periods we compare. Each is [startYear, endYear] inclusive. */
export const BASELINE: [number, number] = [1995, 2004];
export const RECENT: [number, number] = [2015, 2024];

/** Summer months in the Northern Hemisphere (Jun–Aug). */
const SUMMER_MONTHS = [6, 7, 8];

/** Threshold for a "very hot month" using mean daily max temperature. */
const HOT_MONTH_THRESHOLD_C = 35;

const mean = (xs: number[]): number =>
  xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

const inPeriod = (year: number, [start, end]: [number, number]): boolean =>
  year >= start && year <= end;

const isSummer = (r: MonthlyRecord): boolean => SUMMER_MONTHS.includes(r.month);

/** A full calendar year of monthly records. */
const MONTHS_IN_YEAR = 12;

/** Years for which all 12 months are present (after −999/fill filtering upstream). */
export function completeYears(records: MonthlyRecord[]): Set<number> {
  const count = new Map<number, number>();
  for (const r of records) count.set(r.year, (count.get(r.year) ?? 0) + 1);
  return new Set(
    [...count.entries()].filter(([, c]) => c === MONTHS_IN_YEAR).map(([y]) => y),
  );
}

/**
 * Drop any partial year so a decade mean is never skewed by an incomplete year
 * (e.g. a point fetched mid-2025, where the current year has only a few months).
 * Every headline stat runs on these complete-year records.
 */
export function dropPartialYears(records: MonthlyRecord[]): MonthlyRecord[] {
  const keep = completeYears(records);
  return records.filter((r) => keep.has(r.year));
}

/** Mean summer (Jun–Aug) T2M across all records in a period, °C. */
export function summerMeanTemp(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  return mean(
    records.filter((r) => isSummer(r) && inPeriod(r.year, period)).map((r) => r.t2m),
  );
}

/**
 * Change in mean summer temperature between baseline and recent periods, °C.
 * Positive = summers got hotter.
 */
export function summerTempChange(records: MonthlyRecord[]): number {
  return summerMeanTemp(records, RECENT) - summerMeanTemp(records, BASELINE);
}

/** Mean summer (Jun–Aug) daily-max temperature across a period, °C. */
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

/** Mean annual precipitation total across the years of a period, mm/year. */
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

/**
 * Change in annual precipitation between baseline and recent periods, as a
 * percent of the baseline. Positive = wetter. Returns NaN if baseline is 0.
 */
export function annualPrecipChangePct(records: MonthlyRecord[]): number {
  const base = annualPrecipMean(records, BASELINE);
  const recent = annualPrecipMean(records, RECENT);
  if (!(base > 0)) return NaN;
  return ((recent - base) / base) * 100;
}

/** Count of very hot months (T2M_MAX > 35 °C) within a period. */
export function hotMonthCount(
  records: MonthlyRecord[],
  period: [number, number],
): number {
  return records.filter(
    (r) => inPeriod(r.year, period) && r.t2mMax > HOT_MONTH_THRESHOLD_C,
  ).length;
}

/**
 * Change in the number of very hot months between baseline and recent periods.
 * Both periods are the same length (10 years), so the counts are comparable.
 */
export function hotMonthChange(records: MonthlyRecord[]): number {
  return hotMonthCount(records, RECENT) - hotMonthCount(records, BASELINE);
}

/** One year's mean summer temperature, for the trend line and chart. */
export interface YearlySummerTemp {
  year: number;
  temp: number;
}

/** Mean summer temperature per year across the full record, sorted by year. */
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

/** Result of an ordinary-least-squares fit: temp = slope * year + intercept. */
export interface LinearFit {
  /** Slope in °C per year. */
  slopePerYear: number;
  /** Slope expressed as °C per decade (the headline figure). */
  slopePerDecade: number;
  intercept: number;
}

/**
 * Ordinary least squares fit of summer temperature against calendar year.
 * Returns the slope in °C/year and °C/decade. NaN slope if fewer than 2 points.
 */
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

/** Mean precipitation per calendar month (Jan–Dec) over a period, mm. */
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

/** Beyond ±23.5° the sun's seasons dominate; inside it, rainfall does. */
export const TROPICS_LAT_DEG = 23.5;

/** One cropping window: its calendar months, mean temperature and rainfall. */
export interface SeasonClimate {
  months: number[];
  meanTempC: number;
  rainMm: number;
}

/**
 * The two cropping seasons for a point, chosen by latitude:
 *  - Northern temperate (lat > 23.5): summer = May–Sep, winter = Oct–Apr.
 *  - Southern temperate (lat < −23.5): the reverse.
 *  - Tropics (|lat| ≤ 23.5): the two rainiest 3-month windows in the NASA POWER
 *    record — "long rains" (summer slot) and "short rains" (winter slot) — since
 *    near the equator rainfall, not the sun, defines the growing seasons.
 */
export interface SeasonalClimate {
  kind: "temperate" | "tropical";
  summer: SeasonClimate; // warm season / long rains
  winter: SeasonClimate; // cool season / short rains
}

/** Mean monthly temperature and mean monthly rainfall total, indexed 1–12. */
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

/** The 3 calendar months of a cyclic window starting at `start` (1–12). */
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

  // Tropics: the two rainiest non-overlapping 3-month windows.
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
  if (secondary < 0) secondary = ((primary + 5) % 12) + 1; // degenerate: opposite side
  return {
    kind: "tropical",
    summer: season(windowMonths(primary), rain, temp),
    winter: season(windowMonths(secondary), rain, temp),
  };
}

// --- Root-zone soil moisture (NASA POWER GWETROOT / MERRA-2) -----------------

/** How a point's root-zone soil wetness is trending, recent vs baseline. */
export type SoilMoistureTrend = "falling" | "stable" | "rising";

/**
 * GWETROOT change (fraction of saturation, 0–1) that counts as a real shift.
 * GWETROOT runs ~0.2–0.6 in these regions; a 0.02 move (2 points of saturation)
 * is the smallest change we'll call "falling" or "rising" rather than noise.
 */
export const SOIL_MOISTURE_SHIFT = 0.02;

/** Mean root-zone soil wetness (GWETROOT, 0–1) over a period, NaN if no data. */
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
  /** False when the record carries no GWETROOT (e.g. older cached data). */
  hasData: boolean;
  /** Mean root-zone wetness 1995–2004 (0–1). */
  baseline: number;
  /** Mean root-zone wetness 2015–2024 (0–1). */
  recent: number;
  /** recent − baseline (0–1). Negative = drying out. */
  delta: number;
  trend: SoilMoistureTrend;
}

/** Compare root-zone soil wetness, 1995–2004 vs 2015–2024. */
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

/** The headline numbers shown on the "What changed" screen. */
export interface ClimateSummary {
  summerTempChangeC: number;
  annualPrecipChangePct: number;
  hotMonthChange: number;
  hotMonthsBaseline: number;
  hotMonthsRecent: number;
  trendPerDecadeC: number;
}

/**
 * Bundle the headline figures. Callers working with LIVE data pass records
 * already run through dropPartialYears() (see buildSiteConditions and the
 * Climate screen) so an incomplete current year can't skew a decade mean; this
 * function itself stays a pure aggregation so it's easy to unit-test.
 */
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
