import { useEffect, useRef, useState } from "react";
import { fetchGraceTrend, type GraceResult } from "../lib/grace";
import { loadDemoGrace, matchExample } from "../lib/demoCache";
import type { Groundwater } from "../lib/rotation/types";

export type GraceStatus = "idle" | "loading" | "ready" | "unavailable";

export interface UseGroundwaterResult {
  status: GraceStatus;
  result: GraceResult | null;
  groundwater: Groundwater;
  cached: boolean;
}

export function useGroundwater(
  lat: number | null,
  lon: number | null,
): UseGroundwaterResult {
  const [status, setStatus] = useState<GraceStatus>("idle");
  const [result, setResult] = useState<GraceResult | null>(null);
  const [cached, setCached] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (lat == null || lon == null) {
      setStatus("idle");
      setResult(null);
      setCached(false);
      return;
    }
    const id = ++reqId.current;
    setStatus("loading");
    setResult(null);
    setCached(false);
    const example = matchExample(lat, lon);

    fetchGraceTrend(lat, lon).then((r) => {
      if (id !== reqId.current) return;
      if (r) {
        setResult(r);
        setStatus("ready");
        return;
      }
      if (example) {
        loadDemoGrace(example).then((demo) => {
          if (id !== reqId.current) return;
          setResult(demo);
          setCached(demo != null);
          setStatus(demo ? "ready" : "unavailable");
        });
        return;
      }
      setStatus("unavailable");
    });
  }, [lat, lon]);

  return {
    status,
    result,
    groundwater: result?.groundwater ?? "unknown",
    cached,
  };
}
