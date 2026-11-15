import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { powerUrl } from "../../src/lib/nasaPower";
import { parseSoilGrids, soilGridsUrl } from "../../src/lib/soilgrids";
import { lookupGrace, type GraceGrid, type GraceResult } from "../../src/lib/grace";
import {
  groundResolutionM,
  lonLatToTilePixel,
  terrainFromPixels,
  terrainTileUrl,
  TERRAIN_ZOOM,
  type TerrainResult,
} from "../../src/lib/terrain";

const POINTS = [
  { id: "vakhsh", lat: 37.7, lon: 68.8 },
  { id: "sughd", lat: 40.2, lon: 69.2 },
  { id: "hissar", lat: 38.55, lon: 68.65 },
];

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT_DIR = `${ROOT}public/data/demo`;
const GRACE_FILE = `${ROOT}public/data/grace_trend.json`;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// SoilGrids (rest.isric.org) is often slow and flaky — it will time out on one
// call and answer the next. We retry hard, and we only accept a response that
// parses into a COMPLETE soil profile. We never write a null/fallback soil.
async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getSoilOrThrow(lat: number, lon: number): Promise<unknown> {
  const url = soilGridsUrl(lat, lon);
  const attempts = 8;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const json = await fetchJsonWithTimeout(url, 45_000);
      const profile = parseSoilGrids(json as Parameters<typeof parseSoilGrids>[0]);
      if (profile) return json; // store the RAW response; the app re-parses it
      lastErr = new Error("SoilGrids returned no usable profile (open water / no-data pixel?)");
    } catch (err) {
      lastErr = err;
    }
    process.stdout.write(`soil retry ${i + 1}/${attempts}… `);
    await sleep(3000);
  }
  throw new Error(
    `SoilGrids failed after ${attempts} attempts: ${(lastErr as Error)?.message ?? lastErr}`,
  );
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buf: Buffer): { width: number; channels: number; data: Uint8Array } {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) throw new Error("Not a PNG");
  }
  let width = 0;
  let height = 0;
  let colorType = 2;
  const idat: Buffer[] = [];
  let pos = 8;
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const chunk = buf.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  let prev = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = new Uint8Array(raw.subarray(rp, rp + stride));
    rp += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) v = (v + paeth(a, b, c)) & 255;
      line[x] = v;
    }
    out.set(line, y * stride);
    prev = line;
  }
  return { width, channels, data: out };
}

async function getTerrain(lat: number, lon: number): Promise<TerrainResult> {
  const { tileX, tileY, px, py } = lonLatToTilePixel(lat, lon, TERRAIN_ZOOM);
  const res = await fetch(terrainTileUrl(TERRAIN_ZOOM, tileX, tileY));
  if (!res.ok) throw new Error(`HTTP ${res.status} for terrain tile`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { width, channels, data } = decodePng(buf);
  const cell = groundResolutionM(lat, TERRAIN_ZOOM);
  return terrainFromPixels(data, width, px, py, cell, channels);
}

async function loadGraceGrid(): Promise<GraceGrid | null> {
  try {
    return JSON.parse(await readFile(GRACE_FILE, "utf8")) as GraceGrid;
  } catch {
    console.warn(
      "  ! public/data/grace_trend.json not found — GRACE will be null in the demo files.\n" +
        "    Run scripts/grace/build.py first if you want cached groundwater.",
    );
    return null;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const grid = await loadGraceGrid();

  for (const p of POINTS) {
    process.stdout.write(`${p.id} (${p.lat}, ${p.lon}) … `);

    const power = await getJson(powerUrl(p.lat, p.lon));

    // Hard requirement: a real, complete SoilGrids profile or we stop. No fallback.
    const soil = await getSoilOrThrow(p.lat, p.lon);

    const grace: GraceResult | null = grid ? lookupGrace(grid, p.lat, p.lon) : null;

    let terrain: TerrainResult | null = null;
    try {
      terrain = await getTerrain(p.lat, p.lon);
    } catch (err) {
      console.warn(`\n  ! Terrain failed for ${p.id}: ${(err as Error).message}`);
    }

    const bundle = {
      id: p.id,
      lat: p.lat,
      lon: p.lon,
      fetchedAt: new Date().toISOString(),
      power,
      soil,
      grace,
      terrain,
    };

    await writeFile(`${OUT_DIR}/${p.id}.json`, JSON.stringify(bundle), "utf8");
    const g = grace ? `${grace.trendCmPerYear} cm/yr (${grace.category})` : "none";
    const t = terrain ? `${terrain.elevationM} m / ${terrain.slopePct}%` : "none";
    console.log(`ok  [power ✓, soil ${soil ? "✓" : "—"}, grace ${g}, terrain ${t}]`);
  }

  console.log(`\nWrote ${POINTS.length} files to public/data/demo/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
