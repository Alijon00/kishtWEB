const TILE_SIZE = 256;
const EARTH_RADIUS_M = 6378137;

export const TERRAIN_ZOOM = 11;

export const SLOPE_WINDOW_RADIUS = 2;

export const SLOPE_FLAT_PCT = 2;

export function terrainTileUrl(z: number, x: number, y: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

export function decodeElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function groundResolutionM(lat: number, z: number): number {
  return (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * EARTH_RADIUS_M) / (TILE_SIZE * 2 ** z);
}

export interface TilePixel {
  tileX: number;
  tileY: number;
  px: number;
  py: number;
}

export function lonLatToTilePixel(lat: number, lon: number, z: number): TilePixel {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const xf = ((lon + 180) / 360) * n;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(xf);
  const tileY = Math.floor(yf);
  const px = Math.min(TILE_SIZE - 1, Math.max(0, Math.floor((xf - tileX) * TILE_SIZE)));
  const py = Math.min(TILE_SIZE - 1, Math.max(0, Math.floor((yf - tileY) * TILE_SIZE)));
  return { tileX, tileY, px, py };
}

export function slopePctFromWindow(grid: number[][], cellSizeM: number): number {
  const n = grid.length;
  const centre = (n - 1) / 2;
  let sxz = 0;
  let syz = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = (j - centre) * cellSizeM;
      const y = (i - centre) * cellSizeM;
      const z = grid[i][j];
      sxz += x * z;
      syz += y * z;
      sxx += x * x;
      syy += y * y;
    }
  }
  const a = sxx ? sxz / sxx : 0;
  const b = syy ? syz / syy : 0;
  return Math.sqrt(a * a + b * b) * 100;
}

export interface TerrainResult {
  elevationM: number;
  slopePct: number;
}

export function terrainFromPixels(
  data: Uint8Array | Uint8ClampedArray | number[],
  width: number,
  px: number,
  py: number,
  cellSizeM: number,
  channels = 4,
): TerrainResult {
  const elevAt = (x: number, y: number): number => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(width - 1, Math.max(0, y));
    const idx = (cy * width + cx) * channels;
    return decodeElevation(data[idx], data[idx + 1], data[idx + 2]);
  };
  const r = SLOPE_WINDOW_RADIUS;
  const window: number[][] = [];
  for (let dy = -r; dy <= r; dy++) {
    const row: number[] = [];
    for (let dx = -r; dx <= r; dx++) row.push(elevAt(px + dx, py + dy));
    window.push(row);
  }
  return {
    elevationM: Math.round(elevAt(px, py)),
    slopePct: Math.round(slopePctFromWindow(window, cellSizeM) * 10) / 10,
  };
}

const CACHE_VERSION = "v1";
const cacheKey = (lat: number, lon: number) =>
  `kisht:terrain:${CACHE_VERSION}:${lat.toFixed(3)},${lon.toFixed(3)}`;

function readCache(lat: number, lon: number): TerrainResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon));
    return raw ? (JSON.parse(raw) as TerrainResult) : null;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, value: TerrainResult): void {
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify(value));
  } catch {
  }
}

function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const onAbort = () => {
      img.src = "";
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
    img.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Terrain tile failed to load (network or CORS)."));
    };
    img.src = url;
  });
}

export async function fetchTerrain(
  lat: number,
  lon: number,
  opts: { signal?: AbortSignal } = {},
): Promise<TerrainResult | null> {
  const cached = readCache(lat, lon);
  if (cached) return cached;

  const { tileX, tileY, px, py } = lonLatToTilePixel(lat, lon, TERRAIN_ZOOM);
  try {
    const img = await loadImage(terrainTileUrl(TERRAIN_ZOOM, tileX, tileY), opts.signal);
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    const cell = groundResolutionM(lat, TERRAIN_ZOOM);
    const result = terrainFromPixels(data, TILE_SIZE, px, py, cell, 4);
    writeCache(lat, lon, result);
    return result;
  } catch (err) {
    if (opts.signal?.aborted) return null;
    return null;
  }
}
