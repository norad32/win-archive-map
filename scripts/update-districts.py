#!/usr/bin/env python3
"""Update `district` and `neighbourhood` properties in src/data/archive.json
by point-in-polygon matching against src/data/districts.geojson and
src/data/neighbourhoods.geojson.

Coordinates are looked up from src/data/addresses.geojson via each entry's
`loc` reference. Range entries (multiple addresses) resolve every referenced
address.

- If the addresses disagree on district or neighbourhood, the entry is
left untouched and reported as mixed.
- Entries without a loc are left untouched.
- Points that fall outside every polygon get `district` "Other" and
`neighbourhood` null.

Usage:
    venv/bin/python scripts/update-districts.py [--dry-run] [--output PATH]
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from jsonio import load_json, save_json

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

ADDRESSES_PATH = DATA_DIR / "addresses.geojson"
ARCHIVE_PATH = DATA_DIR / "archive.json"
DISTRICTS_PATH = DATA_DIR / "districts.geojson"
NEIGHBOURHOODS_PATH = DATA_DIR / "neighbourhoods.geojson"

OTHER_DISTRICT = "Other"


def build_index(features: list[dict], name_property: str) -> tuple[STRtree, list[str]]:
    """Build a spatial index over the feature polygons."""
    polygons = [shape(feature["geometry"]) for feature in features]
    names = [feature["properties"][name_property] for feature in features]
    return STRtree(polygons), names


def point_in_polygon(
    tree: STRtree, polygons: list, names: list[str], lon: float, lat: float
) -> str | None:
    """Return the name of the polygon containing the point, or None."""
    point = Point(lon, lat)
    for idx in tree.query(point):
        if polygons[int(idx)].contains(point):
            return names[int(idx)]
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report changes without writing the file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="write to a different path instead of updating archive.json in place",
    )
    args = parser.parse_args()

    addresses = load_json(ADDRESSES_PATH)
    entries = load_json(ARCHIVE_PATH)
    districts = load_json(DISTRICTS_PATH)["features"]
    neighbourhoods = load_json(NEIGHBOURHOODS_PATH)["features"]

    coordinates_by_id = {}
    for feature in addresses.get("features", []):
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates")
        if props.get("id") and coords:
            coordinates_by_id[props["id"]] = coords

    district_tree, district_names = build_index(districts, "district")
    neighbourhood_tree, neighbourhood_names = build_index(
        neighbourhoods, "neighbourhood"
    )

    district_changes: Counter[str] = Counter()
    neighbourhood_changes: Counter[str] = Counter()
    unmatched = 0
    unlocated = 0
    mixed = 0
    partial = 0
    total = len(entries)

    for entry in entries:
        loc = entry.get("loc")
        if not loc:
            unlocated += 1
            continue

        loc_ids = loc if isinstance(loc, list) else [loc]
        address_results = []
        for loc_id in loc_ids:
            coords = coordinates_by_id.get(loc_id)
            if not coords:
                continue
            lon, lat = coords[:2]
            address_results.append(
                (
                    loc_id,
                    point_in_polygon(
                        district_tree,
                        district_tree.geometries,
                        district_names,
                        lon,
                        lat,
                    ),
                    point_in_polygon(
                        neighbourhood_tree,
                        neighbourhood_tree.geometries,
                        neighbourhood_names,
                        lon,
                        lat,
                    ),
                )
            )
        if not address_results:
            unlocated += 1
            continue
        if len(address_results) < len(loc_ids):
            partial += 1

        resolved_districts = [d for _, d, _ in address_results]
        resolved_neighbourhoods = [n for _, _, n in address_results]

        districts_agree = (
            len({(d if d is not None else OTHER_DISTRICT) for d in resolved_districts})
            == 1
        )
        neighbourhoods_agree = len(set(resolved_neighbourhoods)) == 1

        if not districts_agree or not neighbourhoods_agree:
            mixed += 1
            print(
                f"  MIXED LOCATIONS: id={entry.get('id')} signature={entry.get('signature')} "
                f"street={entry.get('street')} housenumber={entry.get('housenumber')} "
                f"({len(address_results)}/{len(loc_ids)} addresses resolvable) — entry not updated:",
            )
            for loc_id, d, n in address_results:
                print(
                    f"    {loc_id}: district={d if d is not None else OTHER_DISTRICT} "
                    f"neighbourhood={n if n is not None else 'null'}",
                )
            continue

        district = resolved_districts[0] or OTHER_DISTRICT
        neighbourhood = resolved_neighbourhoods[0]

        if district is OTHER_DISTRICT and resolved_districts[0] is None:
            unmatched += 1

        if entry.get("district") != district:
            district_changes[f"{entry.get('district')} → {district}"] += 1
            entry["district"] = district
        if entry.get("neighbourhood") != neighbourhood:
            neighbourhood_changes[
                f"{entry.get('neighbourhood')} → {neighbourhood}"
            ] += 1
            entry["neighbourhood"] = neighbourhood

    print(f"Checked {total} entries ({unlocated} without loc, skipped).")
    print(f'Outside all polygons (set to district "{OTHER_DISTRICT}"): {unmatched}')
    print(f"Ranges spanning multiple districts/neighbourhoods (not updated): {mixed}")
    print(
        f"Ranges with only partially resolvable addresses (updated from resolvable ones): {partial}"
    )

    if district_changes:
        print("District changes:")
        for change, count in sorted(district_changes.items()):
            print(f"  {change}: {count}")
    else:
        print("No district changes.")

    if neighbourhood_changes:
        print("Neighbourhood changes:")
        for change, count in sorted(neighbourhood_changes.items()):
            print(f"  {change}: {count}")
    else:
        print("No neighbourhood changes.")

    if args.dry_run:
        print("Dry run: archive.json not modified.")
        return 0

    if not district_changes and not neighbourhood_changes:
        print("Nothing to update.")
        return 0

    output_path = args.output or ARCHIVE_PATH
    save_json(output_path, entries)

    print(f"Written to {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
