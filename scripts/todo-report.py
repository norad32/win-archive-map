#!/usr/bin/env python3
"""Write the data maintenance report (todo-report.md at the repo root).

Sections:
1. Unlocated archive entries (archive.json records with loc = null),
   prioritised: entries whose title or street hints at similar, already
   located entries (shared nouns / same street) are suggested first, since
   a look at those neighbouring records usually reveals the right address.
2. Addresses still in status "todo" (no coordinates).
3. POIs still in status "todo".
4. Glossary entries lacking both tags and an address (Winterthur-Glossar
   articles that cannot yet be matched to archive photos).

The report is only written; no data files are modified.

Usage:
    venv/bin/python scripts/todo-report.py [--output todo-report.md]
        [--hint-limit 400] [--min-hint-occurrences 3]
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jsonio import load_json

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src" / "data"
ADDRESSES_PATH = DATA_DIR / "addresses.geojson"
LOCATIONS_PATH = DATA_DIR / "locations.geojson"
ARCHIVE_PATH = DATA_DIR / "archive.json"
GLOSSARY_PATH = DATA_DIR / "glossary.json"
DEFAULT_OUTPUT = ROOT / "todo-report.md"

STOPWORDS = set(
    """und oder der die das dem den des ein eine einer einen eines zum zur im in am an auf aus bei mit von vom nach vor
    als wie für unter über about above""".split()
)

MIN_WORD_LEN = 3


def title_words(title: str) -> list[str]:
    return [
        w.lower()
        for w in re.findall(rf"[^\W\d_]{{{MIN_WORD_LEN},}}", title or "")
        if w.lower() not in STOPWORDS
    ]


PORTRAIT_RE = re.compile(
    r"\b(Portr\u00e4t|Portrait|Bildnis|Selbstbildnis|Brustbild|K\u00f6pfe?)\b",
    re.IGNORECASE,
)
ALBUM_RE = re.compile(r"\bAlbum\b", re.IGNORECASE)


def signature_prefix(signature) -> str:
    """Group key: everything before the first digit ('ALBU_1-101-046' -> 'ALBU')."""
    match = re.match(r"^(\D+)", str(signature or "").strip())
    prefix = (match.group(1) if match else "").strip(" _-.")
    return prefix or "numeric"


def classify_unplaced(entries: list[dict]) -> str:
    """Heuristic verdict for a group of street-less entries."""
    titles = " | ".join((e.get("title") or "") for e in entries[:20])
    if ALBUM_RE.search(titles):
        return "album"
    if PORTRAIT_RE.search(titles):
        return "portrait"
    return "other"


def build_noun_index(archive: list[dict]) -> Counter:
    """Count how many located entries contain each title noun."""
    counts: Counter = Counter()
    for entry in archive:
        if not entry.get("loc"):
            continue
        for word in set(title_words(entry.get("title"))):
            counts[word] += 1
    return counts


def build_street_index(archive: list[dict]) -> Counter:
    counts: Counter = Counter()
    for entry in archive:
        if not entry.get("loc"):
            continue
        street = (entry.get("street") or "").strip()
        if street:
            counts[street.casefold()] += 1
    return counts


def hint_entry(
    entry: dict,
    noun_counts: Counter,
    street_counts: Counter,
    located_total: int,
) -> tuple[int, list[str]]:
    """Score an unlocated entry by how strongly similar located entries exist.

    A shared street is the strongest signal (all entries on that street are
    direct neighbours); shared title nouns come next.
    """
    hints: list[str] = []
    score = 0

    street = (entry.get("street") or "").strip().casefold()
    if street and street in street_counts:
        hints.append(
            f"street: {entry.get('street').strip()} ({street_counts[street]} located)"
        )
        score += street_counts[street] * 10

    # Skip ultra-common nouns ("winterthur", "album", "abbruch"): they carry
    # no signal. Anything in more than 2% of located entries is noise.
    noise_threshold = max(30, located_total // 50)
    words = sorted(
        {
            w
            for w in title_words(entry.get("title"))
            if noun_counts.get(w, 0) >= 1 and noun_counts[w] < noise_threshold
        },
        key=lambda w: -noun_counts[w],
    )[:3]
    for word in words:
        hints.append(f'"{word}" ({noun_counts[word]} located)')
        score += noun_counts[word]

    return score, hints


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--hint-limit",
        type=int,
        default=400,
        help="max unlocated entries listed with hints (default 400)",
    )
    parser.add_argument(
        "--min-hint-occurrences",
        type=int,
        default=1,
        help="min located entries sharing a noun for it to count as a hint (default 1)",
    )
    args = parser.parse_args()

    archive = load_json(ARCHIVE_PATH)
    addresses = load_json(ADDRESSES_PATH)
    locations = load_json(LOCATIONS_PATH)
    glossary = load_json(GLOSSARY_PATH)

    unlocated = [entry for entry in archive if not entry.get("loc")]
    located_streets = build_street_index(archive)
    located_nouns = build_noun_index(archive)
    located_total = sum(1 for entry in archive if entry.get("loc"))

    scored = []
    for entry in unlocated:
        score, hints = hint_entry(entry, located_nouns, located_streets, located_total)
        scored.append((score, hints, entry))
    scored.sort(key=lambda item: (-item[0], str(item[2].get("id"))))

    unplaced_no_street = [
        entry for entry in unlocated if not (entry.get("street") or "").strip()
    ]
    no_street_groups = {}
    for entry in unplaced_no_street:
        prefix = signature_prefix(entry.get("signature"))
        no_street_groups.setdefault(prefix, []).append(entry)

    todo_houses = [
        f["properties"]
        for f in addresses.get("features", [])
        if f["properties"].get("status") == "todo"
    ]
    todo_pois = [
        f["properties"]
        for f in locations.get("features", [])
        if f["properties"].get("status") == "todo"
    ]
    todo_glossary = [
        entry
        for entry in glossary
        if not (entry.get("address") or "").strip()
        and not (entry.get("tags") or "").strip()
    ]

    id_counts = Counter(entry.get("id") for entry in archive)
    pair_counts = Counter(
        (entry.get("id"), entry.get("signature")) for entry in archive
    )
    duplicate_ids = {i: n for i, n in id_counts.items() if n > 1}
    duplicate_pairs = {p: n for p, n in pair_counts.items() if n > 1}

    lines = ["# Todo report", ""]
    lines.append(f"- Unlocated archive entries: {len(unlocated)}")
    lines.append(f"- Addresses with status todo: {len(todo_houses)}")
    lines.append(f"- POIs with status todo: {len(todo_pois)}")
    lines.append(f"- Glossary entries without tags/address: {len(todo_glossary)}")
    lines.append(
        f"- Unplaced without street (blacklist candidates): {len(unplaced_no_street)} "
        f"in {len(no_street_groups)} signature groups"
    )
    lines.append(
        f"- Duplicate archive records: {len(duplicate_ids)} ids "
        f"({len(duplicate_pairs)} duplicate id+signature pairs, "
        f"{sum(n - 1 for n in duplicate_pairs.values())} removable records)"
    )

    lines.append("")
    lines.append(
        f"## Unlocated archive entries — start here ({min(len(scored), args.hint_limit)} of {len(unlocated)})"
    )
    lines.append(
        "Prioritised by similarity to already located entries (shared street or title nouns)."
    )
    listed = scored[: args.hint_limit]
    no_hint_count = sum(1 for score, _, _ in scored if score == 0)
    for score, hints, entry in listed:
        if not hints:
            continue
        title = (entry.get("title") or "(no title)").strip()
        lines.append(f"- `{entry['id']}` {title}")
        lines.append(
            f"  - {entry.get('street') or 'no street'} {entry.get('housenumber') or ''}".rstrip()
        )
        lines.append(f"  - similar located: {', '.join(hints)} (score {score})")
    if no_hint_count:
        lines.append("")
        lines.append(
            f"{no_hint_count} further entries have no similarity hints "
            "(albums, generic views) — manual research required."
        )

    if todo_houses:
        lines.append("")
        lines.append(f"## Addresses todo ({len(todo_houses)})")
        for props in todo_houses:
            lines.append(f"- `{props['id']}` {props['street']} {props['housenumber']}")

    if todo_pois:
        lines.append("")
        lines.append(f"## POIs todo ({len(todo_pois)})")
        for props in todo_pois:
            lines.append(f"- `{props['id']}` {props.get('name', '')}")

    if todo_glossary:
        lines.append("")
        lines.append(f"## Glossary without tags/address ({len(todo_glossary)})")
        for entry in todo_glossary[:300]:
            street = (entry.get("street") or "").strip()
            lines.append(
                f"- {entry.get('title')}" + (f" — street: {street}" if street else "")
            )
        if len(todo_glossary) > 300:
            lines.append(f"- ... and {len(todo_glossary) - 300} more")

    if unplaced_no_street:
        lines.append("")
        lines.append(
            f"## Unplaced entries without street ({len(unplaced_no_street)} in {len(no_street_groups)} groups)"
        )
        lines.append(
            "Blacklist candidates that cannot be geocoded (portraits, albums, "
            "non-Winterthur subjects). Review per group, then set the group key "
            'to "blacklist" in scripts/unlocated-blacklist-groups.json and run '
            "`update-archive.py --blacklist-groups`."
        )
        for prefix in sorted(no_street_groups):
            entries = no_street_groups[prefix]
            verdict = classify_unplaced(entries)
            lines.append("")
            lines.append(
                f"### `{prefix}` — {len(entries)} entries — verdict: {verdict}"
            )
            for entry in entries[:3]:
                lines.append(f"  - `{entry['id']}` {(entry.get('title') or '')[:90]}")
            if len(entries) > 3:
                lines.append(f"  - ... and {len(entries) - 3} more")

    if duplicate_ids:
        lines.append("")
        lines.append(
            f"## Duplicate archive records ({len(duplicate_ids)} ids, "
            f"{sum(n - 1 for n in duplicate_pairs.values())} removable)"
        )
        lines.append(
            "Ids appearing more than once in archive.json; for each duplicate "
            "id+signature pair one record can be dropped."
        )
        for (entry_id, signature), count in sorted(duplicate_pairs.items()):
            titles = {
                (entry.get("title") or "").strip()
                for entry in archive
                if entry.get("id") == entry_id and entry.get("signature") == signature
            }
            title = (sorted(titles)[0] or "(no title)")[:100]
            lines.append(f"- `{entry_id}` sig `{signature}` ×{count} — {title}")

    report = "\n".join(lines) + "\n"
    args.output.write_text(report, encoding="utf-8")
    print(f"Report written to {args.output}")
    print(
        f"  unlocated={len(unlocated)} todoHouses={len(todo_houses)} "
        f"todoPois={len(todo_pois)} glossaryTodo={len(todo_glossary)} "
        f"duplicates={len(duplicate_ids)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
