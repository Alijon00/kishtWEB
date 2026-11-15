import type { SlotSeason } from "./types";

export const PLAN_YEARS = [2027, 2028, 2029, 2030];

export const SEASONS: SlotSeason[] = ["summer", "winter"];

export const MAX_CROPS_PER_YEAR = 2;

export const RAINFED_SINGLE_SEASON_MM = 300;

export const CEREAL_FAMILY = "Poaceae";

export const BEAM_WIDTH = 400;

export const SCENARIO_RAIN_DELTA_PCT = -20;
export const SCENARIO_TEMP_DELTA_C = 2;

export const DIURNAL_MAX_OFFSET_C = 8;

export const TROPICS_LAT_DEG = 23.5;

export const PERENNIAL_MIN_YEARS = 2;
export const PERENNIAL_BLOCK_YEARS = [3, 2];

export const MAX_CONSECUTIVE_SAME_SEASON = 2;

export const STRONG_ALKALINE_PH = 8.5;
export const STRONG_ACIDIC_PH = 5.2;
export const SALINITY_RELIABILITY_PENALTY = 2.5;

export const WATER_DEFICIT_PER_POINT_MM = 250;
export const FALLING_PENALTY_PER_CM = 0.4;
export const FALLING_GROUNDWATER_PENALTY = 1.4;
export const WATER_PEAK_WEIGHT = 0.4;
export const WATER_SAVER_MAX_NEED_MM = 600;

export const SOIL_BASE = 2.0;
export const SOIL_PER_LEGUME_SLOT = 1.0;
export const SOIL_MAX_LEGUME_SLOTS = 3;
export const SOIL_PER_EXTRA_FAMILY = 1.1;
export const SOIL_PERENNIAL_BONUS = 1.0;
export const SOIL_FALLOW_PENALTY = 0.4;

export const EROSION_SLOPE_PCT = 8;
export const EROSION_FIELD_STEEP_SHARE_PCT = 25;
export const EROSION_ROW_CROP_IDS = ["cotton", "maize"];
export const EROSION_PERENNIAL_BONUS = 1.5;
export const EROSION_PER_LEGUME_SLOT = 0.5;
export const EROSION_MAX_LEGUME_SLOTS = 3;
export const EROSION_ROW_CROP_PENALTY = 1.5;

export const INCOME_SCALE = 2;

export const SOIL_MOISTURE_DROUGHT_BONUS = 0.5;

export const HEAT_SCORE_AT_ZERO_HEADROOM = 5;
export const HEAT_SCORE_PER_DEG = 0.8;

export const DROUGHT_SCORE_BASE = 5;
export const DROUGHT_PER_BAND = 1.5;
export const DROUGHT_DEFICIT_PER_POINT_MM = 200;
export const DROUGHT_MAX_STRESS = 6;

export const RELIABILITY_HOLDS_MIN = 6.5;
export const RELIABILITY_RISK_MAX = 4.0;
export const WATER_SHORT_MAX = 4.0;

export const GRACE_FALLING_MAX_CM_PER_YEAR = -1;
export const GRACE_RISING_MIN_CM_PER_YEAR = 1;

export const MAX_SHARED_SLOTS = 4;
