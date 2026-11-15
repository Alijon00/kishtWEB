import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { reverseGeocode } from "../lib/geocode";

export interface Field {
  lat: number;
  lon: number;
  placeName: string | null;
}

export interface ExampleSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const EXAMPLE_SITES: ExampleSite[] = [
  { id: "vakhsh", name: "Vakhsh valley, Tajikistan", lat: 37.7, lon: 68.8 },
  { id: "punjab", name: "Punjab, India", lat: 30.80, lon: 75.65 },
  { id: "nakuru", name: "Kenya, Nakuru", lat: -0.3, lon: 36.07 },
];

interface FieldContextValue {
  field: Field | null;
  selectPoint: (lat: number, lon: number, presetName?: string) => void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

function readUrlField(): Field | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!params.has("lat") || !params.has("lon")) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, placeName: null };
}

function writeUrlField(field: Field | null): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (field) {
    params.set("lat", String(round5(field.lat)));
    params.set("lon", String(round5(field.lon)));
  } else {
    params.delete("lat");
    params.delete("lon");
  }
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function FieldProvider({ children }: { children: ReactNode }) {
  const [field, setField] = useState<Field | null>(() => readUrlField());
  const geocodeAbort = useRef<AbortController | null>(null);

  const selectPoint = useCallback((lat: number, lon: number, presetName?: string) => {
    setField({
      lat: round5(lat),
      lon: round5(lon),
      placeName: presetName ?? null,
    });
  }, []);

  useEffect(() => {
    writeUrlField(field);
  }, [field?.lat, field?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!field || field.placeName !== null) return;
    const lat = field.lat;
    const lon = field.lon;
    geocodeAbort.current?.abort();
    const controller = new AbortController();
    geocodeAbort.current = controller;
    reverseGeocode(lat, lon, { signal: controller.signal }).then((name) => {
      if (controller.signal.aborted || !name) return;
      setField((prev) =>
        prev && prev.lat === lat && prev.lon === lon ? { ...prev, placeName: name } : prev,
      );
    });
    return () => controller.abort();
  }, [field?.lat, field?.lon, field?.placeName]);

  const value = useMemo<FieldContextValue>(
    () => ({ field, selectPoint }),
    [field, selectPoint],
  );

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

export function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("useField must be used within a FieldProvider");
  return ctx;
}

export function fieldLabel(field: Field | null): string {
  if (!field) return "—";
  if (field.placeName) return field.placeName;
  return `${field.lat.toFixed(2)}, ${field.lon.toFixed(2)}`;
}
