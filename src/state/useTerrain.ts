import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTerrain, type TerrainResult } from "../lib/terrain";
import {
  DEMO_FALLBACK_TIMEOUT_MS,
  loadDemoTerrain,
  matchExample,
} from "../lib/demoCache";

export type TerrainStatus = "idle" | "loading" | "ready" | "unavailable";

export interface UseTerrainResult {
  status: TerrainStatus;
  result: TerrainResult | null;
  cached: boolean;
  reload: () => void;
}

export function useTerrain(lat: number | null, lon: number | null): UseTerrainResult {
  const [status, setStatus] = useState<TerrainStatus>("idle");
  const [result, setResult] = useState<TerrainResult | null>(null);
  const [cached, setCached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);

  const run = useCallback(() => {
    if (lat == null || lon == null) {
      setStatus("idle");
      setResult(null);
      setCached(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++reqId.current;
    setStatus("loading");
    setResult(null);
    setCached(false);

    const example = matchExample(lat, lon);
    let settled = false;
    const settle = (next: TerrainStatus, r: TerrainResult | null, fromCache: boolean) => {
      if (id !== reqId.current || settled) return;
      settled = true;
      setResult(r);
      setCached(fromCache);
      setStatus(next);
    };
    const tryDemo = (onMiss: () => void) => {
      if (!example) return onMiss();
      loadDemoTerrain(example).then((r) => {
        if (r) settle("ready", r, true);
        else onMiss();
      });
    };

    fetchTerrain(lat, lon, { signal: controller.signal })
      .then((r) => {
        if (r) settle("ready", r, false);
        else tryDemo(() => settle("unavailable", null, false));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        tryDemo(() => settle("unavailable", null, false));
      });

    if (example) {
      window.setTimeout(() => tryDemo(() => {}), DEMO_FALLBACK_TIMEOUT_MS);
    }
  }, [lat, lon]);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return { status, result, cached, reload: run };
}
