#!/usr/bin/env python3
"""Scrape the Winterthur-Glossar index and add new entries to src/data/glossary.json.

Existing entries (matched by title) are left untouched. New entries get
`tags` set to "todo" for manual curation.

Usage:
    python scripts/update-glossary.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.winterthur-glossar.ch"
LIST_URL = f"{BASE_URL}/thematische-auswahl/a-z"
GLOSSARY_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "glossary.json"

REQUEST_TIMEOUT_S = 30
RETRY_ATTEMPTS = 3
RETRY_DELAY_S = 2
USER_AGENT = "win-archive-map-glossary-updater/1.0 (github.com/norad32/win-archive-map)"


def fetch(url: str) -> str:
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_S)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt == RETRY_ATTEMPTS:
                raise
            print(f"  request failed ({exc}); retry {attempt}/{RETRY_ATTEMPTS - 1}…", file=sys.stderr)
            time.sleep(RETRY_DELAY_S)
    raise AssertionError("unreachable")


def parse_entries(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")

    entries: list[dict[str, str]] = []
    seen: set[str] = set()

    for item in soup.select(".featured-item"):
        link = item.select_one("a[href]")
        heading = item.select_one(".featured-item__heading")
        if link is None or heading is None:
            continue

        href = link["href"].strip()
        url = f"{BASE_URL}{href}" if href.startswith("/") else href
        if url in seen:
            continue
        seen.add(url)

        subtitle_tag = heading.select_one("span")
        subtitle = subtitle_tag.get_text(strip=True) if subtitle_tag else ""

        # Title is the heading text without the subtitle span.
        title = heading.get_text(separator="|", strip=True).split("|")[0].strip()
        if not title:
            continue

        category_tag = item.select_one(".featured-item__small")
        category = category_tag.get_text(strip=True) if category_tag else ""

        entries.append(
            {
                "title": title,
                "subtitle": subtitle,
                "category": category,
                "url": url,
                "tags": "todo",
            }
        )

    return entries


def load_existing(path: Path) -> tuple[list[dict], set[str]]:
    if not path.exists():
        return [], set()

    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    return data, {entry["title"] for entry in data}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report new entries without writing the file",
    )
    args = parser.parse_args()

    print(f"Fetching {LIST_URL} …")
    html = fetch(LIST_URL)

    scraped = parse_entries(html)
    print(f"Found {len(scraped)} entries on the site.")

    existing, existing_titles = load_existing(GLOSSARY_PATH)
    new_entries = [entry for entry in scraped if entry["title"] not in existing_titles]

    if not new_entries:
        print("No new entries.")
        return 0

    print(f"{len(new_entries)} new entries:")
    for entry in new_entries:
        print(f"  + {entry['title']}")

    if args.dry_run:
        print("Dry run: glossary.json not modified.")
        return 0

    GLOSSARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with GLOSSARY_PATH.open("w", encoding="utf-8") as f:
        json.dump(existing + new_entries, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Appended {len(new_entries)} entries to {GLOSSARY_PATH.relative_to(Path.cwd())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
