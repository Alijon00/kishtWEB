import { describe, expect, it } from "vitest";
import en from "./en";
import ru from "./ru";
import tg from "./tg";

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...keyPaths(v, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

describe("dictionary key parity", () => {
  const enKeys = keyPaths(en);

  it("collects a substantial set of keys from English", () => {
    expect(enKeys.length).toBeGreaterThan(80);
  });

  it("Russian has exactly the same keys as English", () => {
    expect(keyPaths(ru)).toEqual(enKeys);
  });

  it("Tajik has exactly the same keys as English", () => {
    expect(keyPaths(tg)).toEqual(enKeys);
  });
});
