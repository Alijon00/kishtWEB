#!/usr/bin/env python3
"""
Build public/data/grace_trend.json from JPL GRACE/GRACE-FO mascons.

What this does, in one sentence: for every 0.5° cell it fits a straight line to
the monthly "liquid water equivalent thickness" (lwe_thickness) over 2003-2024
and stores the slope in cm/year, then crops the grid to the regions Kisht cares
about and writes a small JSON the browser can read.

IMPORTANT HONESTY NOTE (carried into the UI): lwe_thickness is TOTAL water
storage anomaly — groundwater + soil moisture + snow + surface water combined,
at ~300 km resolution. It is NOT a well-water level. The app says so explicitly.

Data set:
  JPL GRACE/GRACE-FO Mascon RL06.3 CRI, gridded, global, monthly since 2002.
  PO.DAAC short_name: TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4
  (One NetCDF file holds the whole time series. ~1 GB.)

Two ways to get the data (see scripts/grace/README.md for the full walkthrough):
  A)  earthaccess (recommended) — this script logs in and downloads for you:
        python build.py --download
  B)  Manual — download the .nc yourself from PO.DAAC, then:
        python build.py --file data/GRCTellus.JPL....nc

Requires: earthaccess, xarray, netCDF4, numpy  (see requirements.txt)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

SHORT_NAME = "TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4"

TREND_START_YEAR = 2003
TREND_END_YEAR = 2024

REGIONS = {
    "Central Asia": (35.0, 46.0, 55.0, 80.0),
    "South Asia": (6.0, 37.0, 60.0, 92.0),
    "East Africa": (-12.0, 18.0, 28.0, 52.0),
}

SAMPLE_POINTS = {
    "Vakhsh valley (TJ)": (37.9, 68.8),
    "Punjab (IN/PK, ~Ludhiana)": (30.9, 75.85),
    "Nakuru (KE)": (-0.30, 36.07),
}

SIZE_BUDGET_BYTES = 2 * 1024 * 1024

OUT_PATH = Path(__file__).resolve().parents[2] / "public" / "data" / "grace_trend.json"
DATA_DIR = Path(__file__).resolve().parent / "data"

def download_with_earthaccess() -> Path:
    """Log in to NASA Earthdata and download the mascon file. Returns its path."""
    import earthaccess

    print("Logging in to NASA Earthdata (uses ~/.netrc or prompts)...")
    earthaccess.login(persist=True)

    print(f"Searching PO.DAAC for {SHORT_NAME} ...")
    results = earthaccess.search_data(short_name=SHORT_NAME)
    if not results:
        sys.exit(
            f"No granules found for {SHORT_NAME}. The short_name may have changed; "
            "check https://podaac.jpl.nasa.gov and update SHORT_NAME in this script."
        )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {len(results)} file(s) to {DATA_DIR} ...")
    files = earthaccess.download(results, str(DATA_DIR))
    nc = [Path(f) for f in files if str(f).endswith(".nc")]
    if not nc:
        sys.exit("Download finished but no .nc file was produced.")
    return nc[0]

def decimal_years(time_values) -> np.ndarray:
    """Convert an xarray/cftime/np.datetime64 time axis to decimal years."""
    import pandas as pd

    ts = pd.to_datetime(np.asarray(time_values))
    year = ts.year.to_numpy().astype(float)
    start_of_year = pd.to_datetime(dict(year=ts.year, month=1, day=1))
    next_year = pd.to_datetime(dict(year=ts.year + 1, month=1, day=1))
    frac = (ts - start_of_year) / (next_year - start_of_year)
    return year + frac.to_numpy()

def per_cell_trend(lwe: np.ndarray, years: np.ndarray) -> np.ndarray:
    """
    Least-squares slope (cm/year) for every cell of lwe[time, lat, lon].

    NaNs (ocean / fill) propagate to a NaN slope. Vectorised over all cells.
    """
    t = years - years.mean()
    denom = np.sum(t * t)
    tt = t[:, None, None]
    ybar = np.nanmean(lwe, axis=0)
    slope = np.nansum(tt * (lwe - ybar), axis=0) / denom
    valid_counts = np.sum(~np.isnan(lwe), axis=0)
    slope = np.where(valid_counts >= 12, slope, np.nan)
    return slope

def nearest_cell(slope, lats, lons, lat, lon):
    """Trend at the grid cell nearest (lat, lon). Handles 0..360 longitudes."""
    lon_q = lon % 360.0 if lons.max() > 180.0 else lon
    i = int(np.argmin(np.abs(lats - lat)))
    j = int(np.argmin(np.abs(lons - lon_q)))
    return slope[i, j], float(lats[i]), float(lons[j])

def to_minus180(lons: np.ndarray):
    """Return longitudes in -180..180 and the index order to apply to data."""
    if lons.max() <= 180.0:
        return lons, np.arange(len(lons))
    shifted = ((lons + 180.0) % 360.0) - 180.0
    order = np.argsort(shifted)
    return shifted[order], order

def crop_region(slope, lats, lons):
    """Crop to the union bounding box of REGIONS; keep rectangular for a simple grid."""
    lat_min = min(r[0] for r in REGIONS.values())
    lat_max = max(r[1] for r in REGIONS.values())
    lon_min = min(r[2] for r in REGIONS.values())
    lon_max = max(r[3] for r in REGIONS.values())
    ii = np.where((lats >= lat_min) & (lats <= lat_max))[0]
    jj = np.where((lons >= lon_min) & (lons <= lon_max))[0]
    return slope[np.ix_(ii, jj)], lats[ii], lons[jj]

def round_grid(slope):
    """Round to 0.1 cm/yr; NaN -> None (JSON null) to keep the file honest + small."""
    out = []
    for row in slope:
        out.append([None if np.isnan(v) else round(float(v), 1) for v in row])
    return out

def build_json(slope, lats, lons, source_file: str) -> dict:
    return {
        "meta": {
            "source": "JPL GRACE/GRACE-FO Mascon RL06.3 CRI (PO.DAAC)",
            "shortName": SHORT_NAME,
            "variable": "lwe_thickness",
            "quantity": "total water storage anomaly "
            "(groundwater + soil moisture + snow + surface water)",
            "units": "cm/year",
            "trendPeriod": f"{TREND_START_YEAR}-01..{TREND_END_YEAR}-12",
            "resolutionKm": 300,
            "nativeCellDeg": 0.5,
            "note": "Linear least-squares slope of monthly lwe_thickness. "
            "Mascon scale factors are NOT applied (regional trend, documented).",
            "generatedFrom": source_file,
        },
        "grid": {
            "lat0": round(float(lats[0]), 3),
            "lon0": round(float(lons[0]), 3),
            "dlat": round(float(lats[1] - lats[0]), 3),
            "dlon": round(float(lons[1] - lons[0]), 3),
            "nlat": int(len(lats)),
            "nlon": int(len(lons)),
            "lonConvention": "-180..180",
        },
        "values": round_grid(slope),
    }

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--download", action="store_true",
                    help="Download the mascon file via earthaccess (needs Earthdata login).")
    ap.add_argument("--file", type=str, default=None,
                    help="Path to a mascon .nc you already downloaded.")
    ap.add_argument("--world", action="store_true",
                    help="Export the whole globe instead of cropping to regions.")
    args = ap.parse_args()

    if args.download:
        nc_path = download_with_earthaccess()
    elif args.file:
        nc_path = Path(args.file)
        if not nc_path.exists():
            sys.exit(f"File not found: {nc_path}")
    else:
        sys.exit("Pass --download (earthaccess) or --file <path-to-.nc>. See README.md.")

    import xarray as xr

    print(f"Opening {nc_path} ...")
    ds = xr.open_dataset(nc_path)
    if "lwe_thickness" not in ds:
        sys.exit(f"lwe_thickness not in dataset. Variables: {list(ds.data_vars)}")

    da = ds["lwe_thickness"]
    years_all = decimal_years(da["time"].values)
    mask = (years_all >= TREND_START_YEAR) & (years_all < TREND_END_YEAR + 1)
    da = da.isel(time=np.where(mask)[0])
    years = years_all[mask]
    print(f"{len(years)} monthly solutions in {TREND_START_YEAR}-{TREND_END_YEAR} "
          f"(expected ~{(TREND_END_YEAR - TREND_START_YEAR + 1) * 12} minus the "
          "2017-18 mission gap).")

    lats = da["lat"].values.astype(float)
    lons = da["lon"].values.astype(float)
    lwe = da.values.astype(float)

    slope = per_cell_trend(lwe, years)

    print("\nGRACE total-water-storage trend, 2003-2024 (cm/year):")
    print("  negative = drying / water leaving storage\n")
    for name, (lat, lon) in SAMPLE_POINTS.items():
        val, clat, clon = nearest_cell(slope, lats, lons, lat, lon)
        shown = "no data" if np.isnan(val) else f"{val:+.2f} cm/yr"
        print(f"  {name:<30} {shown}   (cell {clat:.2f}, {clon:.2f})")
    print()

    lons180, order = to_minus180(lons)
    slope = slope[:, order]
    lons = lons180
    if not args.world:
        slope, lats, lons = crop_region(slope, lats, lons)

    payload = build_json(slope, lats, lons, nc_path.name)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"))
    OUT_PATH.write_text(text)
    size = len(text.encode("utf-8"))
    print(f"Wrote {OUT_PATH} ({size/1024:.0f} KB, "
          f"{payload['grid']['nlat']}x{payload['grid']['nlon']} cells).")
    if size > SIZE_BUDGET_BYTES:
        print(f"WARNING: {size/1024/1024:.1f} MB exceeds the 2 MB budget. "
              "Tighten REGIONS or drop --world.")

if __name__ == "__main__":
    main()
