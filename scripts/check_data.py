#!/usr/bin/env python3
"""Sanity check for Kisht's bundled NASA data files.

Run from the repo root:  python3 scripts/check_data.py
Exit code 0 = all good, 1 = problems found.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
FILL_VALUES = {-999, -9999, -99999}
METADATA_KEYS = {"fill_value", "fill_values", "_FillValue"}
MAX_SIZE_KB = 2048
MAX_REPORTED = 10


def walk_numbers(obj, path="$"):
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        yield path, obj
    elif isinstance(obj, dict):
        for key, value in obj.items():
            if key in METADATA_KEYS:
                continue
            yield from walk_numbers(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            yield from walk_numbers(value, f"{path}[{i}]")


def check_file(file):
    problems = []
    size_kb = file.stat().st_size / 1024
    if size_kb > MAX_SIZE_KB:
        problems.append(f"file is {size_kb:.0f} KB (limit {MAX_SIZE_KB} KB)")

    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as err:
        return [f"invalid JSON: {err}"], 0, size_kb

    count = 0
    for path, value in walk_numbers(data):
        count += 1
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            problems.append(f"{path} is {value} (breaks JSON.parse in the browser)")
        elif value in FILL_VALUES:
            problems.append(f"{path} = {value} (NASA fill value: missing data)")
    return problems, count, size_kb


def main():
    if not DATA_DIR.is_dir():
        print(f"Data folder not found: {DATA_DIR}")
        return 1

    files = sorted(DATA_DIR.rglob("*.json"))
    if not files:
        print(f"No JSON files in {DATA_DIR}")
        return 1

    total_problems = 0
    for file in files:
        problems, count, size_kb = check_file(file)
        name = file.relative_to(ROOT)
        status = "OK  " if not problems else "FAIL"
        print(f"{status} {name}  ({size_kb:.0f} KB, {count} numbers)")
        for problem in problems[:MAX_REPORTED]:
            print(f"     - {problem}")
        if len(problems) > MAX_REPORTED:
            print(f"     ... and {len(problems) - MAX_REPORTED} more")
        total_problems += len(problems)

    print()
    if total_problems:
        print(f"{total_problems} problem(s) in {len(files)} file(s).")
        return 1
    print(f"All {len(files)} data file(s) look clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
