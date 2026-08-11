"""Fetch Canadian hiring-trend figures from Statistics Canada and write data/hiring-trends.json.

Called by .github/workflows/update-lfs-data.yml (1st Friday of each month).
Run from the career-coach repo root.

Uses the StatCan Web Data Service (WDS) REST API, endpoint
getDataFromCubePidCoordAndLatestNPeriods, which returns the latest N data
points for a (table, coordinate) pair as light JSON. No bulk CSV download.

Series (all real, verifiable coordinates confirmed via getCubeMetadata):
  Table 14-10-0287-01 (Labour Force Survey, monthly, seasonally adjusted)
    1.7.1.1.1.1  Canada, unemployment rate
    7.7.1.1.1.1  Ontario, unemployment rate
    1.3.1.1.1.1  Canada, employment level (x 1,000)
  Table 14-10-0432-01 (Job vacancies, monthly, seasonally adjusted)
    1.1          Canada, job vacancies
    1.3          Canada, job vacancy rate

Exit codes:
  0 -- updated (or already current)
  1 -- fetch or parse error
"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WDS_URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods"
OUTPUT_PATH = Path("data/hiring-trends.json")

LFS_TABLE_URL = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701"
JVS_TABLE_URL = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410043201"

# id, productId, coordinate (10 positions, unused padded with 0), label, unit, source
SERIES = [
    {
        "id": "canada_unemployment_rate",
        "productId": 14100287,
        "coordinate": "1.7.1.1.1.1.0.0.0.0",
        "label": "Unemployment rate, Canada",
        "unit": "%",
        "source": "Statistics Canada, Table 14-10-0287-01 (Labour Force Survey, seasonally adjusted)",
        "source_url": LFS_TABLE_URL,
    },
    {
        "id": "ontario_unemployment_rate",
        "productId": 14100287,
        "coordinate": "7.7.1.1.1.1.0.0.0.0",
        "label": "Unemployment rate, Ontario",
        "unit": "%",
        "source": "Statistics Canada, Table 14-10-0287-01 (Labour Force Survey, seasonally adjusted)",
        "source_url": LFS_TABLE_URL,
    },
    {
        "id": "canada_employment_thousands",
        "productId": 14100287,
        "coordinate": "1.3.1.1.1.1.0.0.0.0",
        "label": "People employed, Canada",
        "unit": "thousands",
        "source": "Statistics Canada, Table 14-10-0287-01 (Labour Force Survey, seasonally adjusted)",
        "source_url": LFS_TABLE_URL,
    },
    {
        "id": "canada_job_vacancies",
        "productId": 14100432,
        "coordinate": "1.1.0.0.0.0.0.0.0.0",
        "label": "Job vacancies, Canada",
        "unit": "count",
        "source": "Statistics Canada, Table 14-10-0432-01 (job vacancies, seasonally adjusted)",
        "source_url": JVS_TABLE_URL,
    },
    {
        "id": "canada_job_vacancy_rate",
        "productId": 14100432,
        "coordinate": "1.3.0.0.0.0.0.0.0.0",
        "label": "Job vacancy rate, Canada",
        "unit": "%",
        "source": "Statistics Canada, Table 14-10-0432-01 (job vacancies, seasonally adjusted)",
        "source_url": JVS_TABLE_URL,
    },
]


def main():
    body = json.dumps([
        {"productId": s["productId"], "coordinate": s["coordinate"], "latestN": 2}
        for s in SERIES
    ]).encode("utf-8")
    req = urllib.request.Request(
        WDS_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "two-birds-career-coach/1.0",
        },
    )
    print("Fetching StatCan WDS hiring-trend series...")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            results = json.load(resp)
    except Exception as e:
        print(f"ERROR: WDS fetch failed: {e}")
        return 1

    # WDS may return items in any order. Match by (productId, coordinate).
    by_key = {}
    for item in results:
        if item.get("status") != "SUCCESS":
            print(f"ERROR: WDS item failed: {item}")
            return 1
        obj = item["object"]
        by_key[(obj["productId"], obj["coordinate"])] = obj

    stats = []
    for s in SERIES:
        obj = by_key.get((s["productId"], s["coordinate"]))
        if obj is None:
            print(f"ERROR: series {s['id']} missing from WDS response")
            return 1
        points = obj.get("vectorDataPoint") or []
        if not points:
            print(f"ERROR: series {s['id']} returned no data points")
            return 1
        points = sorted(points, key=lambda p: p["refPer"])
        latest = points[-1]
        prev = points[-2] if len(points) > 1 else None
        try:
            value = float(latest["value"])
            prev_value = float(prev["value"]) if prev is not None else None
        except (TypeError, ValueError) as e:
            print(f"ERROR: non-numeric value for {s['id']}: {e}")
            return 1
        stats.append({
            "id": s["id"],
            "label": s["label"],
            "unit": s["unit"],
            "value": value,
            "reference_period": latest["refPer"][:7],
            "previous_value": prev_value,
            "previous_period": prev["refPer"][:7] if prev is not None else None,
            "source": s["source"],
            "source_url": s["source_url"],
        })

    # "updated" means the day the FIGURES last changed; "checked" means the day
    # this script last successfully reached StatCan. They are different facts and
    # the page shows them separately, so a broken refresh cannot hide behind a
    # timestamp that only looks current.
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    previous = {}
    if OUTPUT_PATH.exists():
        try:
            previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        except Exception:
            previous = {}
    unchanged = previous.get("stats") == stats
    payload = {
        "updated": previous.get("updated", today) if unchanged else today,
        "checked": today,
        "note": "All figures fetched from the Statistics Canada Web Data Service. Never hand-edit values.",
        "stats": stats,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    for st in stats:
        print(f"  {st['label']}: {st['value']} {st['unit']} ({st['reference_period']})")
    print(f"Written {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
