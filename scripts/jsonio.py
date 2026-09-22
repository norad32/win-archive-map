"""Shared JSON I/O for data scripts.

Every write goes through save_json, which:
1. sorts the document (records by natural id, lists by title/name,
   GeoJSON features by properties.id or street+housenumber, object keys
   alphabetically) — so every script output is canonically ordered
2. pipes it through the Prettier binary from node_modules for the exact
   `npm run format` style (2-space indent, short arrays collapsed)

Writes are atomic: the document is staged as <name>.tmp next to the target
and moved into place with os.replace, so an interrupted run can never leave
a truncated data file behind.

Falls back to plain json.dumps(indent=2) when Prettier is unavailable.
Sorting never throws: a value that cannot be sorted is written as-is.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from housenumbers import housenumber_sort_key

ROOT = Path(__file__).resolve().parent.parent
PRETTIER_BIN = ROOT / "node_modules" / ".bin" / "prettier"

NATURAL_SPLIT_RE = re.compile(r"(\d+)")


def load_json(path: Path):
    with Path(path).open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    path = Path(path)
    text = json.dumps(sort_value(data), ensure_ascii=False, indent=2) + "\n"

    if PRETTIER_BIN.exists() and shutil.which("node"):
        try:
            result = subprocess.run(
                [
                    str(PRETTIER_BIN),
                    "--stdin-filepath",
                    str(path),
                ],
                input=text,
                text=True,
                capture_output=True,
                check=True,
            )
            text = result.stdout
        except (subprocess.CalledProcessError, OSError):
            pass

    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------


def natural_key(value) -> tuple:
    """Sort key reading digits as numbers ('10' sorts after '9')."""
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
    return features


def sort_value(value):
    """Recursively sort lists and dict keys; unknown shapes pass through."""
    try:
        if isinstance(value, list):
            return sort_list(value)
        if isinstance(value, dict):
            if set(value) == {"type", "features"}:
                return {
                    "type": value["type"],
                    "features": sort_features(value["features"]),
                }
            return {key: sort_value(val) for key, val in sorted(value.items())}
    except TypeError:
        pass
    return value


def sort_file(path: Path) -> None:
    """Sort a file in place (used by sort-json.py for manual invocation)."""
    path = Path(path)
    data = load_json(path)
    save_json(path, sort_value(data))
