/**
 * Presentation-only helper: classify a crop into one of four visual "plaque"
 * categories used to colour crop names in the rotation table / selector.
 *
 * This is purely cosmetic — it reads the existing crop reference data and does
 * NOT influence the rotation engine, scoring, or any decision. The colours
 * themselves live in styles.css under [data-crop="…"].
 */
import { CROP_BY_ID, waterNeedMid, type Crop } from "../data/crops";

export type CropLook = "water" | "legume" | "drought" | "other";

/** Seasonal water need (mm) at or above which a crop reads as "water-hungry". */
const WATER_HUNGRY_MM = 800;

export function cropLook(crop: Crop): CropLook {
  // Order matters: the water warning wins even for water-hungry legumes
  // (e.g. alfalfa), then nitrogen-fixers, then the drought-hardy cereals.
  if (waterNeedMid(crop) >= WATER_HUNGRY_MM) return "water";
  if (crop.fixesNitrogen) return "legume";
  if (crop.droughtTolerance === 3) return "drought";
  return "other";
}

/** Convenience lookup by crop id; "other" if the id is unknown. */
export function cropLookById(id: string | null | undefined): CropLook {
  if (!id) return "other";
  const c = CROP_BY_ID[id];
  return c ? cropLook(c) : "other";
}
