"""Geocode addresses in src/data/addresses.geojson via the geo.admin.ch location
search.

By default every house with status "todo" is looked up. Confirmed results are
written to the feature geometry and get status "auto". Use --redo-auto to also 
re-geocode addresses with status "auto". addresses with status "manual" (placed 
by hand) are never touched.

Status scheme:
- "auto"    coordinates assigned automatically
- "manual"  coordinates placed manually
- "todo"    no coordinates yet

Results are saved after every batch, so the script can be interrupted and
re-run.

Usage:
    venv/bin/python scripts/geocode.py [--dry-run] [--limit N] [--redo-auto] [--delay SECONDS]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
ADDRESSES_PATH = DATA_DIR / "addresses.geojson"

SEARCH_URL = "https://api3.geo.admin.ch/rest/services/api/SearchServer"
CITY = "Winterthur"
BATCH_SIZE = 25
DEFAULT_DELAY = 0.2
STATUS_TODO = "todo"
STATUS_AUTO = "auto"
STATUS_MANUAL = "manual"

# Must match MAP_MAX_BOUNDS in src/js/config.js (Winterthur and surroundings).
# Geocoded results outside these bounds are pissibly wrong and stay "todo".
MAP_MAX_BOUNDS = {
    "lat_min": 47.368449,
    "lat_max": 47.589595,
    "lon_min": 8.53753,
    "lon_max": 8.886116,
}


def normalize(text: str) -> str:
    """Normalize a street name for comparison ('Römerstrasse' -> 'roemerstrasse')."""
    text = text.lower().strip()
    text = (
        text.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", text)


def geocode(street: str, housenumber: str) -> tuple[float, float] | None:
    """Return (lon, lat) if the query resolves to a matching address."""
    params = {
        "type": "locations",
        "origins": "address",
        "searchText": f"{street} {housenumber} {CITY}",
        "limit": 1,
    }
    res = requests.get(SEARCH_URL, params=params, timeout=30)
    if res.status_code == 429:
        raise RuntimeError("Rate limited (HTTP 429), retry later.")
    res.raise_for_status()

    results = res.json().get("results") or []
    if not results:
        return None

    attrs = results[0].get("attrs") or {}
    if attrs.get("origin") != "address":
        return None

    wanted_number = int(re.match(r"\d+", housenumber).group(0))
    if attrs.get("num") != wanted_number:
        return None

    detail = attrs.get("detail") or ""
    if normalize(street) not in normalize(detail):
        return None

    return attrs["lon"], attrs["lat"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="max lookups this run")
    parser.add_argument(
        "--redo-auto",
        action="store_true",
        help="also re-geocode addresses with status 'auto'",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"seconds between API calls (default {DEFAULT_DELAY})",
    )
    args = parser.parse_args()

    targets = {STATUS_TODO}
    targets.discard(STATUS_MANUAL)
    if args.redo_auto:
        targets.add(STATUS_AUTO)

    addresses = json.loads(ADDRESSES_PATH.read_text(encoding="utf-8"))
    features = addresses.get("features", [])

    todo = [
        feature
        for feature in features
        if feature["properties"].get("status") in targets
    ]
    if args.limit is not None:
        todo = todo[: args.limit]

    print(f"{len(todo)} addresses to geocode ({', '.join(sorted(targets))})")

    matched = 0
    unmatched = 0
    written = 0

    for index, feature in enumerate(todo, start=1):
        props = feature["properties"]
        try:
            result = geocode(props["street"], props["housenumber"])
        except (RuntimeError, requests.RequestException) as err:
            if written:
                write_features(features)
            print(f"Aborted after {index - 1} lookups: {err}", file=sys.stderr)
            return 1

        if result:
            lon, lat = result
            if not (
                MAP_MAX_BOUNDS["lat_min"] <= lat <= MAP_MAX_BOUNDS["lat_max"]
                and MAP_MAX_BOUNDS["lon_min"] <= lon <= MAP_MAX_BOUNDS["lon_max"]
            ):
                print(
                    f"  OUT OF BOUNDS: {props['street']} {props['housenumber']} "
                    f"-> {lat}, {lon} (marked todo)",
                )
                unmatched += 1
            else:
                matched += 1
                feature["geometry"] = {"type": "Point", "coordinates": [lon, lat]}
                props["status"] = STATUS_AUTO
        else:
            unmatched += 1

        if index % BATCH_SIZE == 0:
            print(f"  {index}/{len(todo)} matched={matched} unmatched={unmatched}")
            if not args.dry_run:
                write_features(features)
                written += 1

        time.sleep(args.delay)

    if args.dry_run:
        print(f"Dry run: matched={matched} unmatched={unmatched}, file not modified.")
        return 0

    write_features(features)
    print(f"Done. matched={matched} unmatched={unmatched}")
    print(f"Written to {ADDRESSES_PATH}")
    return 0


def write_features(features: list[dict]) -> None:
    """Persist current in-memory state; matched features updated in place."""
    addresses = {"type": "FeatureCollection", "features": features}
    ADDRESSES_PATH.write_text(
        json.dumps(addresses, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    sys.exit(main())
