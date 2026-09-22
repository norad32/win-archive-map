#!/usr/bin/env python3
"""Sort the JSON data files in src/data (and scripts/).

Manual invocation is normally unnecessary — every script write via
jsonio.save_json sorts automatically. Use this after editing a JSON file
by hand:

    venv/bin/python scripts/sort-json.py [PATH ...]

Without paths, sorts every *.json/*.geojson in src/data and scripts/.

Rules (see jsonio.py):
- plain lists of scalars          -> natural sort (digits read as numbers)
- lists of records                -> natural sort by "id" when present,
                                     else alphabetically by "title"/"name"
- GeoJSON feature collections     -> features by properties.id (natural);
                                     if features have street + housenumber
                                     instead, by (street, natural housenumber)
- objects                         -> keys sorted alphabetically, list values
                                     sorted with the rules above
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jsonio import sort_file

DATA_DIRS = [
    Path(__file__).resolve().parent.parent / "src" / "data",
    Path(__file__).resolve().parent,
]


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
        print(f"  sorted {path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
