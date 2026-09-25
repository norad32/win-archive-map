#!/usr/bin/env python3
"""Update district and neighbourhood metadata using coordinate locations.

Coordinates are looked up from both src/data/addresses.geojson and
src/data/locations.geojson. Results update archive.json and locations.geojson,
then streets.json is rebuilt. Range entries resolve every referenced point and
are split into locationParts when they span different district/neighbourhoods.

- If an entry spans district/neighbourhood boundaries, it stays as one
archive record and gets `locationParts`, one per district/neighbourhood pair.
  The app displays that same record at each part's locations with that part's
  district, neighbourhood and housenumbers.
- Entries without a loc are left untouched.
- Points that fall outside every polygon get `district` "Other" and
`neighbourhood` null.

streets.json maps every street to the districts and neighbourhoods it
appears in (a street can belong to several of both):

{
  "districts":      { "<district>": ["Street", ...], ... },
  "neighbourhoods": { "<neighbourhood>": ["Street", ...], ... }
}

"Other" is a valid district (photos outside Winterthur). Legacy compound
values ("Altstadt/Veltheim") are excluded from streets.json.

Usage:
    venv/bin/python scripts/update-districts.py [--dry-run] [--output PATH]
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from housenumbers import housenumber_sort_key
from jsonio import load_json, save_json

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

ADDRESSES_PATH = DATA_DIR / "addresses.geojson"
LOCATIONS_PATH = DATA_DIR / "locations.geojson"
ARCHIVE_PATH = DATA_DIR / "archive.json"
STREETS_PATH = DATA_DIR / "streets.json"
DISTRICTS_PATH = DATA_DIR / "districts.geojson"
NEIGHBOURHOODS_PATH = DATA_DIR / "neighbourhoods.geojson"

OTHER_DISTRICT = "Other"
LEGACY_DISTRICT_PREFIX = "Altstadt/"


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
    locations = load_json(LOCATIONS_PATH)
    entries = load_json(ARCHIVE_PATH)
    districts = load_json(DISTRICTS_PATH)["features"]
    neighbourhoods = load_json(NEIGHBOURHOODS_PATH)["features"]

    address_by_id = {}
    for feature in addresses.get("features", []):
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates")
        if props.get("id"):
            address_by_id[props["id"]] = {
                "coordinates": coords,
                "housenumber": props.get("housenumber"),
            }

    district_tree, district_names = build_index(districts, "district")
    neighbourhood_tree, neighbourhood_names = build_index(
        neighbourhoods, "neighbourhood"
    )

    locations_changed = 0
    for feature in locations.get("features", []):
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates")
        if not props.get("id") or not coords:
            continue
        lon, lat = coords[:2]
        district = point_in_polygon(
            district_tree, district_tree.geometries, district_names, lon, lat
        )
        neighbourhood = point_in_polygon(
            neighbourhood_tree,
            neighbourhood_tree.geometries,
            neighbourhood_names,
            lon,
            lat,
        )
        district = district or OTHER_DISTRICT
        if props.get("district") != district:
            props["district"] = district
            locations_changed += 1
        if props.get("neighbourhood") != neighbourhood:
            props["neighbourhood"] = neighbourhood
            locations_changed += 1
        address_by_id[props["id"]] = {
            "coordinates": coords,
            "housenumber": props.get("housenumber"),
        }

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
            address = address_by_id.get(loc_id)
            coords = address.get("coordinates") if address else None
            if not coords:
                continue
            lon, lat = coords[:2]
            address_results.append(
                (
                    loc_id,
                    address.get("housenumber"),
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

        partitions = defaultdict(list)
        for loc_id, housenumber, district_value, neighbourhood_value in address_results:
            if district_value is None:
                unmatched += 1
                district_value = OTHER_DISTRICT
            partitions[(district_value, neighbourhood_value)].append(
                (loc_id, housenumber)
            )

        if len(partitions) > 1:
            mixed += 1
            entry["locationParts"] = [
                {
                    "district": district,
                    "neighbourhood": neighbourhood,
                    "housenumbers": sorted(
                        {hn for _, hn in part_addresses if hn},
                        key=housenumber_sort_key,
                    ),
                    "loc": [loc_id for loc_id, _ in part_addresses],
                }
                for (district, neighbourhood), part_addresses in sorted(
                    partitions.items(), key=lambda item: (item[0][0], item[0][1] or "")
                )
            ]
            entry["district"] = None
            entry["neighbourhood"] = None
            print(
                f"  SPLIT LOCATIONS: id={entry.get('id')} signature={entry.get('signature')} "
                f"street={entry.get('street')} housenumber={entry.get('housenumber')} "
                f"into {len(partitions)} district/neighbourhood parts"
            )
            for (district, neighbourhood), part_addresses in sorted(
                partitions.items(), key=lambda item: (item[0][0], item[0][1] or "")
            ):
                print(
                    f"    district={district} neighbourhood={neighbourhood or 'null'} "
                    f"addresses={len(part_addresses)}"
                )
            continue

        entry.pop("locationParts", None)
        district, neighbourhood = next(iter(partitions))
        old_district = entry.get("district")
        old_neighbourhood = entry.get("neighbourhood")
        if old_district != district:
            district_changes[f"{old_district} → {district}"] += 1
        if old_neighbourhood != neighbourhood:
            neighbourhood_changes[f"{old_neighbourhood} → {neighbourhood}"] += 1
        entry["district"] = district
        entry["neighbourhood"] = neighbourhood
    print(f"Checked {total} entries ({unlocated} without loc, skipped).")
    print(f'Outside all polygons (set to district "{OTHER_DISTRICT}"): {unmatched}')
    print(f"Entries split into district/neighbourhood location parts: {mixed}")
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
        print(
            f"Dry run: archive.json and locations.geojson not modified "
            f"({locations_changed} location metadata fields would change)."
        )
        return 0

    output_path = args.output or ARCHIVE_PATH
    save_json(output_path, entries)
    save_json(LOCATIONS_PATH, locations)

    print(f"Written to {output_path}")
    print(f"Updated location metadata fields: {locations_changed}")
    build_streets_json(output_path)
    return 0


def build_streets_json(entries_path: Path) -> None:
    """Derive streets.json: streets per district and per neighbourhood.

    A street can belong to several districts and neighbourhoods; it is
    listed under every one it occurs in. Legacy compound districts
    ("Altstadt/Veltheim") are excluded; "Other" is a valid district.
    """
    entries = load_json(entries_path)
    locations = load_json(LOCATIONS_PATH).get("features", [])
    entries.extend(feature.get("properties", {}) for feature in locations)

    by_district: dict[str, set[str]] = defaultdict(set)
    by_neighbourhood: dict[str, set[str]] = defaultdict(set)

    for entry in entries:
        street = (entry.get("street") or "").strip()
        if not street:
            continue
        parts = entry.get("locationParts") or [entry]
        for part in parts:
            district = (part.get("district") or "").strip()
            if district and not district.startswith(LEGACY_DISTRICT_PREFIX):
                by_district[district].add(street)
            neighbourhood = (part.get("neighbourhood") or "").strip()
            if neighbourhood:
                by_neighbourhood[neighbourhood].add(street)

    streets = {
        "districts": {
            district: sorted(streets, key=str.casefold)
            for district, streets in sorted(by_district.items())
        },
        "neighbourhoods": {
            neighbourhood: sorted(streets, key=str.casefold)
            for neighbourhood, streets in sorted(by_neighbourhood.items())
        },
    }
    save_json(STREETS_PATH, streets)

    street_count = len(
        {s for streets in by_district.values() for s in streets}
        | {s for streets in by_neighbourhood.values() for s in streets}
    )
    print(
        f"Written to {STREETS_PATH.name}: {street_count} streets, "
        f"{len(by_district)} districts, {len(by_neighbourhood)} neighbourhoods"
    )


if __name__ == "__main__":
    sys.exit(main())
