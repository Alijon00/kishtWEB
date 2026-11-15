# GRACE / GRACE-FO groundwater trend builder

This produces `public/data/grace_trend.json`: a small grid of **total water
storage trend in cm/year (2003–2024)** that Kisht reads to tell whether water
under a field is falling, stable, or rising.

> **Honesty note.** GRACE measures **all** water in a ~300 km column —
> groundwater **plus** soil moisture, snow, and surface water. This is **not** a
> well-water level. The UI says exactly this; please keep that wording.

We compute it **once, offline**, because the raw data is NetCDF behind a NASA
Earthdata login and can't be fetched from a browser.

---

## Step 0 — Install the tools

```bash
cd scripts/grace
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Step 1 — Create a free NASA Earthdata account (one time, ~2 min)

1. Go to <https://urs.earthdata.nasa.gov/users/new>.
2. Register (name, email, username, password). It's free, no approval wait.
3. Confirm your email.
4. **Authorize the data app:** log in, go to **Applications → Authorized Apps**,
   and make sure **"PO.DAAC Cloud"** and **"PO.DAAC Drive"** are approved. (The
   first download will otherwise prompt you to approve.)

Put your credentials where `earthaccess` can find them — create `~/.netrc`:

```
machine urs.earthdata.nasa.gov login YOUR_USERNAME password YOUR_PASSWORD
```

```bash
chmod 600 ~/.netrc
```

(Or skip `.netrc` — `earthaccess.login()` will prompt you interactively the
first time and offer to save it.)

## Step 2 — Build the file

**Option A — let the script download it (recommended):**

```bash
python build.py --download
```

This logs in, finds the JPL mascon collection
`TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` on PO.DAAC, downloads the NetCDF
(~1 GB, one-time) into `scripts/grace/data/`, computes the trend, and writes the
JSON.

**Option B — download the file by hand, then point at it:**

1. Open <https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4>.
2. Click **Data Access → Download Data** and grab the single gridded `.nc`
   (filename starts with `GRCTellus.JPL....nc`). Save it to `scripts/grace/data/`.
3. Run:

```bash
python build.py --file data/GRCTellus.JPL.<...>.nc
```

## What you'll see

Before writing anything, the script prints the sanity-check points so we
can eyeball them **before wiring into the app** (the three Tajik demo fields,
plus Punjab as a validation reference against Rodell et al. 2009):

```
GRACE total-water-storage trend, 2003-2024 (cm/year):
  negative = drying / water leaving storage

  Vakhsh valley (TJ)                 -0.7X cm/yr   (cell 37.75, 68.75)
  Sughd / Fergana valley (TJ)        -0.7X cm/yr   (cell 40.25, 69.25)
  Hissar valley (TJ)                 -0.7X cm/yr   (cell 38.75, 68.75)
  Punjab (IN/PK, ~Ludhiana)          -4.XX cm/yr   (cell 30.75, 75.75)  # validation only

Wrote .../public/data/grace_trend.json (NNN KB, ...)
```

**Paste that block back to me** and I'll confirm the thresholds and wire it in.

---

## Design choices (all explainable, no black boxes)

- **Trend window 2003–2024.** Skips the noisy first GRACE months; 2024 is the
  last full year.
- **Mission gap (2017-06 → 2018-06).** Those months are simply absent from the
  time axis. We fit **one** least-squares line across the whole span — the
  standard, defensible approach. The slope *is* the trend.
- **Scale factors not applied.** The gridded mascon ships with a scale-factor
  field for recovering point values; for a **regional multi-year trend** it's
  common to omit it, and doing so keeps the pipeline one honest step. Noted in
  the JSON `meta`.
- **Size budget 2 MB.** We crop to Central Asia + South Asia + East Africa
  (`REGIONS` in `build.py`). Use `--world` for the globe; the script warns if it
  busts 2 MB.
- **Rounding 0.1 cm/yr**, ocean/no-data → `null`.

## Keep the big file out of git

The `.nc` is ~1 GB — don't commit it. Add to `.gitignore`:

```
scripts/grace/data/
```

Only the small `public/data/grace_trend.json` belongs in the repo.
