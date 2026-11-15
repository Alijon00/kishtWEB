import { describe, expect, it } from "vitest";
import { assessSoil, phRating, socRating, usdaTexture } from "./soil";

describe("usdaTexture", () => {
  const cases: Array<[number, number, number, string]> = [
    [92, 5, 3, "Sand"],
    [10, 85, 5, "Silt"],
    [20, 20, 60, "Clay"],
    [60, 10, 30, "Sandy clay loam"],
    [45, 40, 15, "Loam"],
    [22, 47, 31, "Clay loam"],
  ];

  it.each(cases)("classifies sand=%s silt=%s clay=%s as %s", (sand, silt, clay, expected) => {
    expect(usdaTexture(sand, silt, clay)).toBe(expected);
  });

  it("classifies a silt loam", () => {
    expect(usdaTexture(20, 65, 15)).toBe("Silt loam");
  });
});

describe("socRating", () => {
  it("rates below 1% as low", () => {
    expect(socRating(0.8)).toBe("low");
    expect(socRating(0.99)).toBe("low");
  });
  it("rates 1–2% as medium", () => {
    expect(socRating(1.0)).toBe("medium");
    expect(socRating(1.18)).toBe("medium");
    expect(socRating(1.99)).toBe("medium");
  });
  it("rates 2% and above as good", () => {
    expect(socRating(2.0)).toBe("good");
    expect(socRating(3.5)).toBe("good");
  });
});

describe("phRating", () => {
  it("rates below 6.5 as acidic", () => {
    expect(phRating(5.2)).toBe("acidic");
    expect(phRating(6.49)).toBe("acidic");
  });
  it("rates 6.5–7.5 as neutral", () => {
    expect(phRating(6.5)).toBe("neutral");
    expect(phRating(7.0)).toBe("neutral");
    expect(phRating(7.5)).toBe("neutral");
  });
  it("rates above 7.5 as alkaline", () => {
    expect(phRating(7.87)).toBe("alkaline");
    expect(phRating(8.4)).toBe("alkaline");
  });
});

describe("assessSoil", () => {
  it("bundles the Vakhsh profile into labels", () => {
    const a = assessSoil({ sandPct: 21.7, siltPct: 47.5, clayPct: 30.9, ph: 7.87, socPct: 1.18 });
    expect(a).toEqual({
      texture: "Clay loam",
      socPct: 1.18,
      socRating: "medium",
      ph: 7.87,
      phRating: "alkaline",
    });
  });
});
