#!/usr/bin/env python3
"""Spell-check the titles in src/data/archive.json.

Titles are German (Swiss spelling) full of street names, house names and
person names that a dictionary cannot know, so checking is word-based with a
multi-layer whitelist:

1. street names from addresses.geojson (full names and parts, e.g.
   "Römerstrasse" and "Römer")
2. words from the Winterthur-Glossar titles (glossary.json)
3. src/data/spellcheck-whitelist.json — a human-editable, sorted list that
   starts from common local vocabulary and grows with --accept

Everything else is checked with LanguageTool (German, local server; the
first run downloads it once). Swiss orthography is enforced separately:
titles containing "ß" are reported regardless of the whitelist.

The script only reports; nothing in archive.json is modified.

Usage:
    venv/bin/python scripts/spell-check.py [--output spellcheck-report.md]
        [--min-count 1] [--accept "Wort1,Wort2"] [--no-languagetool]
        [--limit N]
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from jsonio import load_json, save_json

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
ARCHIVE_PATH = DATA_DIR / "archive.json"
ADDRESSES_PATH = DATA_DIR / "addresses.geojson"
GLOSSARY_PATH = DATA_DIR / "glossary.json"
WHITELIST_PATH = DATA_DIR / "spellcheck-whitelist.json"

TOKEN_RE = re.compile(r"[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*")
WORD_RE = re.compile(r"^[A-Za-zÄÖÜäöüß]+$")

LT_BATCH_SIZE = 200
SPELLING_RULE_PREFIXES = ("SWISS_GERMAN", "MORFOLOGIK", "HUNSPELL", "SPELL")

DEFAULT_WHITELIST = [
    # Abbreviations whose periods the tokenizer strips.
    "nr",
    "dr",
    "ff",
    "ehem",
    "gebr",
    "bauamt",
    # Swiss orthography and local vocabulary seen across many titles.
    "ss",
    "strasse",
    "winterthur",
    "winterthurer",
    "gasse",
    "platz",
    "weg",
    "quartier",
    "seit",
    "jahre",
    "jahr",
    "um",
    "und",
    "oder",
    "vor",
    "nach",
    "von",
    "vom",
    "im",
    "in",
    "am",
    "an",
    "auf",
    "aus",
    "beim",
    "zur",
    "zum",
    "alt",
    "alte",
    "alter",
    "altes",
    "neu",
    "neue",
    "neuer",
    "neues",
    "eck",
    "hof",
    "haus",
    "häuser",
    "kirche",
    "kirchgemeinde",
    "museum",
    "heimatmuseum",
    "stadt",
    "stadtarchiv",
    "stadtbibliothek",
    "gemeinde",
    "bezirk",
    "kanton",
    "kantons",
    "see",
    "fluss",
    "bahn",
    "bahnhof",
    "trambahn",
    "strassenbahn",
    "fabrik",
    "werke",
    "werk",
    "areal",
    "bad",
    "schulhaus",
    "schule",
    "spital",
    "kantonsspital",
    "friedhof",
    "kapelle",
    "schloss",
    "burg",
    "turm",
    "brücke",
    "weiher",
    "wald",
    "feld",
    "berg",
    "tal",
    "mühle",
    "müller",
    "zimmer",
    "laden",
    "hotel",
    "restaurant",
    "café",
    "kino",
    "turnhalle",
    "schwimmbad",
    "baugeschäft",
    "bauernhaus",
    "wohnhaus",
    "geschäftshaus",
    "gebäude",
    "denkmal",
    "brunnen",
    "wappen",
    "glocke",
    "orgel",
    "chor",
    "verein",
    "fest",
    "parade",
    "umzug",
    "jubiläum",
    "ausstellung",
    "konzert",
    "theater",
    "schiessen",
    "schwinget",
    "volksfest",
]


def tokenize(title: str) -> list[str]:
    """Words suitable for checking: letters only, no numbers/abbrev noise."""
    words = []
    for chunk in TOKEN_RE.findall(title or ""):
        for part in chunk.split("-"):
            part = part.strip("-")
            if len(part) >= 2 and WORD_RE.match(part):
                words.append(part)
    return words


def build_known_words() -> set[str]:
    known = set()

    addresses = load_json(ADDRESSES_PATH)
    for feature in addresses.get("features", []):
        street = feature.get("properties", {}).get("street") or ""
        for part in re.split(r"[\s\-\./]+", street):
            if part:
                known.add(part.lower())
        known.add(re.sub(r"[^a-zäöü]", "", street.lower()))

    glossary = load_json(GLOSSARY_PATH)
    for article in glossary:
        for field in ("title", "subtitle"):
            for word in tokenize(article.get(field) or ""):
                known.add(word.lower())

    if WHITELIST_PATH.exists():
        known.update(word.lower() for word in load_json(WHITELIST_PATH))

    return known


def ensure_whitelist_file() -> None:
    if not WHITELIST_PATH.exists():
        save_json(WHITELIST_PATH, sorted(set(DEFAULT_WHITELIST)))
        print(f"Created {WHITELIST_PATH.name} with default vocabulary")


def check_with_languagetool(candidates: Counter) -> set[str]:
    """Return the candidate words LanguageTool flags as misspelled.

    Titles contain both "Richtung" and lowercase "richtung"; the German
    speller only knows the capitalized noun, so a word is flagged only when
    both its original and its Capitalized form fail.
    """
    from language_tool_python import LanguageTool

    tool = LanguageTool("de-CH")
    try:
        as_is = _check_batched(tool, list(candidates))
        capitalized = _check_batched(tool, [word.capitalize() for word in candidates])
        return {
            word
            for word in candidates
            if word.lower() in as_is and word.lower() in capitalized
        }
    finally:
        tool.close()


def _check_batched(tool, words: list[str]) -> set[str]:
    flagged = set()
    for start in range(0, len(words), LT_BATCH_SIZE):
        batch = words[start : start + LT_BATCH_SIZE]
        text = " ".join(batch)
        try:
            matches = tool.check(text)
        except Exception as err:
            print(f"LanguageTool batch failed ({err}); skipping batch", file=sys.stderr)
            continue

        offsets = []
        position = 0
        for word in batch:
            offsets.append((position, position + len(word)))
            position += len(word) + 1

        flagged_positions = set()
        for match in matches:
            if not str(match.rule_id).upper().startswith(SPELLING_RULE_PREFIXES):
                continue
            midpoint = match.offset + match.error_length // 2
            for i, (begin, end) in enumerate(offsets):
                if begin <= midpoint < end:
                    flagged_positions.add(i)
                    break
        flagged.update(
            word.lower() for i, word in enumerate(batch) if i in flagged_positions
        )
    return flagged


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--output", default="spellcheck-report.md")
    parser.add_argument(
        "--min-count", type=int, default=1, help="only report words seen >= N times"
    )
    parser.add_argument(
        "--accept",
        type=str,
        default="",
        help="comma-separated words to add to the whitelist",
    )
    parser.add_argument(
        "--no-languagetool",
        action="store_true",
        help="skip LanguageTool, report ß only",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="only check the first N entries (testing)",
    )
    args = parser.parse_args()

    ensure_whitelist_file()

    if args.accept:
        accepted = [w.strip() for w in args.accept.split(",") if w.strip()]
        whitelist = set(load_json(WHITELIST_PATH))
        whitelist.update(word.lower() for word in accepted)
        save_json(WHITELIST_PATH, sorted(whitelist))
        print(f"Whitelist now {len(whitelist)} words")

    archive = load_json(ARCHIVE_PATH)
    if args.limit:
        archive = archive[: args.limit]
    print(f"Checking {len(archive)} titles")

    known_words = build_known_words()
    print(f"Known words (streets, glossary, whitelist): {len(known_words)}")

    counts: Counter = Counter()
    examples: dict[str, str] = {}
    sharp_s: list[tuple[str, str]] = []
    for record in archive:
        title = record.get("title") or ""
        for word in tokenize(title):
            counts[word] += 1
            examples.setdefault(word, record.get("id") or "?")
        if "ß" in title:
            sharp_s.append((record.get("id") or "?", title))

    unknown = Counter(
        {
            word: count
            for word, count in counts.items()
            if word.lower() not in known_words and count >= args.min_count
        }
    )
    print(f"Unknown words after whitelist: {len(unknown)}")

    flagged: set[str] = set()
    if not args.no_languagetool and unknown:
        started = time.time()
        print("Running LanguageTool (de-CH) ...")
        flagged = check_with_languagetool(unknown)
        print(
            f"LanguageTool flagged {len(flagged)} words in {time.time() - started:.1f}s"
        )

    suspicious = sorted(
        ((word, count) for word, count in unknown.items() if word.lower() in flagged),
        key=lambda item: (-item[1], item[0].lower()),
    )
    maybe_ok = sorted(
        (
            (word, count)
            for word, count in unknown.items()
            if word.lower() not in flagged
        ),
        key=lambda item: (-item[1], item[0].lower()),
    )

    lines = ["# Spell-check report", ""]
    lines.append(f"- Titles checked: {len(archive)}")
    lines.append(f"- Distinct words: {len(counts)}")
    lines.append(f"- Unknown after whitelist: {len(unknown)}")
    lines.append(f"- Flagged by LanguageTool: {len(suspicious)}")
    lines.append(f"- Titles with ß (Swiss spelling): {len(sharp_s)}")

    if sharp_s:
        lines.append("")
        lines.append("## Titles with ß")
        for record_id, title in sharp_s[:100]:
            lines.append(f"- `{record_id}` {title}")
        if len(sharp_s) > 100:
            lines.append(f"- ... and {len(sharp_s) - 100} more")

    def word_section(title: str, items: list[tuple[str, int]]) -> None:
        if not items:
            return
        lines.append("")
        lines.append(f"## {title} ({len(items)})")
        for word, count in items[:200]:
            lines.append(f"- **{word}** ×{count} (e.g. id `{examples[word]}`)")
        if len(items) > 200:
            lines.append(f"- ... and {len(items) - 200} more")

    word_section("Likely misspellings (LanguageTool)", suspicious)
    word_section("Unknown but not flagged (probably names/compounds)", maybe_ok)

    report = "\n".join(lines) + "\n"
    Path(args.output).write_text(report, encoding="utf-8")
    print(f"Report written to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
