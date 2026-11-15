import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMonthly } from "../lib/nasaPower";
import {
  DEMO_FALLBACK_TIMEOUT_MS,
  loadDemoClimate,
  matchExample,
} from "../lib/demoCache";
import type { MonthlyRecord } from "../lib/types";

export type ClimateStatus = "idle" | "loading" | "ready" | "error";

export interface UseClimateResult {
  status: ClimateStatus;
  records: MonthlyRecord[] | null;
  /** True when the records came from the offline demo cache, not a live call. */
  cached: boolean;
  error: string;
  reload: () => void;
}

/**
 * Fetch the monthly NASA POWER record for a point. Shared by the Climate screen
 * (Part 2) logic and the Rotation/Why screens (Part 4) so both run off the same
 * data, each mounting independently as the user moves between steps.
 *
 * For the three example points a pre-fetched copy ships in public/data/demo;
 * if the live call errors, or hasn't answered within DEMO_FALLBACK_TIMEOUT_MS,
 * we fall back to it and flag the result as cached so the demo survives a dead
 * network.
 */
export function useClimate(lat: number | null, lon: number | null): UseClimateResult {
  const [status, setStatus] = useState<ClimateStatus>("idle");
  const [records, setRecords] = useState<MonthlyRecord[] | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  const run = useCallback(() => {
    if (lat == null || lon == null) {
      setStatus("idle");
      setRecords(null);
      setCached(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++reqId.current;
    setStatus("loading");
    setRecords(null);
    setCached(false);
    setError("");

    const example = matchExample(lat, lon);
    let settled = false;
    const ready = (recs: MonthlyRecord[], fromCache: boolean) => {
      if (id !== reqId.current || settled) return;
      settled = true;
      setRecords(recs);
      setCached(fromCache);
      setStatus("ready");
    };
    const fail = (msg: string) => {
      if (id !== reqId.current || settled) return;
      settled = true;
      setError(msg);
      setStatus("error");
    };
    const tryDemo = (onMiss: () => void) => {
      if (!example) return onMiss();
      loadDemoClimate(example).then((recs) => {
        if (recs) ready(recs, true);
        else onMiss();
      });
    };

    fetchMonthly(lat, lon, { signal: controller.signal })
      .then((recs) => ready(recs, false))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        tryDemo(() => fail(err instanceof Error ? err.message : ""));
      });

    // If the live call is simply slow, fall back to the cache (example points).
    if (example) {
      window.setTimeout(() => tryDemo(() => {}), DEMO_FALLBACK_TIMEOUT_MS);
    }
  }, [lat, lon]);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return { status, records, cached, error, reload: run };
}
