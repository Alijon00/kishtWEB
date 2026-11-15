import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSoilNearest } from "../lib/soilgrids";
import { assessSoil, type SoilAssessment } from "../lib/soil";
import {
  DEMO_FALLBACK_TIMEOUT_MS,
  loadDemoSoil,
  matchExample,
} from "../lib/demoCache";

export type SoilStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

export interface UseSoilResult {
  status: SoilStatus;
  assessment: SoilAssessment | null;
  /** True when the point has no soil (ocean/ice): "no farmland data here". */
  noData: boolean;
  /** 0 when the point itself had soil; else the km to the nearest farmland pixel. */
  nearestKm: number;
  /** True when soil came from a nearby pixel because the point was built-up. */
  builtUp: boolean;
  /** True when the assessment came from the offline demo cache. */
  cached: boolean;
  reload: () => void;
}

/**
 * Fetch + assess the soil profile for a coordinate. Distinguishes three
 * non-happy outcomes: still loading, "no soil here" (unavailable, a normal
 * result for ocean/ice), and a real network/timeout error (retryable).
 *
 * For the three example points a pre-fetched copy ships in public/data/demo and
 * is used if the live call errors or is too slow, so the demo works offline.
 */
export function useSoil(lat: number | null, lon: number | null): UseSoilResult {
  const [status, setStatus] = useState<SoilStatus>("idle");
  const [assessment, setAssessment] = useState<SoilAssessment | null>(null);
  const [cached, setCached] = useState(false);
  const [nearestKm, setNearestKm] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  const run = useCallback(() => {
    if (lat == null || lon == null) {
      setStatus("idle");
      setAssessment(null);
      setCached(false);
      setNearestKm(0);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++reqId.current;
    setStatus("loading");
    setAssessment(null);
    setCached(false);
    setNearestKm(0);

    const example = matchExample(lat, lon);
    let settled = false;
    const settle = (
      next: SoilStatus,
      a: SoilAssessment | null,
      fromCache: boolean,
      km: number,
    ) => {
      if (id !== reqId.current || settled) return;
      settled = true;
      setAssessment(a);
      setCached(fromCache);
      setNearestKm(km);
      setStatus(next);
    };
    const tryDemo = (onMiss: () => void) => {
      if (!example) return onMiss();
      loadDemoSoil(example).then((res) => {
        if (!res) return onMiss();
        settle(res.profile ? "ready" : "unavailable", res.profile ? assessSoil(res.profile) : null, true, 0);
      });
    };

    fetchSoilNearest(lat, lon, { signal: controller.signal })
      .then(({ profile, distanceKm }) =>
        settle(profile ? "ready" : "unavailable", profile ? assessSoil(profile) : null, false, distanceKm),
      )
      .catch(() => {
        if (controller.signal.aborted) return;
        tryDemo(() => settle("error", null, false, 0));
      });

    if (example) {
      window.setTimeout(() => tryDemo(() => {}), DEMO_FALLBACK_TIMEOUT_MS);
    }
  }, [lat, lon]);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return {
    status,
    assessment,
    noData: status === "unavailable",
    nearestKm,
    builtUp: status === "ready" && nearestKm > 0,
    cached,
    reload: run,
  };
}
