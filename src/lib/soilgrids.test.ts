import { describe, expect, it } from "vitest";
import { parseSoilGrids } from "./soilgrids";

function layer(name: string, means: [number, number, number], dFactor = 10) {
  return {
    name,
    unit_measure: { d_factor: dFactor },
    depths: [
      { label: "0-5cm", values: { mean: means[0] } },
      { label: "5-15cm", values: { mean: means[1] } },
      { label: "15-30cm", values: { mean: means[2] } },
    ],
  };
}

describe("parseSoilGrids", () => {
  it("divides by d_factor and weights depths by 5/10/15 cm", () => {
    const json = {
      properties: {
        layers: [
          layer("clay", [300, 300, 300]),
          layer("sand", [200, 200, 200]),
          layer("silt", [500, 500, 500]),
          layer("phh2o", [70, 70, 70]),
          layer("soc", [100, 100, 100]),
        ],
      },
    };
    const p = parseSoilGrids(json)!;
    expect(p.clayPct).toBeCloseTo(30, 6);
    expect(p.sandPct).toBeCloseTo(20, 6);
    expect(p.siltPct).toBeCloseTo(50, 6);
    expect(p.ph).toBeCloseTo(7, 6);
    expect(p.socPct).toBeCloseTo(1, 6);
  });

  it("weights deeper layers more (thicker = heavier)", () => {
    const json = {
      properties: {
        layers: [
          layer("clay", [100, 100, 100]),
          layer("sand", [100, 100, 100]),
          layer("silt", [100, 100, 100]),
          layer("phh2o", [60, 70, 80]),
          layer("soc", [100, 100, 100]),
        ],
      },
    };
    const p = parseSoilGrids(json)!;
    expect(p.ph).toBeCloseTo(7.3333, 3);
  });

  it("returns null when a point has no layers (ocean / ice)", () => {
    expect(parseSoilGrids({ properties: { layers: [] } })).toBeNull();
    expect(parseSoilGrids({})).toBeNull();
  });

  it("returns null when a required property is missing", () => {
    const json = { properties: { layers: [layer("clay", [300, 300, 300])] } };
    expect(parseSoilGrids(json)).toBeNull();
  });

  it("returns null when every depth mean is null", () => {
    const nullLayer = (name: string) => ({
      name,
      unit_measure: { d_factor: 10 },
      depths: [
        { label: "0-5cm", values: { mean: null } },
        { label: "5-15cm", values: { mean: null } },
        { label: "15-30cm", values: { mean: null } },
      ],
    });
    const json = {
      properties: {
        layers: ["clay", "sand", "silt", "phh2o", "soc"].map(nullLayer),
      },
    };
    expect(parseSoilGrids(json)).toBeNull();
  });
});
