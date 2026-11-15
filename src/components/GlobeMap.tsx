import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl, { Marker, NavigationControl, type Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "../i18n";
import type { Dict } from "../i18n/en";
import FieldMap from "./FieldMap";
import { squareRing } from "../lib/fieldSize";
import {
  buildMapStyle,
  CONTINENTS,
  DEFAULT_GLOBE_VIEW,
  FIELD_ZOOM,
  fitGlobeZoom,
  MAP_LAYERS,
  PICK_MIN_ZOOM,
  SATELLITE_LAYERS,
  SPIN_DEG_PER_SEC,
  type ContinentPreset,
} from "../lib/mapView";

type Layer = "map" | "satellite";

interface GlobeMapProps {
  lat: number | null;
  lon: number | null;
  onPick: (lat: number, lon: number) => void;
  squareM2?: number;
  searchSlot?: ReactNode;
  children?: ReactNode;
}

const FIELD_SQUARE_COLOR = "#C6F05A";
const EMPTY_FC = { type: "FeatureCollection" as const, features: [] };

const squareFeature = (lat: number, lon: number, m2: number) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "Polygon" as const, coordinates: [squareRing(lat, lon, m2)] },
});

export default function GlobeMap(props: GlobeMapProps) {
  const { lat, lon, onPick, squareM2, searchSlot, children } = props;
  const { d } = useI18n();
  const [glFailed, setGlFailed] = useState(false);
  const [layer, setLayer] = useState<Layer>("satellite");
  const [hint, setHint] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const spinningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const stopSpin = () => {
    spinningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };
  const ensureMarker = (latV: number, lonV: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      const m = new Marker({ draggable: true, color: "#e3b04b" })
        .setLngLat([lonV, latV])
        .addTo(map);
      m.on("dragend", () => {
        const p = m.getLngLat();
        onPickRef.current(p.lat, p.lng);
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLngLat([lonV, latV]);
    }
  };
  const removeMarker = () => {
    markerRef.current?.remove();
    markerRef.current = null;
  };
  const showHint = () => {
    setHint(true);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(false), 2600);
  };
  const fitGlobe = () => {
    const map = mapRef.current;
    if (!map) return;
    const el = map.getContainer();
    const z = fitGlobeZoom(Math.min(el.clientWidth, el.clientHeight));
    map.jumpTo({ center: DEFAULT_GLOBE_VIEW.center, zoom: z, pitch: 0, bearing: 0 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const hasField = lat != null && lon != null;

    let map: MaplibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildMapStyle(),
        center: hasField ? [lon!, lat!] : DEFAULT_GLOBE_VIEW.center,
        zoom: hasField ? FIELD_ZOOM : DEFAULT_GLOBE_VIEW.zoom,
        pitch: 0,
        bearing: 0,
        maxZoom: 18,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: true,
      });
    } catch {
      setGlFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const canvas = map.getCanvas();
    const interactionEvents = ["mousedown", "wheel", "touchstart", "keydown"] as const;
    interactionEvents.forEach((ev) => canvas.addEventListener(ev, stopSpin, { passive: true }));
    map.on("dragstart", stopSpin);

    const spin = (ts: number) => {
      if (!spinningRef.current) return;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const c = map.getCenter();
      map.setCenter([c.lng + SPIN_DEG_PER_SEC * dt, c.lat]);
      rafRef.current = requestAnimationFrame(spin);
    };

    map.on("error", () => {});

    map.on("load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch {
      }
      if (lat != null && lon != null) {
        ensureMarker(lat, lon);
      } else {
        fitGlobe();
        spinningRef.current = true;
        lastTsRef.current = null;
        rafRef.current = requestAnimationFrame(spin);
      }
    });

    map.on("resize", () => {
      if (markerRef.current) return;
      const el = map.getContainer();
      map.setZoom(fitGlobeZoom(Math.min(el.clientWidth, el.clientHeight)));
    });

    map.on("click", (e) => {
      stopSpin();
      const z = map.getZoom();
      if (z >= PICK_MIN_ZOOM) {
        onPickRef.current(e.lngLat.lat, e.lngLat.lng);
      } else {
        map.easeTo({ center: e.lngLat, zoom: Math.min(PICK_MIN_ZOOM, z + 3), duration: 900 });
        showHint();
      }
    });

    return () => {
      stopSpin();
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      interactionEvents.forEach((ev) => canvas.removeEventListener(ev, stopSpin));
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (lat == null || lon == null) {
        removeMarker();
        return;
      }
      stopSpin();
      ensureMarker(lat, lon);
      const c = map.getCenter();
      if (Math.abs(c.lng - lon) > 1e-4 || Math.abs(c.lat - lat) > 1e-4) {
        map.flyTo({
          center: [lon, lat],
          zoom: Math.max(map.getZoom(), FIELD_ZOOM),
          duration: 2000,
          essential: true,
        });
      }
    };
    if (map.loaded()) apply();
    else map.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getSource("field-square")) {
        map.addSource("field-square", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "field-square-fill",
          type: "fill",
          source: "field-square",
          paint: { "fill-color": FIELD_SQUARE_COLOR, "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "field-square-outline",
          type: "line",
          source: "field-square",
          paint: { "line-color": FIELD_SQUARE_COLOR, "line-width": 2 },
        });
      }
      const src = map.getSource("field-square") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      if (lat == null || lon == null || !(squareM2 && squareM2 > 0)) {
        src.setData(EMPTY_FC);
      } else {
        src.setData(squareFeature(lat, lon, squareM2));
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [lat, lon, squareM2]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      for (const id of SATELLITE_LAYERS) {
        map.setLayoutProperty(id, "visibility", layer === "satellite" ? "visible" : "none");
      }
      for (const id of MAP_LAYERS) {
        map.setLayoutProperty(id, "visibility", layer === "map" ? "visible" : "none");
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [layer]);

  const flyToContinent = (c: ContinentPreset) => {
    const map = mapRef.current;
    if (!map) return;
    stopSpin();
    map.flyTo({ center: c.center, zoom: c.zoom, duration: 2000, essential: true });
  };

  if (glFailed) return <FieldMap {...props} />;

  return (
    <div className="globe-shell">
      <div className="map-wrap">
        <div className="map-topbar">
          {searchSlot && <div className="map-search-slot">{searchSlot}</div>}
          <div className="map-toggle" role="group" aria-label={d.field.mapStyle}>
            <button
              type="button"
              className={"map-toggle-btn" + (layer === "map" ? " active" : "")}
              aria-pressed={layer === "map"}
              onClick={() => setLayer("map")}
            >
              {d.field.layerMap}
            </button>
            <button
              type="button"
              className={"map-toggle-btn" + (layer === "satellite" ? " active" : "")}
              aria-pressed={layer === "satellite"}
              onClick={() => setLayer("satellite")}
            >
              {d.field.layerSatellite}
            </button>
          </div>
        </div>

        <div ref={containerRef} className="map-canvas globe-canvas" />

        {hint && <div className="map-hint">{d.map.zoomHint}</div>}

        {children && <div className="map-bottomleft">{children}</div>}
      </div>

      {}
      <div className="continent-row" role="group" aria-label={d.map.continentsLabel}>
        {CONTINENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="continent-btn"
            onClick={() => flyToContinent(c)}
          >
            {d.map.continents[c.id as keyof Dict["map"]["continents"]]}
          </button>
        ))}
      </div>
    </div>
  );
}
