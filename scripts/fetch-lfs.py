"""Fetch the latest Canadian unemployment rate from Statistics Canada.

Downloads Table 14-10-0287-01 (Labour force characteristics by province
and territory, seasonally adjusted), extracts the most recent Canada-total
unemployment rate, and writes data/lfs-unemployment.json.

Run: python scripts/fetch-lfs.py
No external dependencies — stdlib only.
"""
import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

TABLE_URL = (
    "https://www150.statcan.gc.ca/n1/tbl/csv/14100028701-eng.zip"
)
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "lfs-unemployment.json"


def fetch_latest() -> dict:
    print(f"Downloading {TABLE_URL} …")
    with urllib.request.urlopen(TABLE_URL, timeout=60) as resp:
        raw = resp.read()
    print(f"Downloaded {len(raw):,} bytes")

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv") and "Meta" not in n]
        if not csv_names:
            raise ValueError("No data CSV found in ZIP")
        csv_name = csv_names[0]
        print(f"Parsing {csv_name} …")
        with zf.open(csv_name) as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            best = None
            for row in reader:
                if (
                    row.get("GEO", "").strip() == "Canada"
                    and row.get("Sex", "").strip() == "Both sexes"
                    and "Unemployment rate" in row.get("Labour force characteristics", "")
                    and "15 years and over" in row.get("Age group", "")
                    and row.get("VALUE", "").strip() not in ("", "..")
                ):
                    if best is None or row["REF_DATE"] > best["REF_DATE"]:
                        best = row

    if best is None:
        raise ValueError("Could not find an unemployment rate row matching criteria")

    rate = float(best["VALUE"])
    ref_period = best["REF_DATE"]
    print(f"Latest: {rate}% for {ref_period}")

    return {
        "rate": rate,
        "reference_period": ref_period,
        "source": "Statistics Canada, Table 14-10-0287-01",
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "unit": "%",
        "note": "Canada, both sexes, 15 years and over, seasonally adjusted",
    }


def main() -> int:
    try:
        data = fetch_latest()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Written: {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
