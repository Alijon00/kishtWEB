export interface Site {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface MonthlyRecord {
  year: number;
  month: number;
  t2m: number;
  t2mMax: number;
  precipMm: number;
  gwetroot?: number;
}
