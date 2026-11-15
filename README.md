# Kisht — climate-smart crop rotation

Kisht (Tajik: кишт — "sowing") · team localhost:404

🌍 Live demo: https://kisht-inky.vercel.app
💻 Code: https://github.com/Alijon00/kishtWEB

**Kisht** helps smallholder farmers decide *what to plant, and in what order,* on a changing
climate. You pick a field on a map; Kisht pulls that spot's real climate history, soil,
groundwater trend, **terrain (slope) and root-zone soil moisture** from NASA and open data, then
proposes three explainable 4-year crop rotations — and shows the data-to-decision reasoning
behind every one. Built for the **NASA Space Apps Challenge 2026**.


## How Kisht answers the challenge

- **NASA Earth observations** → NASA POWER climate **and** root-zone soil moisture (GWETROOT),
  GRACE-FO groundwater trend, SRTM terrain (elevation & slope), plus NASA GIBS **Blue Marble**
  imagery on the 3D globe.
- **Local soil information** → SoilGrids texture, organic carbon and pH for the exact point.
- **Crop characteristics** → an FAO-based crop table: seasonal water need, heat limit, salinity
  tolerance, nitrogen fixing and plant family.
- **Farmer priorities** → "What matters most?" (Balanced / Save water / Build soil / Income /
  Reliable) and the crops they can actually grow.
- **Explore rotation strategies** → three plans versus today's rotation, a "Test the future"
  stress test (+2 °C, −20 % rain), and a "Why this plan" trail tied back to the exact data.

---

## What it does (the 3 steps)

1. **Where is your field?** — spin a 3D globe (NASA GIBS **Blue Marble** at low zoom, Esri imagery
   up close), jump with the **continent buttons** (Asia / Africa / Europe / Americas / Oceania),
   search a place, or use your location. Three example fields — all real Tajik farmland (Vakhsh
   valley, Khatlon · Sughd / Fergana valley · Hissar valley) — appear when you focus the search.
   Picking a point fills the **"Your
   field"** card (place, coordinates and SoilGrids soil) and a compact **"NASA data for this
   field"** block that *prefetches* the climate / water / terrain datasets so the next step opens
   instantly.
2. **Here's what your field is dealing with** — an **"In short"** plain-language summary, then four
   cards comparing the baseline decade (**1996–2005**) with the recent decade (**2016–2025**) —
   the window advances automatically each year — across: **Climate** (temperature + rainfall, NASA
   POWER), **Water** (GRACE-FO groundwater trend + GWETROOT root-zone soil moisture), **Soil**
   (SoilGrids texture, organic carbon, pH) and **The land** (SRTM elevation & slope). The yearly
   charts are one click away under **"See the measurements"**.
3. **Your next four years** — set what matters with the segmented **"What matters most?"**
   (Balanced / Save water / Build soil / Income / Reliable), optionally adjust the crops you'd
   consider and what you grow today, then compare **Now vs Kisht** side by side with worded score
   bars and the four-year season grid. **"Test the future"** stress-tests every plan (+2 °C,
   −20 % rain, or both), and a collapsible **"Why this plan"** shows the full
   **data → rule → decision** chain, the "what each crop needs" table, an honest "what Kisht does
   *not* know" block, the sources, and a **"NASA data used"** footer.

Everything runs **in the browser** — no backend, no API key, no login.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build (warning-free)
npm run preview    # serve the production build locally
```

## Data sources

All data is fetched directly from the browser from free, open, CORS-enabled services.

| Source | What we use it for | Link |
| ------ | ------------------ | ---- |
| **NASA POWER** | Monthly temperature & rainfall over the last ~30 complete years (~50 km), **and GWETROOT root-zone soil moisture** (MERRA-2) — climate history, trends and whether the soil is drying | https://power.larc.nasa.gov/ |
| **NASA/JPL GRACE / GRACE-FO** (PO.DAAC mascons) | Total-water-storage trend 2003–2024 (~300 km) — whether stored water is falling | https://grace.jpl.nasa.gov/ |
| **NASA GIBS — Blue Marble** | Global imagery on the 3D globe at low zoom | https://nasa-gibs.github.io/gibs-api-docs/ |
| **SRTM — AWS Terrain Tiles** (Mapzen "terrarium") | Elevation & slope — drives the erosion-risk rule on steep land | https://registry.opendata.aws/terrain-tiles/ |
| **SoilGrids — ISRIC** | Soil texture, organic carbon and pH at 250 m | https://soilgrids.org/ |
| **FAO Irrigation & Drainage Papers 56 / 33 / 29** | Crop water needs, yield-response and salinity tolerance (the crop table) | https://www.fao.org/land-water/ |
| **OpenStreetMap / Nominatim** | Place search and reverse geocoding | https://www.openstreetmap.org/copyright |
| **Esri World Imagery** | Satellite basemap at higher zoom | https://www.esri.com/ |

### NASA data used (what each one gives)

- **NASA POWER (MERRA-2)** — monthly temperature & rainfall and root-zone soil moisture
  (GWETROOT) over the last ~30 complete years.
- **GRACE / GRACE-FO (NASA/JPL)** — total water-storage trend, 2003–2024.
- **NASA GIBS (Blue Marble)** — the imagery wrapped on the 3D globe at low zoom.
- **SRTM via AWS Terrain Tiles** — elevation & slope, for the erosion-risk rule.
- **SoilGrids (ISRIC)** — soil texture, organic carbon & pH (not NASA; fills the soil gap).

**US-only datasets (SSURGO, CDL, PRISM, NASS) don't cover our regions — a natural next step for
US farms.** They offer far higher-resolution soil, crop-type and climate layers for the United
States; wiring them in behind a region switch would sharpen Kisht for American growers without
changing the engine.

**Honesty note on GRACE-FO:** it measures *all* water in a ~300 km column — groundwater **plus**
soil moisture, snow and surface water — not a well level. The UI says exactly that.

GRACE raw data is NetCDF behind a NASA Earthdata login, so it's pre-computed **once, offline**
into a small JSON (`scripts/grace/build.py` → `public/data/grace_trend.json`); see
`scripts/grace/README.md`.

### GRACE-FO results for our three fields

We fit a linear trend to the JPL mascon total-water-storage record (2003–2024) at each field:

| Field | TWS trend (cm/yr) | Reading |
| ----- | ----------------- | ------- |
| **Vakhsh valley, Tajikistan** | **−0.7** | roughly stable |
| **Sughd / Fergana valley, Tajikistan** | **−0.7** | roughly stable |
| **Hissar valley, Tajikistan** | **−0.7** | roughly stable |

All three Tajik fields read as **roughly stable** — honest, and expected: GRACE-FO mascons are
~300 km, so these nearby irrigated valleys fall in cells with very similar total-water-storage
trends. (The app says plainly that GRACE measures *all* water in a ~300 km column, not a well.)

**Validation against published science (Punjab, India — not a UI example).** To check our trend
fit against a known result, we also ran the same pipeline on NW India. For **Punjab (≈30.9 N,
75.85 E)** we get a TWS trend of **−4.2 cm/yr** (severe depletion), which matches Rodell,
Velicogna & Famiglietti (2009), *"Satellite-based estimates of groundwater depletion in India,"*
**Nature** 460, 999–1002
([doi:10.1038/nature08238](https://doi.org/10.1038/nature08238)): they report groundwater loss
across NW India (Rajasthan, Punjab, Haryana) at **~4 cm/yr** of equivalent water height — the same
order and sign as our independent estimate. That agreement is why we trust the engine's harsh water
score for a thirsty rice–wheat rotation on a falling aquifer.

## How the rotation engine works (plain language)

It's a transparent rules engine — **no machine learning, no black box.** Every threshold lives in
`src/lib/rotation/constants.ts`. A plan is **4 years × two seasons = 8 slots** (a summer/kharif and
a winter/rabi crop each year); any slot may be left **fallow**. For a field it:

1. **Applies the scenario** (e.g. +2 °C, −20 % rain) to the field's conditions, scaling each
   season's rainfall.
2. **Rules out crops that can't grow here** — too hot for a crop's heat limit, or **too cool for
   a warm-season crop** (keeps cotton/sesame out of cool highlands). Very high or low soil pH is
   *not* an exclusion — pH is **not a salinity (EC) measurement**, so it only adds a soft
   reliability penalty for salt-sensitive crops.
3. **Searches 8-slot plans with a beam search** under hard agronomic rules: a crop only goes in
   its own season; never the same plant family in two adjacent slots; at least one cereal every
   year (unless the farmer unticked them all); at least one nitrogen-fixing legume when soil
   carbon is low. Dry rainfed land with no groundwater is planted **one season a year**.
4. **Scores** each plan 0–10 on four axes:
   - **Water** — each crop's need vs. the rain in *its own season*, with the single thirstiest
     crop weighted so it can't hide behind dry ones, and an extra penalty where groundwater is
     falling.
   - **Soil** — legumes, plant-family diversity and a perennial build the score; a cereal
     monoculture (e.g. rice–wheat) sits near the floor. On **steep land (SRTM slope > 8 %)** an
     erosion adjustment rewards soil-holding cover (perennials, legumes) and penalises row crops
     (cotton, maize) grown two years running.
   - **Income** — rough relative crop value (fallow earns nothing).
   - **Reliability** — how comfortably the mix copes with heat and dryness, with a soft penalty
     for salt-sensitive crops on very high/low pH; when **root-zone soil moisture (GWETROOT) is
     falling**, drought-tolerant crops get a reliability boost.
5. **Matches** those scores against the farmer's "What matters most?" priorities (a weighted %).
6. **Picks three distinct plans** — best match, best water-saver, and soil-builder/highest-income
   — and also scores the farmer's **current rotation** ("Now") the same way, so the plan screen
   shows **Now vs Kisht** side by side.

Because it's rule-based, every recommendation is explainable in the collapsible **"Why this plan"**
section, tied back to the exact NASA/soil number that drove it.

## Works offline on demo day

For the three example fields, real NASA POWER (incl. GWETROOT) / SoilGrids / GRACE-FO / SRTM
terrain responses are pre-fetched into `public/data/demo/`. If a live API is slow (>8 s) or the
venue Wi-Fi drops, the app falls back to these and shows a small **"cached NASA data"** badge — so
the full 3-step flow still works with no network (only the map tiles need the internet). Build
them with `npx tsx scripts/demo/build-demo-cache.ts` (see `scripts/demo/README.md`).

Verify the cached demo data against NASA yourself: `python3 scripts/verify_power.py`.

## Limitations (what Kisht does *not* know)

- **Not money.** Income is a rough relative 1–5 value, not prices or input costs.
- **No local pests, diseases, weeds** or which seed varieties you can actually buy.
- **No water rights** — it doesn't know what your canal or well really delivers.
- **No soil salinity (EC).** pH is **not** a salinity measurement; very high/low pH only adds a
  soft reliability penalty, and salinity itself is **not measured** — check it locally.
- **Coarse data.** NASA POWER ~50 km, GRACE-FO ~300 km, SoilGrids 250 m, SRTM terrain ~65 m/pixel
  (slope fit over a ~300 m window) — one pixel covers your field and often its neighbours.
- **Approximate crop table.** Water/heat/salinity figures are FAO-based reference values, meant
  to be edited for a specific market and region.
- **GRACE-FO trend ends at 2024** (*follow-up*). The POWER climate record advances automatically
  each year, but the GRACE / GRACE-FO total-water-storage trend is still fixed at **2003–2024** — extending
  it needs an Earthdata mascon rebuild (`scripts/grace/`). Until then the groundwater trend is one
  year behind the climate panels.
- **Soil can be unavailable.** When SoilGrids can't return a value for a point (e.g. open water, or
  an API timeout), Kisht falls back to **typical values** for the plan and says so — it never
  presents them as a measurement of your field.
- **Tajik translation needs a native-speaker review** (`src/i18n/tg.ts` is best-effort).

Treat Kisht as a **starting point for a conversation with a local agronomist**, not a final word.

## Tech stack

Vite · React · TypeScript · **MapLibre GL JS** (3D globe; Leaflet flat-map fallback when WebGL is
unavailable) · Recharts · Vitest. Plain CSS, no UI library; Inter bundled locally via
`@fontsource` so the app works offline. Three languages (English / Русский / Тоҷикӣ) via a
dependency-free, type-checked dictionary. Ships as a static site (Vercel-ready).

## Team

- Rustamov Alijon — captain, product & frontend
- Akramov Rizo — data validation (Python checks against the NASA POWER API)
- Mirzoev Yamin — speaker, pitch & presentation

## Use of AI

This project was built with **Claude Code (Anthropic)** as a pair-programming assistant. AI
helped with: project scaffolding, the data-fetch and parsing layers (NASA POWER / SoilGrids /
GRACE-FO / SRTM), the rule-based rotation engine and its scoring, the three-language i18n system,
the unit tests, and the finalization pass (engine agronomy fixes, the MapLibre globe, the offline
demo cache and documentation).

The **team** directed the product and its design, chose the data sources and agronomic rules,
verified the numbers against the live NASA/SoilGrids/GRACE APIs, and reviewed all generated
code. No AI/ML is used *in the app itself* — the recommendations come from the transparent,
inspectable rules described above.

## License

MIT — see [LICENSE](LICENSE).
