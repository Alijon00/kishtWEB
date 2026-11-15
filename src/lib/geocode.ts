const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export interface PlaceResult {
  lat: number;
  lon: number;
  displayName: string;
}

interface NominatimSearchItem {
  lat: string;
  lon: string;
  display_name: string;
}

export async function searchPlace(
  query: string,
  opts: { signal?: AbortSignal } = {},
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    format: "json",
    q,
    limit: "5",
    "accept-language": "en",
  });
  const res = await fetch(`${SEARCH_URL}?${params}`, {
    signal: opts.signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status}).`);
  const items = (await res.json()) as NominatimSearchItem[];
  return items.map((i) => ({
    lat: Number(i.lat),
    lon: Number(i.lon),
    displayName: i.display_name,
  }));
}

interface NominatimReverse {
  display_name?: string;
  address?: Record<string, string>;
}

function shortName(data: NominatimReverse): string | null {
  const a = data.address;
  if (!a) return data.display_name ?? null;
  const locality =
    a.village || a.town || a.city || a.hamlet || a.county || a.state_district || a.state;
  const country = a.country;
  if (locality && country) return `${locality}, ${country}`;
  if (country) return country;
  return data.display_name ?? null;
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const params = new URLSearchParams({
    format: "json",
    lat: String(lat),
    lon: String(lon),
    zoom: "10",
    "accept-language": "en",
  });
  try {
    const res = await fetch(`${REVERSE_URL}?${params}`, {
      signal: opts.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimReverse;
    return shortName(data);
  } catch {
    return null;
  }
}
