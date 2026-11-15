import { describe, expect, it } from "vitest";
import { DEMO_POINTS, DEMO_SOIL_RADIUS_KM, nearestDemoWithin } from "./demoCache";

const vakhsh = DEMO_POINTS.find((p) => p.id === "vakhsh")!;

describe("nearestDemoWithin (~5 km demo soil fallback)", () => {
  it("matches the exact demo point", () => {
    expect(nearestDemoWithin(vakhsh.lat, vakhsh.lon)).toBe("vakhsh");
  });

  it("matches a point a few km away (≈3 km north)", () => {
    const dLat = 3 / 111;
    expect(nearestDemoWithin(vakhsh.lat + dLat, vakhsh.lon)).toBe("vakhsh");
  });

  it("does not match a point well beyond the radius (~50 km)", () => {
    const dLat = 50 / 111;
    expect(nearestDemoWithin(vakhsh.lat + dLat, vakhsh.lon)).toBeNull();
  });

  it("does not match a point just outside the radius", () => {
    const dLat = (DEMO_SOIL_RADIUS_KM + 1) / 111;
    expect(nearestDemoWithin(vakhsh.lat + dLat, vakhsh.lon)).toBeNull();
  });

  it("returns the closest demo site when more than one is near", () => {
    expect(nearestDemoWithin(vakhsh.lat + 0.01, vakhsh.lon + 0.01)).toBe("vakhsh");
  });
});
