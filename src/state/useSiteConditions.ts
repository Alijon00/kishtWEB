import { useMemo } from "react";
import type { MonthlyRecord } from "../lib/types";
import type { SoilAssessment } from "../lib/soil";
import { buildSiteConditions } from "../lib/rotation/site";
import type { SiteConditions } from "../lib/rotation/types";
import { summarize, type ClimateSummary } from "../lib/climate";
import { useClimate } from "./useClimate";
import { useSoil, type SoilStatus } from "./useSoil";
import { useGroundwater, type UseGroundwaterResult } from "./useGroundwater";
import { useTerrain, type UseTerrainResult } from "./useTerrain";

export type SiteStatus = "idle" | "loading" | "ready" | "error";

export interface SiteBundle {
  /** Driven by climate (the one required input); soil/GRACE enrich it as they arrive. */
  status: SiteStatus;
  site: SiteConditions | null;
  records: MonthlyRecord[] | null;
  summary: ClimateSummary | null;
  soil: SoilAssessment | null;
  soilStatus: SoilStatus;
  grace: UseGroundwaterResult;
  terrain: UseTerrainResult;
  /** True when any of climate/soil/GRACE/terrain came from the offline demo cache. */
  cached: boolean;
  climateError: string;
  reloadClimate: () => void;
}

/**
 * One hook that assembles the engine's SiteConditions from the three data
 * sources. Climate is required; soil and GRACE are optional — the site updates
 * as each resolves, so plans refine rather than block (soil may be "unavailable"
 * on ocean/ice and never arrive, which must not stall the whole screen).
 */
export function useSiteConditions(
  lat: number | null,
  lon: number | null,
): SiteBundle {
  const climate = useClimate(lat, lon);
  const soil = useSoil(lat, lon);
  const grace = useGroundwater(lat, lon);
  const terrain = useTerrain(lat, lon);

  const summary = useMemo(
    () => (climate.records ? summarize(climate.records) : null),
    [climate.records],
  );

  const site = useMemo<SiteConditions | null>(() => {
    if (!climate.records) return null;
    return buildSiteConditions(
      climate.records,
      soil.assessment,
      lat ?? 0,
      grace.groundwater,
      grace.result?.trendCmPerYear,
      terrain.result,
    );
  }, [
    climate.records,
    soil.assessment,
    lat,
    grace.groundwater,
    grace.result?.trendCmPerYear,
    terrain.result,
  ]);

  const status: SiteStatus =
    climate.status === "ready" && site
      ? "ready"
      : climate.status === "error"
        ? "error"
        : climate.status === "idle"
          ? "idle"
          : "loading";

  return {
    status,
    site,
    records: climate.records,
    summary,
    soil: soil.assessment,
    soilStatus: soil.status,
    grace,
    terrain,
    cached: climate.cached || soil.cached || grace.cached || terrain.cached,
    climateError: climate.error,
    reloadClimate: climate.reload,
  };
}
