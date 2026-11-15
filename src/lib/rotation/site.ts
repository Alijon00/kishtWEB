import type { MonthlyRecord } from "../types";
import {
  annualPrecipChangePct,
  annualPrecipMean,
  deriveSeasonalClimate,
  dropPartialYears,
  RECENT,
  soilMoistureSummary,
  summarize,
} from "../climate";
import type { SoilAssessment } from "../soil";
import * as C from "./constants";
import type { Groundwater, SiteConditions, SocLevel } from "./types";

/**
 * Assemble the engine's SiteConditions from Part 1 climate records and the
 * Part 2 soil assessment. Seasons (and their temperatures and rainfall) are
 * derived from latitude — two sun-driven seasons in the temperate zones, two
 * rain-driven ones (long/short rains) in the tropics — so an equatorial field
 * like Nakuru is no longer treated as if June were its coldest month.
 *
 * Growing-season daily max = that season's mean temperature + a diurnal offset
 * (see DIURNAL_MAX_OFFSET_C); we deliberately avoid POWER's hot monthly T2M_MAX.
 *
 * Soil is optional — if SoilGrids had no data we fall back to neutral defaults.
 * Groundwater (GRACE-FO) is optional too and defaults to "unknown".
 */
export function buildSiteConditions(
  records: MonthlyRecord[],
  soil: SoilAssessment | null,
  lat: number,
  groundwater: Groundwater = "unknown",
  groundwaterTrendCm?: number,
  terrain?: { elevationM: number; slopePct: number } | null,
): SiteConditions {
  // Only complete years feed the engine, so a partial current year can't skew it.
  const recs = dropPartialYears(records);
  const summary = summarize(recs);
  const seasonal = deriveSeasonalClimate(recs, lat);
  const socLevel: SocLevel = soil ? soil.socRating : "medium";
  const moisture = soilMoistureSummary(recs);
  return {
    seasonKind: seasonal.kind,
    summerTempC: seasonal.summer.meanTempC,
    winterTempC: seasonal.winter.meanTempC,
    summerTmaxC: seasonal.summer.meanTempC + C.DIURNAL_MAX_OFFSET_C,
    winterTmaxC: seasonal.winter.meanTempC + C.DIURNAL_MAX_OFFSET_C,
    annualRainMm: annualPrecipMean(recs, RECENT),
    summerRainMm: seasonal.summer.rainMm,
    winterRainMm: seasonal.winter.rainMm,
    rainChangePct: annualPrecipChangePct(recs),
    tempChangeC: summary.summerTempChangeC,

    socPct: soil ? soil.socPct : 1.5,
    socLevel,
    ph: soil ? soil.ph : 7.0,
    texture: soil ? soil.texture : "unknown",

    groundwater,
    groundwaterTrendCm,

    elevationM: terrain?.elevationM,
    slopePct: terrain?.slopePct,

    soilMoistureTrend: moisture.hasData ? moisture.trend : undefined,
    soilMoistureBaseline: moisture.hasData ? moisture.baseline : undefined,
    soilMoistureRecent: moisture.hasData ? moisture.recent : undefined,
  };
}
