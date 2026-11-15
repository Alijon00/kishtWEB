/**
 * Print the three rotation plans + the "Now" card for Vakhsh, Punjab and Nakuru.
 *
 *   npx tsx scripts/demo/print-plans.ts
 *
 * If public/data/demo/{id}.json exist (run build-demo-cache.ts first) it uses the
 * REAL cached NASA POWER / SoilGrids / GRACE values. Otherwise it falls back to
 * representative regional inputs and says so — handy for eyeballing the engine
 * without a network fetch.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { buildPlans, buildCurrentPlan, groupSlotsByYear } from "../../src/lib/rotation/engine";
import { soilScore } from "../../src/lib/rotation/scoring";
import * as C from "../../src/lib/rotation/constants";
import { buildSiteConditions } from "../../src/lib/rotation/site";
import { parsePowerResponse } from "../../src/lib/nasaPower";
import { parseSoilGrids } from "../../src/lib/soilgrids";
import { assessSoil } from "../../src/lib/soil";
import type { CurrentRotation, Plan, Priorities, Scenario, SiteConditions } from "../../src/lib/rotation/types";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PR: Priorities = { water: 5, soil: 5, income: 5, reliability: 5 };

const PLACES = [
  { id: "vakhsh", name: "VAKHSH valley, Tajikistan", lat: 37.7, current: { summer: "cotton", winter: "wheat" } as CurrentRotation,
    rep: { seasonKind: "temperate", summerTempC: 29, winterTempC: 8, summerTmaxC: 37, winterTmaxC: 16, annualRainMm: 300, summerRainMm: 60, winterRainMm: 180, rainChangePct: -8, tempChangeC: 1.3, socPct: 0.6, socLevel: "low", ph: 8.0, texture: "Loam", groundwater: "stable", groundwaterTrendCm: -0.7 } as SiteConditions },
  { id: "punjab", name: "PUNJAB, India", lat: 30.9, current: { summer: "rice", winter: "wheat" } as CurrentRotation,
    rep: { seasonKind: "temperate", summerTempC: 32, winterTempC: 17, summerTmaxC: 40, winterTmaxC: 25, annualRainMm: 650, summerRainMm: 560, winterRainMm: 90, rainChangePct: -5, tempChangeC: 1.1, socPct: 0.45, socLevel: "low", ph: 7.8, texture: "Loam", groundwater: "falling", groundwaterTrendCm: -4.2 } as SiteConditions },
  { id: "nakuru", name: "NAKURU, Kenya", lat: -0.3, current: { summer: "maize", winter: null } as CurrentRotation,
    rep: { seasonKind: "tropical", summerTempC: 16, winterTempC: 15, summerTmaxC: 24, winterTmaxC: 23, annualRainMm: 1100, summerRainMm: 630, winterRainMm: 490, rainChangePct: 2, tempChangeC: 0.8, socPct: 2.8, socLevel: "good", ph: 6.2, texture: "Clay loam", groundwater: "rising", groundwaterTrendCm: 2.8 } as SiteConditions },
];

const SCENARIOS: { label: string; s: Scenario }[] = [
  { label: "AS NOW", s: { rainDeltaPct: 0, tempDeltaC: 0 } },
  { label: "+2C / -20% RAIN", s: { rainDeltaPct: -20, tempDeltaC: 2 } },
];

async function loadReal(id: string, lat: number): Promise<{ site: SiteConditions; real: boolean } | null> {
  try {
    const b = JSON.parse(await readFile(`${ROOT}public/data/demo/${id}.json`, "utf8"));
    const records = parsePowerResponse(b.power);
    const profile = b.soil ? parseSoilGrids(b.soil) : null;
    const soil = profile ? assessSoil(profile) : null;
    const gw = b.grace?.groundwater ?? "unknown";
    const trend = b.grace?.trendCmPerYear;
    return { site: buildSiteConditions(records, soil, b.lat ?? lat, gw, trend), real: true };
  } catch {
    return null;
  }
}

const f1 = (n: number) => n.toFixed(1);
const slotLine = (plan: Plan) =>
  groupSlotsByYear(plan.slots)
    .map((y) => `${y.year}[☀${y.summer?.name ?? "fallow"} ❄${y.winter?.name ?? "fallow"}]`)
    .join("  ");

function soilBreakdown(plan: Plan): string {
  const crops = plan.slots.map((s) => s.crop).filter((c): c is NonNullable<typeof c> => c != null);
  const legumes = crops.filter((c) => c.fixesNitrogen).length;
  const families = [...new Set(crops.map((c) => c.family))];
  const perennial = crops.some((c) => c.perennial);
  const legTerm = Math.min(legumes, C.SOIL_MAX_LEGUME_SLOTS) * C.SOIL_PER_LEGUME_SLOT;
  const famTerm = (families.length - 1) * C.SOIL_PER_EXTRA_FAMILY;
  const perTerm = perennial ? C.SOIL_PERENNIAL_BONUS : 0;
  return (
    `      soil = base ${C.SOIL_BASE} + legumes ${legumes}→${f1(legTerm)} ` +
    `+ families ${families.length}(${families.join(",")})→${f1(famTerm)} ` +
    `+ perennial ${perennial ? "yes" : "no"}→${f1(perTerm)} = ${f1(soilScore(plan.slots))}`
  );
}

async function main() {
  for (const place of PLACES) {
    const real = await loadReal(place.id, place.lat);
    const site = real?.site ?? place.rep;
    const tag = real ? "REAL cached NASA data" : "REPRESENTATIVE inputs (no demo file yet)";
    console.log("\n" + "=".repeat(78) + `\n${place.name} (lat ${place.lat})  —  ${tag}`);
    console.log(
      `  seasons: ${site.seasonKind} | summer Tmax ${f1(site.summerTmaxC)}C (mean ${f1(site.summerTempC)}) ` +
        `winter Tmax ${f1(site.winterTmaxC)}C (mean ${f1(site.winterTempC)})`,
    );
    console.log(
      `  rain ${Math.round(site.annualRainMm)}mm (summer ${Math.round(site.summerRainMm)} / winter ${Math.round(site.winterRainMm)}) | ` +
        `SOC ${f1(site.socPct)}% (${site.socLevel}) | pH ${f1(site.ph)} | ` +
        `GRACE ${site.groundwaterTrendCm ?? "?"}cm/yr (${site.groundwater})`,
    );
    console.log("=".repeat(78));

    for (const { label, s } of SCENARIOS) {
      const { plans, excluded } = buildPlans(site, PR, s);
      const now = buildCurrentPlan(site, PR, s, place.current);
      console.log(`\n  ---- ${label} ----   excluded: ${excluded.map((e) => e.crop.name).join(", ") || "none"}`);
      if (now) {
        console.log(`   NOW (${place.current.summer ?? "fallow"}/${place.current.winter ?? "fallow"}): ${slotLine(now)}`);
        console.log(`       W ${f1(now.scores.water)} S ${f1(now.scores.soil)} I ${f1(now.scores.income)} R ${f1(now.scores.reliability)}  match ${now.matchPct}%  [${now.reliabilityStatus}]`);
      }
      for (const p of plans) {
        console.log(`   ${p.title}: ${slotLine(p)}`);
        console.log(`       W ${f1(p.scores.water)} S ${f1(p.scores.soil)} I ${f1(p.scores.income)} R ${f1(p.scores.reliability)}  match ${p.matchPct}%  [${p.reliabilityStatus}]`);
      }
    }

    // Soil-score breakdown for two different plans (NOW vs best-fit), "as now".
    const best = buildPlans(site, PR, SCENARIOS[0].s).plans[0];
    const now = buildCurrentPlan(site, PR, SCENARIOS[0].s, place.current);
    console.log(`\n  SOIL BREAKDOWN (as now):`);
    if (now) console.log(`    NOW:\n${soilBreakdown(now)}`);
    console.log(`    BEST-FIT:\n${soilBreakdown(best)}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
