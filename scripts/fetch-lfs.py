"""Fetch latest StatCan LFS unemployment data and write data/lfs-unemployment.json.

Called by .github/workflows/update-lfs-data.yml (1st Friday of each month).
Run from the career-coach repo root.

Downloads Table 14-10-0287-01 bulk CSV and extracts:
  Canada, Total - Gender, 15 years and over, Unemployment rate, Seasonally adjusted.

Exit codes:
  0 -- updated (or already current)
  1 -- fetch or parse error
"""
from __future__ import annotations

import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

BULK_URL = "https://www150.statcan.gc.ca/n1/tbl/csv/14100287-eng.zip"
CSV_NAME = "14100287.csv"
OUTPUT_PATH = Path("data/lfs-unemployment.json")

_SOURCE = "Statistics Canada, Table 14-10-0287-01"
_NOTE = "Canada, both sexes, 15 years and over, seasonally adjusted"
_UPDATE_INSTRUCTIONS = (
    "Update monthly. StatCan LFS releases on the 3rd Friday of the following month. "
    "Source: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028703"
)

_FILTERS = {
    "GEO": "canada",
    "Gender": "total - gender",
    "Age group": "15 years and over",
    "Labour force characteristics": "unemployment rate",
    "Data type": "seasonally adjusted",
    "Statistics": "estimate",
}


def _row_matches(row):
    for col, val in _FILTERS.items():
        cell = (row.get(col) or "").strip().lower()
        if col == "Statistics":
            if cell != val:  # exact match -- "Standard error of estimate" contains "estimate"
                return False
        else:
            if val not in cell:
                return False
    return True


def main():
    req = urllib.request.Request(BULK_URL, headers={"User-Agent": "two-birds-career-coach/1.0"})
    print("Downloading StatCan Table 14-10-0287-01...")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw_bytes = resp.read()
    except Exception as e:
        print(f"ERROR: download failed: {e}")
        return 1

    print(f"Downloaded {len(raw_bytes) // 1024 // 1024} MB. Parsing...")
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw_bytes))
        with zf.open(CSV_NAME) as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            best_row = None
            for row in reader:
                if _row_matches(row):
                    best_row = row
    except Exception as e:
        print(f"ERROR: CSV parse error: {e}")
        return 1

    if best_row is None:
        print("ERROR: target series not found in CSV")
        return 1

    ref_per = (best_row.get("REF_DATE") or "").strip()
    value_str = (best_row.get("VALUE") or "").strip()
    if not ref_per or not value_str:
        print(f"ERROR: empty REF_DATE or VALUE")
        return 1

    try:
        rate = round(float(value_str), 1)
    except ValueError as e:
        print(f"ERROR: non-numeric VALUE {value_str!r}: {e}")
        return 1

    existing = {}
    if OUTPUT_PATH.exists():
        try:
            existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payload = {
        "rate": rate,
        "reference_period": ref_per,
        "source": _SOURCE,
        "updated": today,
        "unit": "%",
        "note": _NOTE,
        "update_instructions": existing.get("update_instructions", _UPDATE_INSTRUCTIONS),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Updated: {ref_per} rate={rate}%  (written {OUTPUT_PATH})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
