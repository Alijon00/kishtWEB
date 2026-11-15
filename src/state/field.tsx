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
import {
  clampValue,
  DEFAULT_SIZE_UNIT,
  DEFAULT_SIZE_VALUE,
  isSizeUnit,
  toM2,
  type SizeUnit,
} from "../lib/fieldSize";

export interface Field {
  lat: number;
  lon: number;
  placeName: string | null;
}

export interface FieldSize {
  value: number;
  unit: SizeUnit;
}

export interface ExampleSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const EXAMPLE_SITES: ExampleSite[] = [
  { id: "vakhsh", name: "Vakhsh valley, Tajikistan", lat: 37.7, lon: 68.8 },
  { id: "sughd", name: "Sughd, Tajikistan", lat: 40.2, lon: 69.2 },
  { id: "hissar", name: "Hissar valley, Tajikistan", lat: 38.55, lon: 68.65 },
];

interface FieldContextValue {
  field: Field | null;
  size: FieldSize;
  sizeM2: number;
  selectPoint: (lat: number, lon: number, presetName?: string) => void;
  setSize: (value: number, unit: SizeUnit) => void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

const DEFAULT_SIZE: FieldSize = { value: DEFAULT_SIZE_VALUE, unit: DEFAULT_SIZE_UNIT };

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

function readUrlSize(): FieldSize {
  if (typeof window === "undefined") return DEFAULT_SIZE;
  const params = new URLSearchParams(window.location.search);
  const rawUnit = params.get("unit");
  const unit = rawUnit && isSizeUnit(rawUnit) ? rawUnit : DEFAULT_SIZE_UNIT;
  const rawValue = Number(params.get("size"));
  const value =
    params.has("size") && Number.isFinite(rawValue) && rawValue > 0
      ? clampValue(rawValue, unit)
      : DEFAULT_SIZE_VALUE;
  return { value, unit };
}

function writeUrl(field: Field | null, size: FieldSize): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (field) {
    params.set("lat", String(round5(field.lat)));
    params.set("lon", String(round5(field.lon)));
    params.set("size", String(size.value));
    params.set("unit", size.unit);
  } else {
    params.delete("lat");
    params.delete("lon");
    params.delete("size");
    params.delete("unit");
  }
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function FieldProvider({ children }: { children: ReactNode }) {
  const [field, setField] = useState<Field | null>(() => readUrlField());
  const [size, setSizeState] = useState<FieldSize>(() => readUrlSize());
  const geocodeAbort = useRef<AbortController | null>(null);

  const selectPoint = useCallback((lat: number, lon: number, presetName?: string) => {
    setField({
      lat: round5(lat),
      lon: round5(lon),
      placeName: presetName ?? null,
    });
  }, []);

  const setSize = useCallback((value: number, unit: SizeUnit) => {
    setSizeState({ value: clampValue(value, unit), unit });
  }, []);

  useEffect(() => {
    writeUrl(field, size);
  }, [field?.lat, field?.lon, size.value, size.unit]); // eslint-disable-line react-hooks/exhaustive-deps

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
    () => ({ field, size, sizeM2: toM2(size.value, size.unit), selectPoint, setSize }),
    [field, size, selectPoint, setSize],
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
