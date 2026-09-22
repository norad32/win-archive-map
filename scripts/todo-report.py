#!/usr/bin/env python3
"""Report data that still needs manual attention:

- houses in addresses.geojson with status "todo" (no coordinates yet)
- POIs in locations.geojson with status "todo"
- archive entries without any loc (never placed)

Prints a summary to stdout. With --output, writes a Markdown report instead.

Usage:
    venv/bin/python scripts/todo-report.py [--output todo.md]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
ADDRESSES_PATH = DATA_DIR / "addresses.geojson"
LOCATIONS_PATH = DATA_DIR / "locations.geojson"
ARCHIVE_PATH = DATA_DIR / "archive.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    addresses = json.loads(ADDRESSES_PATH.read_text(encoding="utf-8"))
    locations = json.loads(LOCATIONS_PATH.read_text(encoding="utf-8"))
    entries = json.loads(ARCHIVE_PATH.read_text(encoding="utf-8"))

    house_status = Counter(f["properties"].get("status") for f in addresses["features"])
    attention_houses = [
        f["properties"]
        for f in addresses["features"]
        if f["properties"].get("status") == "todo"
    ]
    attention_pois = [
        f["properties"]
        for f in locations["features"]
        if f["properties"].get("status") == "todo"
    ]
    unlocated = [e for e in entries if not e.get("loc")]

    lines = []
    lines.append("# Data maintenance report\n")
    lines.append(
        f"- Houses total: {len(addresses['features'])} "
        f"({', '.join(f'{k or 'none'}: {v}' for k, v in sorted(house_status.items(), key=str))})"
    )
    lines.append(f"- Houses needing attention: {len(attention_houses)}")
    lines.append(f"- POIs needing attention: {len(attention_pois)}")
    lines.append(f"- Unlocated archive entries: {len(unlocated)}")

    if attention_houses:
        lines.append("\n## Houses needing attention\n")
        for props in attention_houses:
            lines.append(
                f"- `{props['id']}` status={props.get('status')} "
                f"({props['street']} {props['housenumber']})"
            )
    if attention_pois:
        lines.append("\n## POIs needing attention\n")
        for props in attention_pois:
            lines.append(
                f"- `{props['id']}` status={props.get('status')} ({props['name']})"
            )
    if unlocated:
        lines.append("\n## Unlocated archive entries\n")
        for entry in unlocated:
            lines.append(
                f"- id={entry['id']} signature={entry['signature']} "
                f"street={entry.get('street') or '(none)'} housenumber={entry.get('housenumber') or '(none)'}"
            )
            lines.append(f"  {entry.get('title') or ''}")

    report = "\n".join(lines) + "\n"

    if args.output:
        args.output.write_text(report, encoding="utf-8")
        print(f"Report written to {args.output}")
    else:
        print(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())
