#!/usr/bin/env python3
"""
Matches GeoJSON feature properties against a glossary and produces a ranked
list of glossary entries by how often each one matched.

Usage:
    python match_glossary.py --features features.geojson --glossary glossary.json --out ranked_matches.csv
"""

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict

DISTRICT_NEIGHBOURHOOD_CATEGORY = "Stadtkreise und Quartiere"

# Same idea as Config.STOPWORDS in your JS version
STOPWORDS = {
    "winterthur",
    "hotel",
    "restaurant",
    "café",
    "bar",
    "kiosk",
    "museum",
    "kirche",
    "schule",
    "schulhaus",
    "cafe",
    "café",
    "haus",
    "stadthaus",
    "museum",
    "bäckerei",
    "ag",
    "bahnhof",
    "villa",
}

ADDRESS_RE = re.compile(r"([a-z][a-z\s]*?)\s+(\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)*)")


def normalize(text):
    if not text:
        return ""
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")  # strip accents
    text = re.sub(r"[^\w\s/-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def remove_stopwords(normalized_text):
    if not normalized_text:
        return ""
    return " ".join(w for w in normalized_text.split(" ") if w not in STOPWORDS).strip()


def strip_place_suffix(title):
    if not title:
        return ""
    return re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()


def expand_number_part(number_part):
    return [n.strip() for n in re.split(r"[-/]", number_part) if n.strip()]


def extract_addresses(raw_text):
    if not raw_text:
        return []
    normalized = normalize(raw_text)
    addresses = []
    for match in ADDRESS_RE.finditer(normalized):
        street = match.group(1).strip()
        number_part = match.group(2).strip()
        numbers = expand_number_part(number_part)
        if street and numbers:
            addresses.append({"street": street, "numbers": numbers})
    return addresses


def word_overlap_score(a, b):
    if not a or not b:
        return 0.0
    set_a = {w for w in a.split(" ") if len(w) > 3}
    set_b = {w for w in b.split(" ") if len(w) > 3}
    if not set_a or not set_b:
        return 0.0
    overlap = len(set_a & set_b)
    return overlap / min(len(set_a), len(set_b))


def load_glossary(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    glossary = []
    for entry in data:
        is_place_entry = entry.get("category") == DISTRICT_NEIGHBOURHOOD_CATEGORY
        norm_title = normalize(entry.get("title"))
        glossary.append({
            **entry,
            "_normTitle": norm_title,
            "_normTitleFiltered": remove_stopwords(norm_title),
            "_normSubtitle": normalize(entry.get("subtitle")),
            "_addresses": extract_addresses(entry.get("subtitle")),
            "_placeName": normalize(strip_place_suffix(entry.get("title"))) if is_place_entry else None,
        })
    return glossary


def load_features(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("features", [])


def find_glossary_matches(props, glossary, max_results=5, min_score=0.3):
    if not glossary:
        return []

    title = normalize(props.get("title"))
    title_filtered = remove_stopwords(title)
    street = normalize(props.get("street"))
    housenumber = normalize(props.get("housenumber"))
    district = normalize(props.get("district"))
    neighbourhood = normalize(props.get("neighbourhood"))

    scored = []

    for entry in glossary:
        score = 0.0
        g_title_filtered = entry["_normTitleFiltered"]

        # Exact address match (including ranges like 2-4 or 2/4)
        if street and housenumber and entry["_addresses"]:
            has_exact_address_match = any(
                addr["street"] == street and housenumber in addr["numbers"]
                for addr in entry["_addresses"]
            )
            if has_exact_address_match:
                score += 1.0
            else:
                has_street_only_match = any(
                    addr["street"] == street for addr in entry["_addresses"]
                )
                if has_street_only_match:
                    score += 0.3

        # Exact district / neighbourhood match
        if entry["_placeName"]:
            if district and entry["_placeName"] == district:
                score += 0.8
            if neighbourhood and entry["_placeName"] == neighbourhood:
                score += 0.8

        # Glossary title appears inside the feature title
        if g_title_filtered and g_title_filtered in title_filtered:
            score += 0.6

        # Partial word overlap fallback
        if score == 0:
            score += word_overlap_score(title_filtered, g_title_filtered) * 0.5

        if score >= min_score:
            scored.append((entry, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    return [
        {
            "title": entry["title"],
            "subtitle": entry.get("subtitle"),
            "category": entry.get("category"),
            "url": entry.get("url"),
            "score": round(score, 2),
        }
        for entry, score in scored[:max_results]
    ]


def main():
    parser = argparse.ArgumentParser(description="Match GeoJSON features against a glossary.")
    parser.add_argument("--features", required=True, help="Path to GeoJSON feature collection")
    parser.add_argument("--glossary", required=True, help="Path to glossary JSON")
    parser.add_argument("--out", default="ranked_matches.csv", help="Output CSV path")
    parser.add_argument("--max-results", type=int, default=5, help="Max glossary matches per feature")
    parser.add_argument("--min-score", type=float, default=0.3, help="Minimum score threshold")
    parser.add_argument("--top-n", type=int, default=None, help="Only print top N in console summary")
    args = parser.parse_args()

    print(f"Loading glossary from {args.glossary} ...")
    glossary = load_glossary(args.glossary)
    print(f"  loaded {len(glossary)} glossary entries")

    print(f"Loading features from {args.features} ...")
    features = load_features(args.features)
    print(f"  loaded {len(features)} features")

    match_counts = Counter()
    match_meta = {}  # url -> {title, category, url}
    match_examples = defaultdict(list)  # url -> list of feature titles that matched it

    for i, feature in enumerate(features):
        props = feature.get("properties", {})
        matches = find_glossary_matches(
            props, glossary, max_results=args.max_results, min_score=args.min_score
        )
        for m in matches:
            key = m["url"] or m["title"]  # fallback key if url missing
            match_counts[key] += 1
            match_meta[key] = m
            if len(match_examples[key]) < 5:
                match_examples[key].append(props.get("title", ""))

        if (i + 1) % 500 == 0:
            print(f"  processed {i + 1}/{len(features)} features...")

    ranked = match_counts.most_common(args.top_n)

    print("\n=== Ranked glossary matches ===")
    for key, count in ranked:
        meta = match_meta[key]
        print(f"{count:5d}  {meta['title']}  [{meta['category']}]  {meta['url']}")

    # Write full CSV (not just top-n)
    import csv
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["count", "title", "category", "url", "example_feature_titles"])
        for key, count in match_counts.most_common():
            meta = match_meta[key]
            examples = " | ".join(match_examples[key])
            writer.writerow([count, meta["title"], meta["category"], meta["url"], examples])

    print(f"\nWrote {len(match_counts)} ranked entries to {args.out}")


if __name__ == "__main__":
    main()