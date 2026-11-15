import { CROPS, waterNeedMid, type Crop } from "../../data/crops";
import * as C from "./constants";
import {
  effectiveGrowingTmax,
  matchPct,
  reliabilityStatus,
  scoreSlots,
} from "./scoring";
import type {
  CurrentRotation,
  EngineResult,
  ExcludedCrop,
  Plan,
  PlanSlot,
  Priorities,
  Reason,
  Scenario,
  SiteConditions,
  SlotSeason,
} from "./types";

// --- Step 1: apply the scenario ---------------------------------------------

export function applyScenario(site: SiteConditions, scenario: Scenario): SiteConditions {
  const rainFactor = 1 + scenario.rainDeltaPct / 100;
  return {
    ...site,
    summerTmaxC: site.summerTmaxC + scenario.tempDeltaC,
    summerTempC: site.summerTempC + scenario.tempDeltaC,
    winterTmaxC: site.winterTmaxC + scenario.tempDeltaC,
    winterTempC: site.winterTempC + scenario.tempDeltaC,
    annualRainMm: site.annualRainMm * rainFactor,
    summerRainMm: site.summerRainMm * rainFactor,
    winterRainMm: site.winterRainMm * rainFactor,
    rainChangePct: site.rainChangePct + scenario.rainDeltaPct,
    tempChangeC: site.tempChangeC + scenario.tempDeltaC,
  };
}

// --- Step 2: filter crops that can't grow here ------------------------------

/**
 * Why a crop can't grow here at all (a HARD exclusion), or null if it can.
 * Note: high/low pH is NO LONGER an exclusion — it's a soft reliability penalty
 * in scoring, because soil pH is not a salinity (EC) measurement.
 */
export function excludeReason(crop: Crop, site: SiteConditions): string | null {
  const effTmax = effectiveGrowingTmax(crop, site);
  if (effTmax > crop.maxTempC) {
    const season = crop.season === "summer" ? "summer" : "season";
    return `Too hot here: ${season} max ${effTmax.toFixed(0)} °C, limit ${crop.maxTempC} °C`;
  }
  // Too cold for a warm-season crop (e.g. cotton/sesame in a cool highland).
  if (crop.season === "summer" && crop.minTempC != null && site.summerTmaxC < crop.minTempC) {
    return `Too cool here: summer max ${site.summerTmaxC.toFixed(0)} °C, needs ≥ ${crop.minTempC} °C`;
  }
  return null;
}

interface FilterResult {
  allowed: Crop[];
  excluded: ExcludedCrop[];
}

/**
 * Split crops into growable vs excluded. `selectable` (crop ids) is the
 * farmer's checkbox selection; crops outside it are simply not searched, but a
 * crop blocked by conditions is reported in `excluded` regardless of selection.
 */
export function filterCrops(site: SiteConditions, selectable?: Set<string>): FilterResult {
  const allowed: Crop[] = [];
  const excluded: ExcludedCrop[] = [];
  for (const crop of CROPS) {
    const reason = excludeReason(crop, site);
    if (reason) {
      excluded.push({ crop, reason });
      continue;
    }
    if (!selectable || selectable.has(crop.id)) allowed.push(crop);
  }
  return { allowed, excluded };
}

// --- Step 3: the 8 slots ----------------------------------------------------

interface SlotSpec {
  year: number;
  season: SlotSeason;
}

/** The fixed 8 slots: each year's summer then winter. */
export function slotSpecs(): SlotSpec[] {
  const specs: SlotSpec[] = [];
  for (const year of C.PLAN_YEARS) {
    for (const season of C.SEASONS) specs.push({ year, season });
  }
  return specs;
}

const isCereal = (c: Crop) => c.family === C.CEREAL_FAMILY;

/** A year's two slots, for rendering: summer crop + winter crop (null = fallow). */
export interface YearGroup {
  year: number;
  summer: Crop | null;
  winter: Crop | null;
}

/** Group the 8 flat slots into 4 years, each with its summer and winter crop. */
export function groupSlotsByYear(slots: PlanSlot[]): YearGroup[] {
  const map = new Map<number, YearGroup>();
  for (const s of slots) {
    const g = map.get(s.year) ?? { year: s.year, summer: null, winter: null };
    if (s.season === "summer") g.summer = s.crop;
    else g.winter = s.crop;
    map.set(s.year, g);
  }
  return [...map.values()].sort((a, b) => a.year - b.year);
}

/** How many crops a year may carry: one for dry rainfed land, otherwise two. */
export function maxCropsPerYear(site: SiteConditions): number {
  const rainfed =
    site.annualRainMm < C.RAINFED_SINGLE_SEASON_MM && site.groundwater === "unknown";
  return rainfed ? 1 : C.MAX_CROPS_PER_YEAR;
}

// --- Step 4: beam-search the slot assignments -------------------------------

type Assignment = (Crop | null)[];

/**
 * Enumerate good 8-slot plans with a beam search (width BEAM_WIDTH). Hard rules
 * enforced as we build, slot by slot:
 *  - a crop only goes in a slot of its own season; a slot may be left fallow
 *  - never the same plant family in two ADJACENT slots (fallow breaks the chain)
 *  - at most `maxPerYear` crops in any year (1 for dry rainfed, else 2)
 *  - each year carries at least one cereal, unless no cereal is available
 *  - at least one legume somewhere when soil carbon is low
 * Partial plans are ranked each step by their (unweighted) score so the beam
 * keeps the most promising — full combinatorics (up to 15^8) never materialise.
 */
/** How a beam pass weights the four scores when ranking partial plans. */
type RankWeights = { water: number; soil: number; income: number; reliability: number };

export function solve(
  allowed: Crop[],
  site: SiteConditions,
  socLow: boolean,
  maxPerYear: number,
  weights: RankWeights = { water: 1, soil: 1, income: 1, reliability: 1 },
  forced: (Crop | null | undefined)[] = [],
): Assignment[] {
  const specs = slotSpecs();
  const bySeason: Record<SlotSeason, Crop[]> = {
    summer: allowed.filter((c) => c.season === "summer"),
    winter: allowed.filter((c) => c.season === "winter"),
  };
  const cerealsAvailable = allowed.some(isCereal);

  const toSlots = (a: Assignment): PlanSlot[] =>
    a.map((crop, i) => ({ year: specs[i].year, season: specs[i].season, crop }));
  const rank = (a: Assignment): number => {
    const s = scoreSlots(toSlots(a), site);
    return (
      s.water * weights.water +
      s.soil * weights.soil +
      s.income * weights.income +
      s.reliability * weights.reliability
    );
  };

  let beam: Assignment[] = [[]];
  for (let k = 0; k < specs.length; k++) {
    const spec = specs[k];
    const seasonStart = spec.season === "summer"; // summer is the first slot of a year
    // A forced slot (a perennial stand) admits only its fixed crop, unchecked.
    const fixed = forced[k];
    const candidates: (Crop | null)[] =
      fixed !== undefined ? [fixed] : [null, ...bySeason[spec.season]];
    const next: Assignment[] = [];

    for (const state of beam) {
      const prev = state[k - 1] ?? null;
      const yearCount = seasonStart ? 0 : state[k - 1] != null ? 1 : 0;
      for (const cand of candidates) {
        if (fixed === undefined && cand) {
          if (prev && prev.family === cand.family) continue; // no same family adjacent
          if (yearCount >= maxPerYear) continue; // year already full
          // No same crop in the same season more than MAX_CONSECUTIVE_SAME_SEASON
          // years running (slots two apart share a season).
          let run = 1;
          for (let j = k - 2; j >= 0 && state[j]?.id === cand.id; j -= 2) run++;
          if (run > C.MAX_CONSECUTIVE_SAME_SEASON) continue;
        }
        next.push([...state, cand]);
      }
    }

    // End of a year (winter slot placed): require a cereal — unless a perennial
    // stand occupies the year (a forage year legitimately has no cereal) or no
    // cereal is available at all.
    let filtered = next;
    if (!seasonStart && cerealsAvailable) {
      filtered = next.filter((a) => {
        const summer = a[k - 1];
        const winter = a[k];
        if (summer?.perennial || winter?.perennial) return true;
        return (summer != null && isCereal(summer)) || (winter != null && isCereal(winter));
      });
    }

    filtered.sort((a, b) => rank(b) - rank(a));
    beam = filtered.slice(0, C.BEAM_WIDTH);
  }

  // Whole-plan rule: a legume somewhere when soil carbon is low.
  return beam.filter((a) => !socLow || a.some((c) => c?.fixesNitrogen));
}

/**
 * Plans that hold a perennial (alfalfa) as a contiguous multi-year stand filling
 * BOTH seasons of each stand year (no second crop those years), for at least
 * PERENNIAL_MIN_YEARS years. The remaining years are filled by the normal beam.
 */
export function perennialBlockPlans(
  annuals: Crop[],
  perennial: Crop,
  site: SiteConditions,
  socLow: boolean,
  maxPerYear: number,
): Assignment[] {
  if (maxPerYear < 2) return []; // dry rainfed land can't carry a forage stand
  const years = C.PLAN_YEARS.length;
  const out: Assignment[] = [];
  for (const len of C.PERENNIAL_BLOCK_YEARS) {
    for (let start = 0; start + len <= years; start++) {
      const forced: (Crop | null | undefined)[] = Array(years * 2).fill(undefined);
      for (let y = start; y < start + len; y++) {
        forced[y * 2] = perennial;
        forced[y * 2 + 1] = perennial;
      }
      out.push(...solve(annuals, site, socLow, maxPerYear, undefined, forced));
    }
  }
  return out;
}

// --- Step 5: score ----------------------------------------------------------

interface Scored {
  slots: PlanSlot[];
  scores: ReturnType<typeof scoreSlots>;
  matchPct: number;
  key: string;
}

const slotKey = (slots: PlanSlot[]) =>
  slots.map((s) => s.crop?.id ?? "·").join(">");

function toScored(a: Assignment, site: SiteConditions, pr: Priorities): Scored {
  const specs = slotSpecs();
  const slots: PlanSlot[] = a.map((crop, i) => ({
    year: specs[i].year,
    season: specs[i].season,
    crop,
  }));
  const scores = scoreSlots(slots, site);
  return { slots, scores, matchPct: matchPct(scores, pr), key: slotKey(slots) };
}

/** How many of the 8 slots two plans share (same crop id, or both fallow). */
function sharedSlots(a: PlanSlot[], b: PlanSlot[]): number {
  let shared = 0;
  for (let i = 0; i < a.length; i++) {
    if ((a[i].crop?.id ?? null) === (b[i].crop?.id ?? null)) shared++;
  }
  return shared;
}

const differsEnough = (a: PlanSlot[], b: PlanSlot[]) =>
  sharedSlots(a, b) <= C.MAX_SHARED_SLOTS;

/** Deterministic "pick the max by `metric`, then stable tie-breaks". */
function pickBest(pool: Scored[], metric: (s: Scored) => number): Scored | undefined {
  let best: Scored | undefined;
  for (const s of pool) {
    if (
      !best ||
      metric(s) > metric(best) ||
      (metric(s) === metric(best) &&
        (s.matchPct > best.matchPct ||
          (s.matchPct === best.matchPct && s.key < best.key)))
    ) {
      best = s;
    }
  }
  return best;
}

const plantedCrops = (slots: PlanSlot[]): Crop[] =>
  slots.map((s) => s.crop).filter((c): c is Crop => c != null);

/** A plan whose crops are all within the water-saver need ceiling. */
const isFrugal = (s: Scored) =>
  plantedCrops(s.slots).every((c) => waterNeedMid(c) <= C.WATER_SAVER_MAX_NEED_MM);

// --- Step 6: reasons & assembly ---------------------------------------------

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n))}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildReasons(
  slots: PlanSlot[],
  site: SiteConditions,
  excluded: ExcludedCrop[],
  scenario: Scenario,
): Reason[] {
  const reasons: Reason[] = [];
  const crops = plantedCrops(slots);

  // Rainfall → water demand.
  const thirstyCrops = [...new Set(crops.filter((c) => c.waterNeedMm[1] >= 1000))];
  const thirstyNames = thirstyCrops.map((c) => c.name.toLowerCase());
  reasons.push({
    dataPoint: `Annual rain ${site.annualRainMm.toFixed(0)} mm (${signed(
      site.rainChangePct,
    )}% vs 1995–2004)`,
    source: "NASA POWER",
    rule: "Match crop water demand to the rain the field actually gets",
    effect:
      thirstyNames.length === 0
        ? "keeps thirsty crops (e.g. rice) out of the rotation"
        : `relies on irrigation for ${thirstyNames.join(", ")}`,
    code: "rain",
    params: {
      rainMm: Math.round(site.annualRainMm),
      rainChangePct: Math.round(site.rainChangePct),
      thirstyIds: thirstyCrops.map((c) => c.id),
    },
  });

  // Summer heat → filtering.
  const hotExcluded = excluded.find((e) => e.reason.startsWith("Too hot"));
  reasons.push({
    dataPoint: `Summer max ${site.summerTmaxC.toFixed(0)} °C`,
    source: "NASA POWER",
    rule: "Drop crops whose heat limit sits below the growing-season max",
    effect: hotExcluded
      ? `rules out ${hotExcluded.crop.name.toLowerCase()} (limit ${hotExcluded.crop.maxTempC} °C)`
      : "all chosen crops stay within their heat limit",
    code: "heat",
    params: {
      tmaxC: Math.round(site.summerTmaxC),
      excludedId: hotExcluded?.crop.id,
      excludedLimit: hotExcluded?.crop.maxTempC,
    },
  });

  // Soil carbon → legume / diversity.
  const legumeSlot = slots.find((s) => s.crop?.fixesNitrogen);
  if (site.socLevel === "low" && legumeSlot && legumeSlot.crop) {
    reasons.push({
      dataPoint: `Organic carbon ${site.socPct.toFixed(1)}% (low)`,
      source: "SoilGrids",
      rule: "Low-carbon soil needs a nitrogen-fixing legume in the rotation",
      effect: `adds ${legumeSlot.crop.name.toLowerCase()} in ${legumeSlot.year}`,
      code: "soilLegume",
      params: {
        socPct: Number(site.socPct.toFixed(1)),
        legumeId: legumeSlot.crop.id,
        year: legumeSlot.year,
      },
    });
  } else {
    const families = new Set(crops.map((c) => c.family)).size;
    reasons.push({
      dataPoint: `Organic carbon ${site.socPct.toFixed(1)}% (${site.socLevel}), pH ${site.ph.toFixed(1)}`,
      source: "SoilGrids",
      rule: "Rotate plant families to break pest and disease cycles",
      effect: `spreads the plan across ${families} crop families`,
      code: "soilDiversity",
      params: {
        socPct: Number(site.socPct.toFixed(1)),
        socLevel: site.socLevel,
        ph: Number(site.ph.toFixed(1)),
        families,
      },
    });
  }

  // Groundwater (GRACE-FO) → water risk. Only when we actually have a trend.
  if (typeof site.groundwaterTrendCm === "number") {
    const trend = site.groundwaterTrendCm;
    const falling = site.groundwater === "falling";
    reasons.push({
      dataPoint: `Water storage ${trend >= 0 ? "+" : "−"}${Math.abs(trend).toFixed(1)} cm/yr`,
      source: "GRACE-FO",
      rule: "Falling stored water makes irrigation-heavy plans riskier",
      effect: falling ? "leans the plan away from thirsty crops" : "doesn't change the plan",
      code: "groundwater",
      params: { cm: Number(trend.toFixed(1)), category: site.groundwater },
    });
  }

  // Slope (SRTM) → erosion risk. Only on steep land where we have a slope value.
  if (typeof site.slopePct === "number" && site.slopePct > C.EROSION_SLOPE_PCT) {
    const hasCover = crops.some((c) => c.perennial || c.fixesNitrogen);
    reasons.push({
      dataPoint: `Slope ${site.slopePct.toFixed(0)}%${
        typeof site.elevationM === "number" ? `, elevation ${Math.round(site.elevationM)} m` : ""
      }`,
      source: "SRTM",
      rule: "Steep land (>8%) erodes under bare, back-to-back row crops",
      effect: hasCover
        ? "favours soil-holding cover (perennials, legumes) on the slope"
        : "penalises row crops grown two years running on the slope",
      code: "erosion",
      params: {
        slopePct: Math.round(site.slopePct),
        elevationM: typeof site.elevationM === "number" ? Math.round(site.elevationM) : undefined,
        hasCover: hasCover ? 1 : 0,
      },
    });
  }

  // Root-zone soil moisture (GWETROOT) → reliability of drought-tolerant crops.
  if (site.soilMoistureTrend) {
    const falling = site.soilMoistureTrend === "falling";
    const base = site.soilMoistureBaseline;
    const recent = site.soilMoistureRecent;
    reasons.push({
      dataPoint:
        typeof base === "number" && typeof recent === "number"
          ? `Root-zone wetness ${base.toFixed(2)} → ${recent.toFixed(2)} (0–1)`
          : `Root-zone wetness ${site.soilMoistureTrend}`,
      source: "NASA POWER",
      rule: "Drying root-zone soil favours drought-tolerant crops",
      effect: falling
        ? "raises reliability for drought-tolerant crops"
        : "doesn't change the plan",
      code: "soilMoisture",
      params: {
        trend: site.soilMoistureTrend,
        baseline: typeof base === "number" ? Number(base.toFixed(2)) : undefined,
        recent: typeof recent === "number" ? Number(recent.toFixed(2)) : undefined,
      },
    });
  }

  // Active scenario → stress test.
  if (scenario.rainDeltaPct !== 0 || scenario.tempDeltaC !== 0) {
    const parts: string[] = [];
    if (scenario.rainDeltaPct !== 0) parts.push(`${scenario.rainDeltaPct}% rain`);
    if (scenario.tempDeltaC !== 0) parts.push(`+${scenario.tempDeltaC} °C`);
    reasons.push({
      dataPoint: `What-if: ${parts.join(", ")}`,
      source: "Scenario",
      rule: "Stress-test the plan against a harsher year",
      effect: "shifts the mix toward heat- and drought-tolerant crops",
      code: "scenario",
      params: { rainDeltaPct: scenario.rainDeltaPct, tempDeltaC: scenario.tempDeltaC },
    });
  }

  return reasons;
}

function makePlan(
  id: string,
  title: string,
  badge: string | undefined,
  slots: PlanSlot[],
  scores: ReturnType<typeof scoreSlots>,
  matchPctVal: number,
  site: SiteConditions,
  excluded: ExcludedCrop[],
  scenario: Scenario,
): Plan {
  const { status, message } = reliabilityStatus(scores.reliability, scores.water);
  const reasons = buildReasons(slots, site, excluded, scenario);
  const why = `${cap(reasons[0].effect)}, and it ${reasons[2].effect}.`;
  return {
    id,
    title,
    badge,
    seasonKind: site.seasonKind,
    slots,
    scores,
    matchPct: matchPctVal,
    reliabilityStatus: status,
    reliabilityMessage: message,
    reasons,
    why,
  };
}

const makePlanFromScored = (
  id: string,
  title: string,
  badge: string | undefined,
  s: Scored,
  site: SiteConditions,
  excluded: ExcludedCrop[],
  scenario: Scenario,
) => makePlan(id, title, badge, s.slots, s.scores, s.matchPct, site, excluded, scenario);

// --- Public entry point ------------------------------------------------------

export function buildPlans(
  rawSite: SiteConditions,
  priorities: Priorities,
  scenario: Scenario,
  selectable?: Set<string>,
): EngineResult {
  const site = applyScenario(rawSite, scenario);
  const { allowed, excluded } = filterCrops(site, selectable);
  const socLow = site.socLevel === "low";
  const maxPerYear = maxCropsPerYear(site);

  // Run the beam a few times with different rankings and union the results, so
  // the water-saver and soil-builder archetypes survive even when a balanced
  // ranking would prune them (e.g. a high-value cereal crowding out low-water
  // options). Dedupe by slot signature.
  const passes: RankWeights[] = [
    { water: 1, soil: 1, income: 1, reliability: 1 }, // balanced (best fit)
    { water: 3, soil: 1, income: 0.5, reliability: 1 }, // water-focused
    { water: 1, soil: 3, income: 0.5, reliability: 1 }, // soil-focused
  ];
  // Alfalfa (and any perennial) is placed only as a multi-year block, never as a
  // single annual slot — so keep it out of the normal beam's candidate pool.
  const annuals = allowed.filter((c) => !c.perennial);
  const perennial = allowed.find((c) => c.perennial);

  const seen = new Set<string>();
  const scored: Scored[] = [];
  const collect = (assignments: Assignment[]) => {
    for (const a of assignments) {
      const s = toScored(a, site, priorities);
      if (!seen.has(s.key)) {
        seen.add(s.key);
        scored.push(s);
      }
    }
  };
  for (const w of passes) {
    collect(solve(annuals, site, socLow, maxPerYear, w));
  }
  if (perennial) {
    collect(perennialBlockPlans(annuals, perennial, site, socLow, maxPerYear));
  }

  const plans: Plan[] = [];
  if (scored.length === 0) {
    return { plans, excluded, allowed, adjusted: site };
  }

  // 1) Best fit — highest weighted match.
  const best = pickBest(scored, (s) => s.matchPct)!;
  plans.push(makePlanFromScored("best-fit", "Best fit", "Best fit", best, site, excluded, scenario));

  // 2) Water saver — best water score among frugal plans. Prefer plans that
  // differ enough from best-fit, but fall back to any distinct frugal plan so we
  // still offer a water option rather than dropping the card.
  const frugal = scored.filter((s) => isFrugal(s) && s.key !== best.key);
  const waterDistinct = frugal.filter((s) => differsEnough(s.slots, best.slots));
  const water =
    pickBest(waterDistinct, (s) => s.scores.water) ?? pickBest(frugal, (s) => s.scores.water);
  if (water) {
    plans.push(
      makePlanFromScored("water-saver", "Water saver", undefined, water, site, excluded, scenario),
    );
  }

  // 3) Soil builder OR highest income — whichever differs most from plans 1 & 2.
  const usedKeys = new Set([best.key, water?.key].filter(Boolean) as string[]);
  const distinctPool = scored.filter(
    (s) => differsEnough(s.slots, best.slots) && (!water || differsEnough(s.slots, water.slots)),
  );
  // Fall back to any not-yet-used plan if the distinctness filter emptied the pool.
  const thirdPool = (distinctPool.length ? distinctPool : scored).filter(
    (s) => !usedKeys.has(s.key),
  );
  const soilCand = pickBest(thirdPool, (s) => s.scores.soil);
  const incomeCand = pickBest(thirdPool, (s) => s.scores.income);
  const distFrom = (s?: Scored) =>
    s
      ? C.PLAN_YEARS.length * 2 -
        sharedSlots(s.slots, best.slots) +
        (water ? C.PLAN_YEARS.length * 2 - sharedSlots(s.slots, water.slots) : 0)
      : -1;
  let third: Scored | undefined;
  let thirdTitle = "Soil builder";
  if (soilCand || incomeCand) {
    if (distFrom(incomeCand) > distFrom(soilCand)) {
      third = incomeCand;
      thirdTitle = "Highest income";
    } else {
      third = soilCand;
      thirdTitle = "Soil builder";
    }
  }
  if (third) {
    const id = thirdTitle === "Highest income" ? "highest-income" : "soil-builder";
    plans.push(makePlanFromScored(id, thirdTitle, undefined, third, site, excluded, scenario));
  }

  return { plans, excluded, allowed, adjusted: site };
}

// --- "Now" comparison --------------------------------------------------------

/**
 * Score the farmer's CURRENT practice — a crop repeated every year in each
 * season (null = fallow) — the exact same way, so the Rotation screen can show
 * how the proposed plans compare with what they do today. Not generated by the
 * solver: it bypasses the hard rules on purpose (rice–wheat breaks them, and
 * that's the point of the comparison).
 */
export function buildCurrentPlan(
  rawSite: SiteConditions,
  priorities: Priorities,
  scenario: Scenario,
  rotation: CurrentRotation,
): Plan | null {
  if (!rotation.summer && !rotation.winter) return null;
  const site = applyScenario(rawSite, scenario);
  const byId = (id: string | null, season: SlotSeason): Crop | null => {
    if (!id) return null;
    const crop = CROPS.find((c) => c.id === id);
    return crop && crop.season === season ? crop : null;
  };
  const summer = byId(rotation.summer, "summer");
  const winter = byId(rotation.winter, "winter");
  const slots: PlanSlot[] = slotSpecs().map((spec) => ({
    year: spec.year,
    season: spec.season,
    crop: spec.season === "summer" ? summer : winter,
  }));
  const scores = scoreSlots(slots, site);
  const { excluded } = filterCrops(site);
  return makePlan(
    "current",
    "Now",
    undefined,
    slots,
    scores,
    matchPct(scores, priorities),
    site,
    excluded,
    scenario,
  );
}

// Re-export scoring helpers that tests and screens use directly.
export {
  reliabilityScore,
  waterScore,
  soilScore,
  incomeScore,
  scoreSlots,
  cropReliability,
  erosionAdjustment,
} from "./scoring";
