/**
 * Every threshold and coefficient the rotation engine uses, in one place.
 * Each value has a comment explaining why it is what it is. Nothing here is a
 * black box — change a number and you change one explainable rule.
 */

import type { SlotSeason } from "./types";

/** The 4-year plan horizon. */
export const PLAN_YEARS = [2027, 2028, 2029, 2030];

/** Each year has two cropping windows; a plan is 4 years × these = 8 slots. */
export const SEASONS: SlotSeason[] = ["summer", "winter"];

/** Normal double-cropping: up to two crops a year. Dry rainfed land gets one. */
export const MAX_CROPS_PER_YEAR = 2;

/**
 * Below this annual rainfall AND with no usable groundwater, the land can't
 * support two crops a year, so the engine plants one season a year (the other
 * is fallow). "No usable groundwater" = GRACE gives no value for the point
 * ("unknown"); a known aquifer (even a falling one) means irrigation exists, so
 * those fields still double-crop. Documented, deliberately simple.
 */
export const RAINFED_SINGLE_SEASON_MM = 300;

/**
 * The cereal families a "main staple" can come from (Poaceae grains: wheat,
 * barley, maize, rice, sorghum, millet). The main-cereal rule wants one of these
 * each year unless the farmer has unticked them all.
 */
export const CEREAL_FAMILY = "Poaceae";

/** Beam-search width: how many partial plans we keep at each step. */
export const BEAM_WIDTH = 400;

// --- Scenario ("what if?") ---------------------------------------------------

/** "20% less rain" scenario: a plausible dry year / drier future. */
export const SCENARIO_RAIN_DELTA_PCT = -20;
/** "2 °C hotter" scenario: upper end of mid-century summer warming. */
export const SCENARIO_TEMP_DELTA_C = 2;

// --- Season temperature model ------------------------------------------------

/**
 * We estimate each growing season's mean DAILY-MAX temperature as that season's
 * mean temperature (NASA POWER T2M) plus this offset — roughly half a typical
 * diurnal range. We do NOT use POWER's monthly T2M_MAX directly: in arid,
 * low-elevation cells it runs several °C hot (a known MERRA-2 bias), which was
 * wrongly excluding cotton from Vakhsh. Crop `maxTempC` thresholds are on this
 * same mean-daily-max scale.
 */
export const DIURNAL_MAX_OFFSET_C = 8;

/** Beyond ±23.5° seasons follow the sun; inside, they follow the rains. */
export const TROPICS_LAT_DEG = 23.5;

/** A perennial stand (alfalfa) must run at least this many whole years. */
export const PERENNIAL_MIN_YEARS = 2;
/** Block lengths the engine tries for a perennial stand (longer preferred). */
export const PERENNIAL_BLOCK_YEARS = [3, 2];

/** The same crop may sit in the same season at most this many years running. */
export const MAX_CONSECUTIVE_SAME_SEASON = 2;

// --- Salinity / pH -----------------------------------------------------------

/**
 * Above this soil pH, arid-region soils are frequently saline/sodic, which
 * stresses salt-sensitive crops (salinityTolerance === 1). We DON'T exclude them
 * — soil pH is not a salinity (EC) measurement — but we dock their reliability.
 * Below the acidic limit we do the same for the same sensitive crops.
 */
export const STRONG_ALKALINE_PH = 8.5;
export const STRONG_ACIDIC_PH = 5.2;
/** Reliability points removed from a salt-sensitive crop on saline-risk soil. */
export const SALINITY_RELIABILITY_PENALTY = 2.5;

// --- Water scoring -----------------------------------------------------------

/**
 * Rainfall (mm) of unmet crop demand that costs one water point. ~250 mm of
 * irrigation to close per point — a deficit of 1000 mm ≈ 4 points lost. Water is
 * accounted PER SEASON (summer crops against summer rain, winter against winter)
 * so a monsoon-fed crop scores very differently from one grown in the dry season.
 */
export const WATER_DEFICIT_PER_POINT_MM = 250;
/**
 * When groundwater is falling, every mm of irrigation deficit hurts more
 * (pumping draws a shrinking resource). The multiplier grows with the measured
 * GRACE depletion rate: 1 + PER_CM × |trend cm/yr|. So a mild −1 cm/yr barely
 * stings, while NW-India-scale −4 cm/yr roughly triples the deficit — which is
 * why an irrigation-hungry rice–wheat plan on a depleting aquifer scores near
 * zero on water. FALLING_GROUNDWATER_PENALTY is the fallback when we know the
 * trend is "falling" but have no number.
 */
export const FALLING_PENALTY_PER_CM = 0.4;
export const FALLING_GROUNDWATER_PENALTY = 1.4;
/**
 * Weight given to the SINGLE thirstiest crop when scoring a plan's water use,
 * blended with the plan-wide average, so one irrigation-hungry crop can't hide
 * behind dry ones.
 */
export const WATER_PEAK_WEIGHT = 0.4;
/** A crop whose mid water need exceeds this (mm) can't appear in a Water saver. */
export const WATER_SAVER_MAX_NEED_MM = 600;

// --- Soil scoring ------------------------------------------------------------
// Scored across the 8 slots so plans spread over the whole 0–10 range:
// a 2-crop cereal monoculture (e.g. rice–wheat) lands near the base; a diverse,
// legume-rich, multi-family plan approaches 10.

export const SOIL_BASE = 2.0; // bare, single-family, legume-free cropping
export const SOIL_PER_LEGUME_SLOT = 1.0; // N fixation + rotation break, per legume slot
export const SOIL_MAX_LEGUME_SLOTS = 3; // diminishing returns beyond three
export const SOIL_PER_EXTRA_FAMILY = 1.1; // each crop family beyond the first
export const SOIL_PERENNIAL_BONUS = 1.0; // a perennial stand builds structure
export const SOIL_FALLOW_PENALTY = 0.4; // bare fallow slot = lost cover/roots (per slot)

// --- Erosion / slope (SRTM · AWS Terrain Tiles) ------------------------------

/**
 * Above this slope (percent) a field is erosion-prone on bare, tilled row crops,
 * so the engine nudges the soil score: perennial stands and legumes (permanent
 * or dense cover that holds soil) earn a bonus, and row crops (cotton, maize)
 * grown two years running — leaving the ground exposed through back-to-back
 * cultivation — take a penalty. 8% is a common conservation-tillage threshold.
 */
export const EROSION_SLOPE_PCT = 8;
/** Row crops that expose steep soil when grown back-to-back. */
export const EROSION_ROW_CROP_IDS = ["cotton", "maize"];
/** Soil-score bonus on steep land for a plan that holds a perennial stand. */
export const EROSION_PERENNIAL_BONUS = 1.5;
/** Soil-score bonus per legume slot on steep land (cover + roots hold soil). */
export const EROSION_PER_LEGUME_SLOT = 0.5;
export const EROSION_MAX_LEGUME_SLOTS = 3;
/** Soil-score penalty for each pair of consecutive years of row crops on steep land. */
export const EROSION_ROW_CROP_PENALTY = 1.5;

// --- Income scoring ----------------------------------------------------------

/** A fallow slot earns nothing; income is averaged over all 8 slots. */
export const INCOME_SCALE = 2; // maps the 1–5 crop index onto 0–10

// --- Root-zone soil moisture (NASA POWER GWETROOT / MERRA-2) ------------------

/**
 * When root-zone soil moisture is FALLING (2015–2024 drier than 1995–2004),
 * drought-tolerant crops become the safer bet, so we raise their reliability by
 * this many points per drought-tolerance band above "low": band 3 → +2×, band 2
 * → +1×, band 1 (sensitive) → nothing. Only "falling" changes scoring; a stable
 * or wetter trend is shown for context but leaves reliability untouched.
 */
export const SOIL_MOISTURE_DROUGHT_BONUS = 0.5;

// --- Reliability scoring -----------------------------------------------------

/** Heat score at exactly zero headroom (crop limit == growing-season max). */
export const HEAT_SCORE_AT_ZERO_HEADROOM = 5;
/** Score change per °C of headroom between the crop limit and the season max. */
export const HEAT_SCORE_PER_DEG = 0.8;

/** Drought score at a medium-tolerance crop with no water deficit. */
export const DROUGHT_SCORE_BASE = 5;
/** Score bonus per tolerance band above "low" (band 1). */
export const DROUGHT_PER_BAND = 1.5;
/** Water deficit (mm) that costs one drought point. */
export const DROUGHT_DEFICIT_PER_POINT_MM = 200;
/** Cap on how much deficit alone can pull the drought score down. */
export const DROUGHT_MAX_STRESS = 6;

// --- Reliability status thresholds (0–10 reliability score) -------------------

export const RELIABILITY_HOLDS_MIN = 6.5; // "Holds up in this scenario"
export const RELIABILITY_RISK_MAX = 4.0; // below this → "High risk"
/** Below this water score (with moderate reliability) → "water may run short". */
export const WATER_SHORT_MAX = 4.0;

// --- Groundwater / GRACE classification --------------------------------------

/**
 * GRACE-FO total-water-storage trend thresholds, in cm/year of liquid water
 * equivalent. GRACE measures ALL stored water (groundwater + soil moisture +
 * snow + surface water) in a ~300 km column — not a well level — so these bands
 * describe the whole column's direction of travel, not the aquifer alone.
 *
 * Below −1 cm/yr the column is losing water fast enough to flag as "falling"
 * (the scale of well-documented depletion in NW India / Central Asia). Above
 * +1 cm/yr it is "rising"; in between it is "stable". Only "falling" changes
 * the plan (via FALLING_GROUNDWATER_PENALTY); the rest are shown for context.
 */
export const GRACE_FALLING_MAX_CM_PER_YEAR = -1;
export const GRACE_RISING_MIN_CM_PER_YEAR = 1;

// --- Plan selection ----------------------------------------------------------

/** Two plans may share at most this many of the 8 slots (keeps the three distinct). */
export const MAX_SHARED_SLOTS = 4;
