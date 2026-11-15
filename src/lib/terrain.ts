/**
 * SRTM-based elevation & slope from AWS Terrain Tiles (Mapzen "terrarium"
 * encoding). No API key, open CORS (Access-Control-Allow-Origin: *), so the
 * browser can read the PNG pixels directly off a canvas.
 *
 *   https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 *   elevation (m) = R * 256 + G + B / 256 − 32768
 *
 * We read zoom 12 (~30 m/pixel near the equator), take the elevation of the
 * point's pixel, and compute slope from the 3×3 pixel window around it using
 * Horn's method (the standard GIS slope algorithm). Pure math lives up top and
 * is unit-tested; the browser-only fetch (Image → canvas → getImageData) is at
 * the bottom.
 *
 * HONESTY: this is the SRTM-derived terrain surface resampled to the web-mercator
 * tile grid, not a survey. Near a tile edge the 3×3 window is clamped to the tile,
 * which can blur slope slightly; good enough for an erosion-risk flag.
 */

const TILE_SIZE = 256;
const EARTH_RADIUS_M = 6378137;

/**
 * Zoom level we read terrain at. Zoom 11 (~76 m/pixel at the equator, ~65 m at
 * 30° lat) over a 5×5 window spans ~300 m — enough to average out SRTM pixel
 * noise that made flat valley floors (Punjab, Vakhsh) read as several-% slopes.
 */
export const TERRAIN_ZOOM = 11;

/** Half-width of the slope window: 2 → a 5×5 pixel neighbourhood. */
export const SLOPE_WINDOW_RADIUS = 2;

/** At or below this slope (%) the land is treated as "Flat". */
export const SLOPE_FLAT_PCT = 2;

/** The terrarium tile URL for a tile coordinate. */
export function terrainTileUrl(z: number, x: number, y: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

/** Decode one terrarium RGB triple to metres above sea level. */
export function decodeElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Ground resolution (metres per pixel) at a latitude and zoom. */
export function groundResolutionM(lat: number, z: number): number {
  return (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * EARTH_RADIUS_M) / (TILE_SIZE * 2 ** z);
}

export interface TilePixel {
  tileX: number;
  tileY: number;
  /** Pixel within the tile, 0–255. */
  px: number;
  py: number;
}

/** Web-Mercator lon/lat → tile coordinate and pixel within that tile. */
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

/**
 * Slope (percent) from an odd-sized square window of elevations (metres), rows
 * top→bottom, by least-squares fitting a tilted plane z = a·x + b·y + c and
 * taking the gradient magnitude √(a²+b²)·100. `cellSizeM` is the ground distance
 * between pixels (already cos(lat)-scaled by the caller).
 *
 * A plane fit over a 5×5 window is far less sensitive to single-pixel SRTM noise
 * than a 3×3 finite difference, so flat land reads as flat. Because the window is
 * symmetric about its centre, the normal equations decouple to a = Σxz/Σx²,
 * b = Σyz/Σy². On a clean linear ramp this equals the finite-difference slope.
 */
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
  /** Elevation at the point, metres above sea level. */
  elevationM: number;
  /** Slope at the point, percent (rise/run × 100). */
  slopePct: number;
}

/**
 * Build a TerrainResult from a tile's raw RGBA pixel buffer. Pure: takes the
 * decoded pixel data so both the browser (canvas) and the Node demo-cache
 * builder can share the exact same elevation/slope maths.
 *
 * `data` is row-major RGBA (4 bytes/pixel), `width`×`width`. `channels` lets a
 * caller pass 3-byte RGB buffers too.
 */
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

// --- Browser fetch (canvas pixel read, localStorage cache) -------------------

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
    // best-effort
  }
}

/** Load a crossOrigin image (so the canvas stays untainted and readable). */
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

/**
 * Fetch elevation + slope for a point from AWS Terrain Tiles.
 * Returns null on a network/CORS failure so callers can fall back to the demo
 * cache (example points) or simply omit terrain from the plan.
 */
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
    // getImageData throws (SecurityError) if the canvas is tainted — i.e. CORS failed.
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
