import { CROP_BY_ID, waterNeedMid, type Crop } from "../data/crops";

export type CropLook = "water" | "legume" | "drought" | "other";

const WATER_HUNGRY_MM = 800;

export function cropLook(crop: Crop): CropLook {
  if (waterNeedMid(crop) >= WATER_HUNGRY_MM) return "water";
  if (crop.fixesNitrogen) return "legume";
  if (crop.droughtTolerance === 3) return "drought";
  return "other";
}

export function cropLookById(id: string | null | undefined): CropLook {
  if (!id) return "other";
  const c = CROP_BY_ID[id];
  return c ? cropLook(c) : "other";
}
