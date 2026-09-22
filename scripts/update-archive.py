#!/usr/bin/env python3
"""Scrape the Winterthur Bilddatenbank and maintain the archive data model.

The archive ids run from 0 to --max-id (default 100000). Scraping the whole
archive takes days, so the script works in batches and is fully resumable:
every run processes the next --batch-size (default 100) pending ids, i.e.
ids that are neither in archive-master.json nor blacklisted.

Data files (src/data/):
- archive-master.json      one record per scraped id
- archive-blacklist.json   ids that do not exist or are excluded by hand;
                           script only ever appends, manual ids are kept

Modes:
- default                  scrape the next batch (no merge into live data)
- --apply                  scrape batch, then merge into archive.json +
                           addresses.geojson, geocode new houses, re-derive
                           districts
- --apply-only             no scraping: apply the next --batch-size (100)
                           unapplied master records to the live data (same
                           pipeline); use --ids or --all for other selections
- --list-pending           show pending count + next ids, no fetching
- --diff-report [PATH]     write a Markdown diff report master vs archive.json

Detail pages that yield no data after the full retry chain (including
session re-init) are considered non-existent and blacklisted.

Usage:
    venv/bin/python scripts/update-archive.py [--batch-size 100] [--apply]
        [--apply-only] [--list-pending] [--dry-run] [--ids 12,34-56]
        [--page-delay 0.2] [--no-headless] [--max-id 100000]
        [--skip-geocode] [--skip-districts] [--diff-report [PATH]]
"""

from __future__ import annotations

import argparse
import difflib
import re
import subprocess
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))

from housenumbers import address_id, unroll_housenumber
from jsonio import load_json, save_json

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
MASTER_PATH = DATA_DIR / "archive-master.json"
BLACKLIST_PATH = "archive-blacklist.json"
ARCHIVE_PATH = DATA_DIR / "archive.json"
ADDRESSES_PATH = DATA_DIR / "addresses.geojson"
SCRIPTS_DIR = Path(__file__).resolve().parent

BASE_URL = "https://bilddatenbank.winterthur.ch/ims_publisher"
START_URL = f"{BASE_URL}/start"
DETAIL_URL = f"{BASE_URL}/detailspopup"
DEFAULT_MAX_ID = 100_000
DEFAULT_BATCH_SIZE = 100
DEFAULT_PAGE_DELAY = 0.2
SAVE_EVERY = 25
FETCH_ATTEMPTS = 3

STATUS_TODO = "todo"
STATUS_MANUAL = "manual"

FIELDS = {
    "signature": "Signatur",
    "title": "Titel",
    "year": "Jahr",
    "district": "Stadtkreis",
    "street": "Strasse",
    "housenumber": "Hausnummer",
}


def parse_detail_page(html: str) -> dict[str, str] | None:
    """Extract the German-keyed field table from a detail page.

    Returns None when the page carries no data table.
    """
    soup = BeautifulSoup(html, "html.parser")

    if "session timeout" in html.lower():
        return None
    if soup.find("form", id="prepare_tab_form"):
        return None

    fields = {}
    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) >= 2:
            key = cells[0].get_text(strip=True)
            value = cells[1].get_text(strip=True)
            if key and value:
                fields[key] = value
    return fields or None


def fetch_fields(page, archive_id: int) -> dict[str, str] | None:
    """Fetch one detail page; returns fields or None if no data."""
    url = f"{DETAIL_URL}?id={archive_id}"
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            page.goto(url, wait_until="networkidle", timeout=30_000)
            html = page.content()
        except Exception:
            print(f"  FETCH ERROR: id={archive_id} attempt {attempt}/{FETCH_ATTEMPTS}")
            time.sleep(2)
            continue

        if "session timeout" in html.lower() or soup_has_prepare_form(html):
            page.goto(START_URL, wait_until="networkidle", timeout=30_000)
            continue

        fields = parse_detail_page(html)
        if fields is not None:
            return fields
        return None

    return None


def soup_has_prepare_form(html: str) -> bool:
    return (
        BeautifulSoup(html, "html.parser").find("form", id="prepare_tab_form")
        is not None
    )


def build_record(archive_id: int, fields: dict[str, str]) -> dict:
    def get(key: str) -> str:
        raw = fields.get(FIELDS[key], "").strip()
        return raw or None

    return {
        "id": str(archive_id),
        "signature": get("signature"),
        "title": get("title"),
        "year": get("year"),
        "district": get("district"),
        "neighbourhood": None,
        "street": get("street"),
        "housenumber": get("housenumber"),
        "loc": None,
    }


def load_blacklist() -> set[int]:
    if not BLACKLIST_PATH.exists():
        return set()
    return {int(x) for x in load_json(BLACKLIST_PATH)}


def save_blacklist(blacklist: set[int]) -> None:
    save_json(BLACKLIST_PATH, sorted(blacklist))


def pending_ids(master: list[dict], blacklist: set[int], max_id: int) -> list[int]:
    scraped = {int(record["id"]) for record in master}
    return [i for i in range(0, max_id + 1) if i not in scraped and i not in blacklist]


def scrape_batch(args) -> int:
    from playwright.sync_api import sync_playwright

    master = load_json(MASTER_PATH) if MASTER_PATH.exists() else []
    known_ids = {int(record["id"]) for record in master}
    blacklist = load_blacklist()

    if args.ids:
        targets = args.ids
    else:
        targets = pending_ids(master, blacklist, args.max_id)[: args.batch_size]
    blacklisted = [i for i in targets if i in blacklist]
    targets = [i for i in targets if i not in known_ids and i not in blacklist]
    if blacklisted:
        print(
            f"  SKIPPED (blacklisted): {blacklisted} — remove them from "
            f"archive-blacklist.json to re-scrape",
        )
    if not targets:
        print("Nothing to scrape: no pending ids in selection.")
        return 0

    print(f"Scraping {len(targets)} ids ({targets[0]}..{targets[-1]})")
    user_agent = (
        "win-archive-map-update/1.0 (+https://github.com/norad32/win-archive-map)"
    )
    ok_count = 0
    blacklist_count = 0

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.no_headless)
        page = browser.new_context(user_agent=user_agent).new_page()
        page.goto(START_URL, wait_until="networkidle", timeout=30_000)

        for index, archive_id in enumerate(targets, start=1):
            fields = fetch_fields(page, archive_id)
            time.sleep(args.page_delay)

            if fields is None:
                blacklist_count += 1
                blacklist.add(archive_id)
                print(f"  BLACKLIST: id={archive_id} (no data)")
            else:
                record = build_record(archive_id, fields)
                master.append(record)
                known_ids.add(archive_id)
                ok_count += 1
                print(
                    f"  OK: id={archive_id} {record['signature'] or '-'} {record['title'] or ''}"
                )

            if index % SAVE_EVERY == 0:
                if not args.dry_run:
                    save_json(MASTER_PATH, master)
                    save_blacklist(blacklist)

        browser.close()

    if not args.dry_run:
        master.sort(key=lambda record: natural_id_key(record["id"]))
        save_json(MASTER_PATH, master)
        save_blacklist(blacklist)

    print(
        f"Done. scraped={ok_count} blacklisted={blacklist_count} "
        f"(master now {len(master)} records, blacklist now {len(blacklist)} ids)"
    )
    return 0


def natural_id_key(value) -> list:
    """Sort key for ids that mixes digits and text ('10' < '9a' handled)."""
    return [
        (0, int(part)) if part.isdigit() else (1, part)
        for part in re.split(r"(\d+)", str(value))
    ]


def parse_ids_arg(raw: str) -> list[int]:
    ids = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            ids.extend(range(int(start), int(end) + 1))
        else:
            ids.append(int(part))
    return sorted(set(ids))


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--max-id", type=int, default=DEFAULT_MAX_ID)
    parser.add_argument("--list-pending", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--ids", type=parse_ids_arg, default=None)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--apply-only", action="store_true")
    parser.add_argument(
        "--all",
        action="store_true",
        help="with --apply/--apply-only: apply all pending master records, not just one batch",
    )
    parser.add_argument("--page-delay", type=float, default=DEFAULT_PAGE_DELAY)
    parser.add_argument("--no-headless", action="store_true")
    parser.add_argument("--skip-geocode", action="store_true")
    parser.add_argument("--skip-districts", action="store_true")
    parser.add_argument(
        "--diff-report", nargs="?", const="archive-diff.md", default=None
    )
    args = parser.parse_args()

    if args.diff_report:
        return write_diff_report(args)

    master_path_missing = not MASTER_PATH.exists()
    master = load_json(MASTER_PATH) if not master_path_missing else []
    blacklist = load_blacklist()

    if args.list_pending:
        pending = pending_ids(master, blacklist, args.max_id)
        print(
            f"Pending ids: {len(pending)} of {args.max_id + 1} "
            f"(master {len(master)}, blacklist {len(blacklist)})"
        )
        print(
            f"Next {min(args.batch_size, len(pending))}: {pending[: args.batch_size]}"
        )
        return 0

    if args.apply_only:
        run_apply_pipeline(args)
        return 0

    if args.dry_run:
        selection = (
            args.ids or pending_ids(master, blacklist, args.max_id)[: args.batch_size]
        )
        print(f"Dry run: would scrape {len(selection)} ids: {selection}")
        return 0

    scrape_batch(args)

    if args.apply:
        run_apply_pipeline(args)
    return 0


def run_apply_pipeline(args) -> None:
    master = load_json(MASTER_PATH) if MASTER_PATH.exists() else []
    archive = load_json(ARCHIVE_PATH)
    addresses = load_json(ADDRESSES_PATH)

    existing_pairs = {(record["id"], record.get("signature")) for record in archive}

    if args.ids:
        id_set = {str(i) for i in args.ids}
        candidates = [record for record in master if record["id"] in id_set]
    else:
        candidates = [
            record
            for record in master
            if (record["id"], record.get("signature")) not in existing_pairs
        ]
        if not args.all:
            candidates = candidates[: args.batch_size]

    existing_house_ids = {f["properties"]["id"] for f in addresses.get("features", [])}
    house_by_pair = {
        (f["properties"]["street"], f["properties"]["housenumber"]): f["properties"][
            "id"
        ]
        for f in addresses.get("features", [])
    }

    merged = 0
    skipped = 0
    new_houses = 0
    new_house_ids = []
    for record in candidates:
        if (record["id"], record.get("signature")) in existing_pairs:
            skipped += 1
            continue

        entry = {
            "id": record["id"],
            "signature": record.get("signature"),
            "title": record.get("title"),
            "year": record.get("year"),
            "district": record.get("district"),
            "neighbourhood": record.get("neighbourhood"),
        }
        street = record.get("street")
        raw_housenumber = record.get("housenumber")
        if street:
            entry["street"] = street
        if raw_housenumber:
            entry["housenumber"] = raw_housenumber

        houses, failed = (
            unroll_housenumber(raw_housenumber)
            if street and raw_housenumber
            else ([], [])
        )
        if street and houses and not failed:
            locs = []
            for house in houses:
                pair = (street, house)
                hid = house_by_pair.get(pair)
                if hid is None:
                    hid = address_id(street, house)
                    while hid in existing_house_ids:
                        hid += "_2"
                    house_by_pair[pair] = hid
                    existing_house_ids.add(hid)
                    addresses.setdefault("features", []).append(
                        {
                            "type": "Feature",
                            "geometry": {"type": "Point", "coordinates": None},
                            "properties": {
                                "id": hid,
                                "street": street,
                                "housenumber": house,
                                "status": STATUS_TODO,
                            },
                        }
                    )
                    new_houses += 1
                    new_house_ids.append(hid)
                locs.append(hid)
            entry["loc"] = locs[0] if len(locs) == 1 else locs
        else:
            entry["loc"] = None

        archive.append(entry)
        existing_pairs.add((record["id"], record.get("signature")))
        merged += 1

    if args.dry_run:
        preview = [record["id"] for record in candidates[:20]]
        print(
            f"Dry run apply: would merge {merged} records, skip {skipped} existing, "
            f"add {new_houses} houses. First ids: {preview}"
        )
        return

    archive.sort(key=lambda record: natural_id_key(record["id"]))
    save_json(ARCHIVE_PATH, archive)
    save_json(ADDRESSES_PATH, addresses)

    applied_pairs = {(record["id"], record.get("signature")) for record in archive}
    remaining = sum(
        1
        for record in master
        if (record["id"], record.get("signature")) not in applied_pairs
    )
    print(
        f"Applied master: merged={merged} skipped={skipped} newHouses={new_houses} "
        f"(archive now {len(archive)} entries, sorted by id; "
        f"{remaining} master records still unapplied)"
    )

    if new_houses and not args.skip_geocode:
        run_script("geocode.py", ["--ids", ",".join(new_house_ids)])
    if not args.skip_districts:
        run_script("update-districts.py")


def run_script(name: str, extra_args: list[str] | None = None) -> None:
    print(f"Running {name} ...")
    result = subprocess.run(
        [
            sys.executable,
            str(
                SCRIPTS_DIR / name,
            ),
        ]
        + (extra_args or [])
    )
    if result.returncode != 0:
        print(f"WARNING: {name} exited with code {result.returncode}")


def write_diff_report(args) -> int:
    master = load_json(MASTER_PATH) if MASTER_PATH.exists() else []
    archive = load_json(ARCHIVE_PATH)

    master_by_id = {record["id"]: record for record in master}
    archive_by_id = {}
    for record in archive:
        archive_by_id.setdefault(record["id"], []).append(record)

    master_only = [i for i in master_by_id if i not in archive_by_id]
    archive_only = [i for i in archive_by_id if i not in master_by_id]
    duplicates = {
        i: records for i, records in archive_by_id.items() if len(records) > 1
    }
    changed = []
    for archive_id, records in archive_by_id.items():
        if archive_id not in master_by_id or len(records) != 1:
            continue
        diffs = diff_record(master_by_id[archive_id], records[0])
        if diffs:
            changed.append((archive_id, diffs))

    lines = ["# Archive diff report", ""]
    lines.append(f"- Master records: {len(master)}")
    lines.append(f"- Archive entries: {len(archive)}")
    lines.append(f"- In master only (pending --apply): {len(master_only)}")
    lines.append(f"- In archive only (not from scrape): {len(archive_only)}")
    lines.append(f"- Changed after apply: {len(changed)}")
    lines.append(f"- Duplicate ids in archive: {len(duplicates)}")

    def section(
        title: str, items: list[str], count: int | None = None, cap: int = 100
    ) -> None:
        if not items and not count:
            return
        lines.append("")
        lines.append(f"## {title} ({count if count is not None else len(items)})")
        lines.extend(items[:cap])
        if len(items) > cap:
            lines.append(f"- ... and {len(items) - cap} more")

    section(
        "In master, not in archive",
        [
            f"- `{record['id']}` sig `{record.get('signature')}` {record.get('title') or '(no title)'}"
            for record in (master_by_id[i] for i in sorted(master_only))
        ],
    )
    section(
        "In archive, not in master",
        [
            f"- `{record['id']}` sig `{record.get('signature')}` {record.get('title') or '(no title)'}"
            for record in (archive_by_id[i][0] for i in sorted(archive_only))
        ],
    )
    section(
        "Duplicate ids in archive",
        [
            f"- `{archive_id}`: signatures {', '.join('`' + str(r.get('signature')) + '`' for r in records)}"
            for archive_id, records in sorted(duplicates.items())
        ],
    )

    changed_items = []
    for archive_id, diffs in sorted(changed)[:50]:
        changed_items.append(f"### id {archive_id}")
        for field, old, new in diffs:
            if field == "title":
                changed_items.append("```diff")
                changed_items.extend(word_diff(old or "", new or ""))
                changed_items.append("```")
            else:
                changed_items.append(f"- {field}: `{old}` → `{new}`")
    section(
        "Changed records (archive value → master value)",
        changed_items,
        count=len(changed),
    )

    report = "\n".join(lines) + "\n"
    output = Path(args.diff_report)
    output.write_text(report, encoding="utf-8")
    print(f"Diff report written to {output}")
    return 0


def diff_record(
    master_record: dict, archive_record: dict
) -> list[tuple[str, object, object]]:
    diffs = []
    # district/neighbourhood are deliberately re-derived from boundary data by
    # update-districts.py, so they are excluded from the comparison.
    comparable = ("signature", "title", "year", "street", "housenumber")
    for field in comparable:
        old, new = archive_record.get(field), master_record.get(field)
        if old != new:
            diffs.append((field, old, new))
    return diffs


def word_diff(old: str, new: str) -> list[str]:
    result = []
    for token in difflib.ndiff(old.split(), new.split()):
        marker = token[0]
        if marker in "+-":
            result.append(f"{marker} {token[2:]}")
        elif marker == "?":
            continue
    return result or [f"- {old}", f"+ {new}"]


if __name__ == "__main__":
    sys.exit(main())
