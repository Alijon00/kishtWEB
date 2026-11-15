/** A single demo location the user can select. */
export interface Site {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** One month of parsed, unit-normalized NASA POWER data for a point. */
export interface MonthlyRecord {
  year: number;
  /** 1–12 (annual YYYY13 rollups are filtered out during parsing). */
  month: number;
  /** Mean 2 m air temperature, °C. */
  t2m: number;
  /** Mean daily maximum 2 m air temperature, °C. */
  t2mMax: number;
  /** Total precipitation for the month, mm (converted from NASA's mm/day). */
  precipMm: number;
  /** Root-zone soil wetness, 0–1 (NASA POWER GWETROOT / MERRA-2). Optional:
   *  absent in older cached records fetched before this parameter was added. */
  gwetroot?: number;
}
