# Kisht — climate-smart crop rotation

**Kisht** helps smallholder farmers decide *what to plant, and in what order,* on a changing
climate. You pick a field on a map; Kisht pulls that spot's real climate history, soil,
groundwater trend, **terrain (slope) and root-zone soil moisture** from NASA and open data, then
proposes three explainable 4-year crop rotations — and shows the data-to-decision reasoning
behind every one. Built for the **NASA Space Apps Challenge 2026**.

> 🌍 **Live demo:** https://YOUR-PROJECT.vercel.app  <!-- TODO: replace with your real Vercel URL -->
>
> 🖥️ **Screenshot:** _add `docs/screenshot.png` and it will show below_
>
> ![Kisht screenshot](docs/screenshot.png)

---

## What it does (the 3 steps)

1. **Field** — pick a point on the map, search a place, or use your location. Three example
   fields are one click away (Vakhsh valley, Tajikistan · Punjab, India · Nakuru, Kenya).
2. **What changed** — what actually changed on that field, comparing **1995–2004** with
   **2015–2024**: summer temperature, yearly rainfall, very-hot-month count and the warming
   trend (NASA POWER), plus cards for **soil** (SoilGrids), **water storage** (GRACE-FO),
   **root-zone soil moisture** (NASA POWER GWETROOT / MERRA-2) and **elevation & slope**
   (SRTM · AWS Terrain Tiles).
3. **Your plan** — compact priority sliders (save water / build soil / income / reliability)
   and crop selection up top, then **"Now vs best fit"** with a **What if?** stress test
   (−20 % rain, +2 °C, or both), and a collapsible **"Why this plan"** with the full
   **data → rule → decision** chain, the "what each crop needs" table, an honest "what Kisht
   does *not* know" block, the sources, and a **"NASA data used"** footer.

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
| **NASA POWER** | Monthly temperature & rainfall, 1995–2024 (~50 km), **and GWETROOT root-zone soil moisture** (MERRA-2) — climate history, trends and whether the soil is drying | https://power.larc.nasa.gov/ |
| **NASA/JPL GRACE-FO** (PO.DAAC mascons) | Total-water-storage trend 2003–2024 (~300 km) — whether stored water is falling | https://grace.jpl.nasa.gov/ |
| **SRTM — AWS Terrain Tiles** (Mapzen "terrarium") | Elevation & slope (~30 m) — drives the erosion-risk rule on steep land | https://registry.opendata.aws/terrain-tiles/ |
| **SoilGrids — ISRIC** | Soil texture, organic carbon and pH at 250 m | https://soilgrids.org/ |
| **FAO Irrigation & Drainage Papers 56 / 33 / 29** | Crop water needs, yield-response and salinity tolerance (the crop table) | https://www.fao.org/land-water/ |
| **OpenStreetMap / Nominatim** | Place search and reverse geocoding | https://www.openstreetmap.org/copyright |
| **Esri World Imagery** | Satellite basemap option | https://www.esri.com/ |

### NASA data used (what each one gives)

- **NASA POWER (MERRA-2)** — monthly temperature & rainfall and root-zone soil moisture
  (GWETROOT), 1995–2024.
- **GRACE-FO (NASA/JPL)** — total water-storage trend, 2003–2024.
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
| **Punjab, India** | **−4.18** | severe depletion |
| **Vakhsh valley, Tajikistan** | **−0.71** | roughly stable |
| **Nakuru, Kenya** | **+2.84** | gaining water |

Our Punjab figure matches the published science: Rodell, Velicogna & Famiglietti (2009),
*"Satellite-based estimates of groundwater depletion in India,"* **Nature** 460, 999–1002
([doi:10.1038/nature08238](https://doi.org/10.1038/nature08238)) report groundwater loss across
NW India (Rajasthan, Punjab, Haryana) at **~4 cm/yr** of equivalent water height — the same order
and sign as our independent estimate. That's why Kisht scores a thirsty rice–wheat rotation on the
Punjab aquifer so harshly, and why "Now" (rice–wheat) lands far below the proposed plans on water.

## How the rotation engine works (plain language)

It's a transparent rules engine — **no machine learning, no black box.** Every threshold lives
in `src/lib/rotation/constants.ts` with a comment explaining why. A plan is **4 years × two
seasons = 8 slots** (a summer/kharif and a winter/rabi crop each year); any slot may be left
**fallow**. For a field it:

1. **Applies the scenario** (e.g. +2 °C, −20 % rain) to the field's conditions, scaling each
   season's rainfall.
2. **Rules out crops that can't grow here** — too hot for a crop's heat limit, or **too cool for
   a warm-season crop** (keeps cotton/sesame out of cool highlands). Very high/low soil pH is
   *not* an exclusion — it's a soft reliability penalty for salt-sensitive crops, because pH is
   not a salinity (EC) measurement.
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
   - **Reliability** — how comfortably the mix copes with heat, dryness and salinity; when
     **root-zone soil moisture (GWETROOT) is falling**, drought-tolerant crops get a reliability
     boost.
5. **Matches** those scores against the farmer's priority sliders (a weighted %).
6. **Picks three distinct plans** — best match, best water-saver, and soil-builder/highest-income
   — and also scores the farmer's **current rotation** ("Now") the same way, so the Rotation
   screen shows how much the proposal improves on today's practice.

Because it's rule-based, every recommendation is explainable on the **Why** screen, tied back to
the exact NASA/soil number that drove it.

## Works offline on demo day

For the three example fields, real NASA POWER (incl. GWETROOT) / SoilGrids / GRACE-FO / SRTM
terrain responses are pre-fetched into `public/data/demo/`. If a live API is slow (>8 s) or the
venue Wi-Fi drops, the app falls back to these and shows a small **"cached NASA data"** badge — so
the full 3-step flow still works with no network (only the map tiles need the internet). Build
them with `npx tsx scripts/demo/build-demo-cache.ts` (see `scripts/demo/README.md`).

## Limitations (what Kisht does *not* know)

- **Not money.** Income is a rough relative 1–5 value, not prices or input costs.
- **No local pests, diseases, weeds** or which seed varieties you can actually buy.
- **No water rights** — it doesn't know what your canal or well really delivers.
- **No soil salinity (EC).** Very high/low pH is treated as a salinity *risk*, not a measurement
  — check salinity locally.
- **Coarse data.** NASA POWER ~50 km, GRACE-FO ~300 km, SoilGrids 250 m, SRTM terrain ~30 m — one
  pixel covers your field and often its neighbours.
- **Approximate crop table.** Water/heat/salinity figures are FAO-based reference values, meant
  to be edited for a specific market and region.
- **Tajik translation needs a native-speaker review** (`src/i18n/tg.ts` is best-effort).

Treat Kisht as a **starting point for a conversation with a local agronomist**, not a final word.

## Tech stack

Vite · React · TypeScript · Recharts · Leaflet / react-leaflet · Vitest. Plain CSS, no UI
library. Three languages (English / Русский / Тоҷикӣ) via a dependency-free, type-checked
dictionary. Deployed as a static site on Vercel.

## Team

**localhost:404** — NASA Space Apps Challenge 2026.

## Use of AI

This project was built with **Claude Code (Anthropic)** as a pair-programming assistant. AI
helped with: project scaffolding, the data-fetch and parsing layers (NASA POWER / SoilGrids /
GRACE-FO), the rule-based rotation engine and its scoring, the three-language i18n system, the
unit tests, and this finalization pass (engine agronomy fixes, the offline demo cache, the
Vercel setup and documentation).

The **team** directed the product and its design, chose the data sources and agronomic rules,
verified the numbers against the live NASA/SoilGrids/GRACE APIs, and reviewed all generated
code. No AI/ML is used *in the app itself* — the recommendations come from the transparent,
inspectable rules described above.

> _Team note: adjust this section so it matches exactly how you divided the work._

## License

[MIT](LICENSE) © 2026 localhost:404.

