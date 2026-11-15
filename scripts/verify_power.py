#!/usr/bin/env python3
"""Check Kisht's cached demo data against the live NASA POWER API.

For every file in public/data/demo/*.json this script re-downloads the same
NASA POWER monthly series (same point, parameters and years) and compares it
value by value with what the app ships offline.

Run from the repo root:  python3 scripts/verify_power.py
Needs only Python 3 and an internet connection. Exit code 0 = cache matches NASA.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = ROOT / "public" / "data" / "demo"
API = "https://power.larc.nasa.gov/api/temporal/monthly/point"
FILL = -999
ABS_TOL = 0.05
REL_TOL = 0.02
MAX_MISMATCH_SHARE = 0.01


def fetch_power(lat, lon, params, start, end):
    query = urllib.parse.urlencode({
        "parameters": ",".join(params),
        "community": "AG",
        "latitude": lat,
        "longitude": lon,
        "start": start,
        "end": end,
        "format": "JSON",
    })
    url = f"{API}?{query}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as resp:
                return json.load(resp)["properties"]["parameter"]
        except (urllib.error.URLError, TimeoutError) as err:
            if attempt == 2:
                raise
            print(f"     retrying after error: {err}")
            time.sleep(3)


def close_enough(cached, live):
    return abs(cached - live) <= ABS_TOL + REL_TOL * abs(live)


def compare(cached, live):
    compared = mismatches = missing = 0
    worst = (0.0, None)
    for param, series in cached.items():
        live_series = live.get(param, {})
        for key, value in series.items():
            if value == FILL:
                continue
            live_value = live_series.get(key)
            if live_value is None or live_value == FILL:
                missing += 1
                continue
            compared += 1
            diff = abs(value - live_value)
            if diff > worst[0]:
                worst = (diff, f"{param} {key}: cached {value}, NASA {live_value}")
            if not close_enough(value, live_value):
                mismatches += 1
    return compared, mismatches, missing, worst


def check_site(file):
    data = json.loads(file.read_text(encoding="utf-8"))
    cached = data["power"]["properties"]["parameter"]
    params = sorted(cached)
    years = sorted({int(k[:4]) for series in cached.values() for k in series})
    start, end = years[0], years[-1]
    lat, lon = data["lat"], data["lon"]

    print(f"{data.get('id', file.stem)}: {lat}, {lon} · {', '.join(params)} · {start}–{end}")
    live = fetch_power(lat, lon, params, start, end)
    compared, mismatches, missing, worst = compare(cached, live)

    share = mismatches / compared if compared else 1.0
    ok = compared > 0 and share <= MAX_MISMATCH_SHARE
    print(f"     {'OK  ' if ok else 'FAIL'} {compared} values compared, "
          f"{mismatches} differ, {missing} not in NASA response")
    if worst[1]:
        print(f"     largest difference: {worst[1]}")
    return ok


def main():
    files = sorted(DEMO_DIR.glob("*.json"))
    if not files:
        print(f"No demo files in {DEMO_DIR}")
        return 1

    results = []
    for file in files:
        try:
            results.append(check_site(file))
        except urllib.error.URLError as err:
            print(f"     could not reach NASA POWER: {err}")
            if "CERTIFICATE" in str(err).upper():
                print("     on macOS run: /Applications/Python*/Install\\ Certificates.command")
            results.append(False)
        except (KeyError, ValueError) as err:
            print(f"     unexpected file format: {err}")
            results.append(False)

    print()
    if all(results):
        print(f"All {len(files)} demo sites match NASA POWER.")
        return 0
    print(f"{results.count(False)} of {len(files)} sites did not match.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
