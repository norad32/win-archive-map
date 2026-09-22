#!/usr/bin/env python3
"""Sort the JSON data files in src/data.

Rules:
- plain lists of scalars          -> natural sort (digits read as numbers)
- lists of records                -> natural sort by "id" when present,
                                     else alphabetically by "title"/"name"
- GeoJSON feature collections     -> features by properties.id (natural);
                                     if features have street + housenumber
                                     instead, by (street, natural housenumber)
- objects                         -> keys sorted alphabetically, list values
                                     sorted with the rules above

All files are written in the shared npm-format style via jsonio.save_json.
A file whose records carry none of the known keys is left untouched.

Usage:
    venv/bin/python scripts/sort-json.py [PATH ...]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from housenumbers import housenumber_sort_key
from jsonio import load_json, save_json

DATA_DIRS = [
    Path(__file__).resolve().parent.parent / "src" / "data",
    Path(__file__).resolve().parent.parent / "scripts",
]

NATURAL_SPLIT_RE = re.compile(r"(\d+)")


def natural_key(value) -> tuple:
    parts = []
    for part in NATURAL_SPLIT_RE.split(str(value)):
        if part.isdigit():
            parts.append((0, int(part), ""))
        elif part:
            parts.append((1, 0, part))
    return tuple(parts)


def record_sort_key(record: dict):
    if "id" in record:
        return (0, natural_key(record["id"]))
    for field in ("title", "name", "street", "signature"):
        if field in record:
            return (1, natural_key(record.get(field) or ""))
    return (2, natural_key(str(record)))


def feature_sort_key(feature: dict):
    props = feature.get("properties", {})
    if "id" in props:
        return natural_key(props["id"])
    if "street" in props and "housenumber" in props:
        return (
            props["street"].casefold(),
            housenumber_sort_key(props["housenumber"]),
        )
    for field in ("name", "title", "district"):
        if field in props:
            return natural_key(props.get(field) or "")
    return natural_key(str(props))


def sort_list(items: list):
    if not items or not all(isinstance(item, dict) for item in items):
        if all(isinstance(item, (str, int, float)) for item in items):
            return sorted(items, key=natural_key)
        return items
    if all("id" in item for item in items):
        return sorted(items, key=record_sort_key)
    if all(isinstance(item.get("title"), str) for item in items):
        return sorted(items, key=lambda item: item["title"].casefold())
    if all(isinstance(item.get("name"), str) for item in items):
        return sorted(items, key=lambda item: item["name"].casefold())
    return sorted(items, key=record_sort_key)


def sort_features(features: list):
    if not features:
        return features
    sample = [f.get("properties", {}) for f in features[:5]]
    if all("id" in p for p in sample) or all(
        "street" in p and "housenumber" in p for p in sample
    ):
        return sorted(features, key=feature_sort_key)
    print("  SKIPPED (no sortable properties)")
    return features


def sort_value(value):
    if isinstance(value, list):
        return sort_list(value)
    if isinstance(value, dict):
        if set(value) == {"type", "features"}:
            return {"type": value["type"], "features": sort_features(value["features"])}
        return {key: sort_value(val) for key, val in sorted(value.items())}
    return value


def sort_file(path: Path) -> None:
    data = load_json(path)
    sorted_data = sort_value(data)
    if sorted_data != data:
        save_json(path, sorted_data)
        print(f"  sorted {path.name}")
    else:
        print(f"  {path.name} already sorted")


def main() -> int:
    paths = [Path(arg) for arg in sys.argv[1:]]
    if not paths:
        paths = sorted(
            set(DATA_DIRS[0].glob("*.json"))
            | set(DATA_DIRS[0].glob("*.geojson"))
            | set(DATA_DIRS[1].glob("*.json"))
        )
    paths = [p for p in paths if p.suffix in (".json", ".geojson")]
    print(f"Sorting {len(paths)} files")
    for path in paths:
        sort_file(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
