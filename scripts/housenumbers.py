"""Shared housenumber parsing and address-id helpers.

The canonical rules for unrolling composite housenumbers into individual
houses:

- comma-separated lists:        "7, 11-13"      -> 7, 11, 13
- ranges, parity-aware:         "31-35"         -> 31, 33, 35
                                "32-84"         -> 32, 34, ..., 84
                                "12-45"         -> 12, 13, ..., 45
- reversed ranges:              "263-165"       -> ascending, same rules
- slash/list separators:        "34/36", "86/88/90", "20 und 24",
                                "308+312", "27 31", "13.15"  -> individual houses
- letter groups:                "19 a/b/c"      -> 19a, 19b, 19c
                                "62a/62b"       -> 62a, 62b
- letter suffixes:              "18c"           -> 18c
- same-base letter ranges:      "28a-f"         -> 28a, 28b, ..., 28f
                                "3-3a"          -> 3, 3a
- cross ranges with letters:    "15a-17a"       -> 15a, 17a
                                "6a-12"         -> 6a, 8, 10, 12
- open-ended ("und folgende"):  "18ff."         -> 18 (first house only)
- open-ended trailing dash:     "177-"          -> 177
- noise:                        "(?)", "bei 27" -> cleaned, "bei 27" -> 27

Unparsable parts are reported and never silently dropped.
"""

import re
import unicodedata

_RANGE_RE = re.compile(
    r"^(\d+)\s*([a-z\u00e4\u00f6\u00fc]?)\s*[-\u2013]\s*(\d+)\s*([a-z\u00e4\u00f6\u00fc]?)$"
)
_LETTER_RANGE_RE = re.compile(
    r"^(\d+)\s*([a-z\u00e4\u00f6\u00fc]?)\s*[-\u2013]\s*([a-z\u00e4\u00f6\u00fc]?)$"
)
_FF_RE = re.compile(r"^(\d+)\s*ff\.?$")
_NUMBER_RE = re.compile(r"^(\d+)([a-z\u00e4\u00f6\u00fc]*)$")
_LETTERS_ONLY_RE = re.compile(r"^[a-z\u00e4\u00f6\u00fc]{1,2}$")
_LEADING_NUM_RE = re.compile(r"^(\d+)")
_CHUNK_SPLIT_RE = re.compile(r"\s*[/+.]\s*|\s+|\s*und\s*")
_FIRST_NUMBER_RE = re.compile(r"\d+")

_NOISE_RE = re.compile(r"\(\?\)|[\^\u00a8]")
_BEI_RE = re.compile(r"^bei\s+")
_TRAILING_DASH_RE = re.compile(r"^(\d+)\s*-\s*$")
_LEADING_DASH_RE = re.compile(r"^-\s*(\d+)$")


def normalize_housenumber(raw):
    """Return the normalized single-housenumber string (e.g. '18c')."""
    text = str(raw).strip().lower()
    text = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", "", text)


def first_number(raw):
    """Return the first plain integer in a housenumber string, or None."""
    match = _FIRST_NUMBER_RE.search(str(raw or ""))
    return int(match.group(0)) if match else None


def unroll_housenumber(raw):
    """Unroll a composite housenumber into individual house strings.

    Returns a tuple (houses, failed_parts) where houses is a list of
    normalized housenumber strings and failed_parts lists the parts that
    could not be parsed.
    """
    if raw is None:
        return [], []

    text = unicodedata.normalize("NFC", str(raw).strip().lower())
    if not text:
        return [], []

    houses = []
    failed = []

    for part in text.split(","):
        part = _NOISE_RE.sub("", part)
        part = _BEI_RE.sub("", part).strip()
        if not part:
            failed.append(part)
            continue

        trailing = _TRAILING_DASH_RE.match(part)
        if trailing:
            houses.append(trailing.group(1))
            continue

        leading = _LEADING_DASH_RE.match(part)
        if leading:
            houses.append(leading.group(1))
            continue

        part_houses = _expand_part(part)
        if part_houses:
            houses.extend(part_houses)
        else:
            failed.append(part)

    return [unicodedata.normalize("NFC", h) for h in houses], failed


def _expand_part(part):
    """Expand one comma-separated part into a list of house strings."""
    chunks = [c for c in _CHUNK_SPLIT_RE.split(part) if c]

    houses = []
    for chunk in chunks:
        if _LETTERS_ONLY_RE.match(chunk):
            # Letter-only chunk attaches to the numeric base of the previous
            # token: "19 a/b/c" -> 19a, 19b, 19c; "10 a" -> 10a.
            if not houses:
                continue
            base_match = _LEADING_NUM_RE.match(houses[-1])
            if not base_match:
                continue
            base = base_match.group(1)
            houses.append(f"{base}{chunk}")
            if houses[-2] == base:
                del houses[-2]
        else:
            houses.extend(_expand_chunk(chunk))
    return houses


def _expand_chunk(chunk):
    match = _LETTER_RANGE_RE.match(chunk)
    if match and (match.group(2) or match.group(3)):
        base, first, last = match.group(1), match.group(2), match.group(3)
        if first and last and first > last:
            first, last = last, first
        return [f"{base}{letter}" for letter in _letter_span(first, last)]

    match = _RANGE_RE.match(chunk)
    if match:
        a, la, b, lb = (
            int(match.group(1)),
            match.group(2),
            int(match.group(3)),
            match.group(4),
        )
        if a == b:
            # "116-116c": same number, pure letter expansion.
            return [f"{a}{letter}" for letter in _letter_span(la, lb)]
        if a > b:
            a, b = b, a
        step = 2 if (a % 2) == (b % 2) else 1
        numbers = list(range(a, b + 1, step))
        result = [str(n) for n in numbers]
        if la:
            result[0] += la
        if lb:
            result[-1] += lb
        return result

    match = _FF_RE.match(chunk)
    if match:
        return [match.group(1)]

    match = _NUMBER_RE.match(chunk)
    if match:
        return [chunk]

    return []


def _letter_span(first, last):
    """Expand '' -> 'a' to ['', 'a'], 'a' -> 'c' to ['a', 'b', 'c']."""
    if first == last:
        return [first]
    start = ord(first) if first else ord("a") - 1
    end = ord(last)
    return [chr(c) if c >= ord("a") else "" for c in range(start, end + 1)]


def slugify_street(street):
    """Deterministic slug for street names, unicode-safe (e.g. 'Römerstrasse')."""
    text = unicodedata.normalize("NFC", str(street).strip().lower())
    text = re.sub(r"[\s\-]+", "_", text)
    text = re.sub(r"[^\w\u00c0-\u024f]", "", text)
    text = re.sub(r"_+", "_", text)
    return text.strip("_")


def address_id(street, housenumber):
    """Stable id for a house, e.g. 'römerstrasse_18c'."""
    return f"{slugify_street(street)}_{normalize_housenumber(housenumber)}"


def housenumber_sort_key(housenumber):
    """Natural sort key so '8' < '8a' < '9' < '10'."""
    match = _FIRST_NUMBER_RE.fullmatch(str(housenumber))
    if match:
        return (0, int(match.group(0)), "")
    match = re.fullmatch(r"(\d+)(\D+)", normalize_housenumber(housenumber))
    if match:
        return (0, int(match.group(1)), match.group(2))
    return (1, 0, str(housenumber))
