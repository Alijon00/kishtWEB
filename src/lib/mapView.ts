import type { StyleSpecification } from "maplibre-gl";

export const GIBS_BLUEMARBLE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
export const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ESRI_LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const GIBS_MAX_ZOOM = 8;
export const FADE_LOW = 5;
export const FADE_HIGH = 7;

export const FIELD_ZOOM = 12;
export const PICK_MIN_ZOOM = 9;

export const DEFAULT_GLOBE_VIEW = { center: [68, 38] as [number, number], zoom: 1 };

export function fitGlobeZoom(minDim: number): number {
  if (!minDim || minDim <= 0) return DEFAULT_GLOBE_VIEW.zoom;
  return Math.log2((0.82 * minDim * Math.PI) / 512);
}

export const SPIN_DEG_PER_SEC = 5;

export interface ContinentPreset {
  id: "asia" | "africa" | "europe" | "americas" | "oceania";
  center: [number, number];
  zoom: number;
}

export const CONTINENTS: ContinentPreset[] = [
  { id: "asia", center: [90, 45], zoom: 2.2 },
  { id: "africa", center: [20, 3], zoom: 2.3 },
  { id: "europe", center: [15, 54], zoom: 3 },
  { id: "americas", center: [-95, 20], zoom: 2 },
  { id: "oceania", center: [140, -25], zoom: 2.8 },
];

const fadeIn = ["interpolate", ["linear"], ["zoom"], FADE_LOW, 0, FADE_HIGH, 1] as const;
const fadeOut = ["interpolate", ["linear"], ["zoom"], FADE_LOW, 1, FADE_HIGH, 0] as const;

export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sources: {
      gibs: {
        type: "raster",
        tiles: [GIBS_BLUEMARBLE_URL],
        tileSize: 256,
        maxzoom: GIBS_MAX_ZOOM,
        attribution: "NASA GIBS / Blue Marble",
      },
      esri: {
        type: "raster",
        tiles: [ESRI_IMAGERY_URL],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Esri, Maxar, Earthstar Geographics",
      },
      esriLabels: {
        type: "raster",
        tiles: [ESRI_LABELS_URL],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Labels © Esri",
      },
      osm: {
        type: "raster",
        tiles: [OSM_URL],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0d1311" } },
      {
        id: "gibs",
        type: "raster",
        source: "gibs",
        paint: { "raster-opacity": fadeOut as unknown as number },
      },
      {
        id: "esri",
        type: "raster",
        source: "esri",
        paint: { "raster-opacity": fadeIn as unknown as number },
      },
      {
        id: "esriLabels",
        type: "raster",
        source: "esriLabels",
        paint: { "raster-opacity": fadeIn as unknown as number },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        layout: { visibility: "none" },
        paint: { "raster-saturation": -0.25, "raster-brightness-max": 0.82 },
      },
    ],
  };
}

export const SATELLITE_LAYERS = ["gibs", "esri", "esriLabels"];
export const MAP_LAYERS = ["osm"];
