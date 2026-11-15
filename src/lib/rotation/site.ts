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

export function buildSiteConditions(
  records: MonthlyRecord[],
  soil: SoilAssessment | null,
  lat: number,
  groundwater: Groundwater = "unknown",
  groundwaterTrendCm?: number,
  terrain?: { elevationM: number; slopePct: number } | null,
): SiteConditions {
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
