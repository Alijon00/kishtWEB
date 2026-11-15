import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSoilNearest, sampleSoilGrid, type SoilGridSample } from "../lib/soilgrids";
import { assessSoil, type SoilAssessment } from "../lib/soil";
import { loadDemoSoil, nearestDemoWithin } from "../lib/demoCache";
import { isSmallField } from "../lib/fieldSize";

export type SoilStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

export interface SoilSampleInfo {
  points: number;
  total: number;
  socRange: [number, number];
  phRange: [number, number];
}

export interface UseSoilResult {
  status: SoilStatus;
  assessment: SoilAssessment | null;
  noData: boolean;
  nearestKm: number;
  builtUp: boolean;
  cached: boolean;
  sample: SoilSampleInfo | null;
  reload: () => void;
}

export function useSoil(
  lat: number | null,
  lon: number | null,
  m2: number,
): UseSoilResult {
  const [status, setStatus] = useState<SoilStatus>("idle");
  const [assessment, setAssessment] = useState<SoilAssessment | null>(null);
  const [cached, setCached] = useState(false);
  const [nearestKm, setNearestKm] = useState(0);
  const [sample, setSample] = useState<SoilSampleInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  const run = useCallback(() => {
    if (lat == null || lon == null) {
      setStatus("idle");
      setAssessment(null);
      setCached(false);
      setNearestKm(0);
      setSample(null);
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
    setSample(null);

    const example = nearestDemoWithin(lat, lon);
    let settled = false;
    const settle = (
      next: SoilStatus,
      a: SoilAssessment | null,
      fromCache: boolean,
      km: number,
      s: SoilSampleInfo | null = null,
    ) => {
      if (id !== reqId.current || settled) return;
      settled = true;
      setAssessment(a);
      setCached(fromCache);
      setNearestKm(km);
      setSample(s);
      setStatus(next);
    };

    const sampleInfo = (g: SoilGridSample): SoilSampleInfo | null =>
      g.socRange && g.phRange
        ? { points: g.points, total: g.total, socRange: g.socRange, phRange: g.phRange }
        : null;

    const fetchGrid = () => {
      sampleSoilGrid(lat, lon, m2, { signal: controller.signal })
        .then((g) =>
          settle(
            g.profile ? "ready" : "unavailable",
            g.profile ? assessSoil(g.profile) : null,
            false,
            0,
            sampleInfo(g),
          ),
        )
        .catch(() => {
          if (controller.signal.aborted) return;
          settle("error", null, false, 0);
        });
    };

    const fetchPoint = () => {
      fetchSoilNearest(lat, lon, { signal: controller.signal })
        .then(({ profile, distanceKm }) =>
          settle(profile ? "ready" : "unavailable", profile ? assessSoil(profile) : null, false, distanceKm),
        )
        .catch(() => {
          if (controller.signal.aborted) return;
          settle("error", null, false, 0);
        });
    };

    // Large fields read a 3×3 grid; small fields and demo sites use one value.
    const fetchLive = () => (isSmallField(m2) ? fetchPoint() : fetchGrid());

    if (example) {
      loadDemoSoil(example)
        .then((res) => {
          if (id !== reqId.current || settled) return;
          if (res) {
            settle(
              res.profile ? "ready" : "unavailable",
              res.profile ? assessSoil(res.profile) : null,
              true,
              0,
            );
          } else {
            fetchLive();
          }
        })
        .catch(() => fetchLive());
    } else {
      fetchLive();
    }
  }, [lat, lon, m2]);

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
    sample,
    reload: run,
  };
}
