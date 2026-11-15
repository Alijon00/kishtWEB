import { describe, expect, it } from "vitest";
import {
  buildMapStyle,
  CONTINENTS,
  FADE_HIGH,
  FADE_LOW,
  GIBS_MAX_ZOOM,
  MAP_LAYERS,
  SATELLITE_LAYERS,
} from "./mapView";
import { hasWebGL } from "./webgl";

describe("buildMapStyle", () => {
  const style = buildMapStyle();

  it("uses the globe projection", () => {
    expect(style.projection).toEqual({ type: "globe" });
  });

  it("wires all four raster sources with Blue Marble capped at zoom 8", () => {
    expect(Object.keys(style.sources).sort()).toEqual(["esri", "esriLabels", "gibs", "osm"]);
    const gibs = style.sources.gibs as { type: string; maxzoom?: number };
    expect(gibs.type).toBe("raster");
    expect(gibs.maxzoom).toBe(GIBS_MAX_ZOOM);
  });

  it("ships the satellite stack visible and the OSM map layer hidden", () => {
    const byId = new Map(style.layers.map((l) => [l.id, l]));
    for (const id of SATELLITE_LAYERS) expect(byId.has(id)).toBe(true);
    for (const id of MAP_LAYERS) {
      expect(byId.get(id)?.layout?.visibility).toBe("none");
    }
  });

  it("cross-fades Blue Marble out and Esri in over the fade window", () => {
    expect(FADE_LOW).toBeLessThan(FADE_HIGH);
    const gibs = style.layers.find((l) => l.id === "gibs");
    const esri = style.layers.find((l) => l.id === "esri");
    expect(JSON.stringify(gibs?.paint)).toContain(String(FADE_LOW));
    expect(JSON.stringify(esri?.paint)).toContain(String(FADE_HIGH));
  });
});

describe("CONTINENTS", () => {
  it("has the five expected continents with valid lon/lat/zoom", () => {
    expect(CONTINENTS.map((c) => c.id)).toEqual([
      "asia",
      "africa",
      "europe",
      "americas",
      "oceania",
    ]);
    for (const c of CONTINENTS) {
      const [lon, latV] = c.center;
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(latV).toBeGreaterThanOrEqual(-90);
      expect(latV).toBeLessThanOrEqual(90);
      expect(c.zoom).toBeGreaterThan(0);
    }
  });
});

describe("hasWebGL", () => {
  it("returns false where there is no DOM (so the flat-map fallback is reachable)", () => {
    expect(hasWebGL()).toBe(false);
  });
});
