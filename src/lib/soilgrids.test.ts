import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSoil, parseSoilGrids, SOIL_RETRY_BACKOFF_MS } from "./soilgrids";

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

const GOOD_JSON = {
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
const okResponse = () => ({ ok: true, status: 200, json: async () => GOOD_JSON });

describe("fetchSoil retry with backoff (SoilGrids 504 / down)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries up to twice with backoff, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 504"))
      .mockRejectedValueOnce(new Error("HTTP 504"))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchSoil(12.34, 56.78);
    await vi.runAllTimersAsync();
    const profile = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(SOIL_RETRY_BACKOFF_MS.length + 1);
    expect(profile).not.toBeNull();
    expect(profile!.socPct).toBeCloseTo(1, 6);
  });

  it("gives up after 2 retries (3 attempts) when SoilGrids stays down", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("HTTP 504"));
    vi.stubGlobal("fetch", fetchMock);

    const settled = fetchSoil(1.2, 3.4).then(
      () => "resolved",
      (e) => e,
    );
    await vi.runAllTimersAsync();
    const result = await settled;

    expect(fetchMock).toHaveBeenCalledTimes(SOIL_RETRY_BACKOFF_MS.length + 1);
    expect(result).toBeInstanceOf(Error);
  });
});

describe("fetchSoil localStorage cache (survives a later outage)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("caches a successful response so a reloaded field works when SoilGrids is down", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });

    const up = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", up);
    const first = await fetchSoil(40.1, 50.2);
    expect(first).not.toBeNull();
    expect(up).toHaveBeenCalledTimes(1);

    const down = vi.fn().mockRejectedValue(new Error("HTTP 504"));
    vi.stubGlobal("fetch", down);
    const second = await fetchSoil(40.1, 50.2);
    expect(second).not.toBeNull();
    expect(second!.socPct).toBeCloseTo(1, 6);
    expect(down).not.toHaveBeenCalled();
  });
});
