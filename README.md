<div align="center">
  <img src="src/assets/favicon.svg" width="128" alt="Win Archive Map logo" />
</div>

# Win Archive Map

Win Archive Map is an interactive map for exploring historical photographs from the [Bildarchiv Winterthur](https://bilddatenbank.winterthur.ch). Browse records in their geographic context, compare historic maps and aerial imagery, and follow related [Winterthur-Glossar](https://www.winterthur-glossar.ch/) articles.

**[Open the live map](https://norad32.github.io/win-archive-map/)**

## Using the map

- Search words in a title, or filter by year, district, neighbourhood or street.
- Choose **Digital Map** or **Aerial Image**, then use the year slider to browse available historic editions and aerial surveys.
- Click a marker to view its archive record. Marker size reflects the number of records at a location, the exact number of entries at a location are available by tooltip.
- **View in Bildarchiv** searches by archive signature, which gives and exact match of this entry.
- **Search in Bildarchiv** searches by street, house number and year, and also matches similar entries.
- **Zoom to results** fits filtered markers.
- **Clear Filters** resets all filters.
- Right-click the map to copy coordinates.
- Use **Report incorrect metadata** in a record's details to report incorrect information or a misplaced marker.

## Contributing and reporting problems

For a misplaced marker or incorrect archive information, open the record and select **Report incorrect metadata**. The pre-filled GitHub issue includes the record's metadata. Describe the problem and, if known, provide the correct location or coordinates. You can also [browse or open issues](https://github.com/norad32/win-archive-map/issues). Contributions to location research, metadata verification, code and documentation are welcome.

Keep in mind this will have no bearing on the metadata of the actual Bildarchiv. But i will report differences from time to time.

## Data formats

Source data lives in `src/data/`.

### `archive.json` — application archive

A JSON array containing one record per Bildarchiv record. `id` and `signature` identify the source record; `loc` joins it to map points.

| Field                       | Meaning                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                        | Bildarchiv record id, stored as a string.                                                                                                                                |
| `signature`                 | Bildarchiv signature. Together with `id`, identifies a scraped record when applying updates.                                                                             |
| `title`, `year`             | Archive title and date text.                                                                                                                                             |
| `street`, `housenumber`     | Street and house-number text when provided.                                                                                                                              |
| `district`, `neighbourhood` | Derived area labels. Can be `null`. For a range spanning areas, these are `null` on the parent record.                                                                   |
| `loc`                       | Address/POI id, an array of ids for a range, or `null` when no map point is assigned.                                                                                    |
| `locationParts`             | Optional array when a range crosses areas. Each part has `district`, `neighbourhood`, `housenumbers` and that segment's `loc` ids. The archive record is not duplicated. |

Example of one archive record split across two neighbourhoods:

```json
{
  "id": "1889",
  "signature": "Technikumstrasse 61_53",
  "title": "Technikumstrasse, Archplatz, Blick vom Bahnhofplatz gegen Osten",
  "year": "1948",
  "district": null,
  "neighbourhood": null,
  "street": "Technikumstrasse",
  "housenumber": "81-84",
  "loc": [
    "technikumstrasse_81",
    "technikumstrasse_82",
    "technikumstrasse_83",
    "technikumstrasse_84"
  ],
  "locationParts": [
    {
      "district": "Winterthur-Stadt",
      "neighbourhood": "Altstadt",
      "housenumbers": ["82", "84"],
      "loc": ["technikumstrasse_82", "technikumstrasse_84"]
    },
    {
      "district": "Winterthur-Stadt",
      "neighbourhood": "Heiligberg",
      "housenumbers": ["81", "83"],
      "loc": ["technikumstrasse_81", "technikumstrasse_83"]
    }
  ]
}
```

### `archive-master.json` — scrape master

A JSON array of records scraped from the Bildarchiv before locations are assigned. Each record has `id`, `signature`, `title`, `year`, `district`, `street`, and `housenumber`. The scraper sets `neighbourhood` and `loc` to `null`. The apply workflow fills or derives location metadata. Records are applied to `archive.json` by `(id, signature)`.

### `addresses.geojson` — street addresses

A GeoJSON `FeatureCollection` with one Point feature per individual house number. Ranges and lists are expanded (`31-35` becomes `31`, `33`, `35`, `18c` remains `18c`).

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [8.735, 47.5] },
  "properties": {
    "id": "römerstrasse_8",
    "street": "Römerstrasse",
    "housenumber": "8",
    "status": "auto"
  }
}
```

- `geometry.coordinates` uses GeoJSON order: `[longitude, latitude]`, it is `null` if the address is not located yet.
- `properties.id` is the stable key referenced by archive `loc` values.
- `properties.status` is `auto` (assigned automatically), `manual` (placed by hand), or `todo` (not yet located).
- District and neighbourhood labels are stored on archive entries, not address features.

### `locations.geojson` — curated places

A GeoJSON `FeatureCollection` of points that are not ordinary house addresses, such as parks, buildings and historic sites. Properties include a stable `id`, `status`, optional `street` and `housenumber`, and derived `district` and `neighbourhood` values when coordinates are available.

### Other data files

- `streets.json`: an object with `districts` and `neighbourhoods` maps. Each area maps to a list of streets, a street may belong to multiple areas.
- `districts.geojson`, `neighbourhoods.geojson`: polygon FeatureCollections used to draw boundaries and derive area assignments. Neighbourhood properties include their parent district and area number.
- `glossary.json`: an array of Winterthur-Glossar records with `title`, `subtitle`, `category`, `url`, and optional matching fields `street`, `address`, `district`, `neighbourhood` and `tags`.

## Data maintenance

The Bildarchiv scrape is long-running. `update-archive.py` processes one batch at a time (100 ids by default) and saves progress so runs can be resumed over multiple sessions.

```bash
venv/bin/python scripts/update-archive.py --list-pending
venv/bin/python scripts/update-archive.py                     # scrape next batch into archive-master.json
venv/bin/python scripts/update-archive.py --apply             # scrape, apply, geocode, update areas, spell-check
venv/bin/python scripts/update-archive.py --apply-only        # apply next master batch without scraping
venv/bin/python scripts/update-archive.py --apply-only --ids 1200-1299
venv/bin/python scripts/update-archive.py --apply-only --dry-run
venv/bin/python scripts/update-archive.py --diff-report      # compare master with archive.json
```

Apply merges by `(id, signature)`, adds missing address features, geocodes newly added addresses, updates archive and curated-location area labels, splits ranges crossing areas into `locationParts`, rebuilds `streets.json`, and refreshes the full spell-check report. Follow-up steps can be skipped with `--skip-geocode`, `--skip-districts` or `--skip-spellcheck`. Geocoding enforces the map bounds, unresolved and out-of-bounds results remain `todo`.

### Updating areas and glossary

```bash
venv/bin/python scripts/update-districts.py [--dry-run]
venv/bin/python scripts/update-glossary.py [--dry-run]
```

`update-districts.py` checks address and curated-place coordinates against boundary polygons, updates archive and POI area labels, creates `locationParts` for ranges crossing areas, and rebuilds `streets.json`.

### Spell-checking titles

```bash
venv/bin/python scripts/spell-check.py
venv/bin/python scripts/spell-check.py --accept "Wort1,Wort2"
```

Titles are German (Swiss spelling). Street names, glossary vocabulary and `scripts/spellcheck-whitelist.json` are excluded; LanguageTool (`de-CH`) reports likely misspellings in `spellcheck-report.md`. The script reports but does not edit archive titles. Swiss `ß` spellings are reported separately.

## Technology and credits

- **Frontend:** vanilla JavaScript ES modules, HTML and CSS.
- **Mapping:** Leaflet 1.9.4 and the vendored Leaflet.markercluster plugin.
- **Build:** esbuild bundles the app.
- **Tests and code quality:** Node.js built-in `node:test` runner with coverage, ESLint, Prettier and Black.
- **Python data tools:** Playwright and BeautifulSoup scrape the dynamic Bildarchiv, Requests handles HTTP, Shapely performs point-in-polygon matching; `language_tool_python` provides German spell-checking.
- **Photographs and metadata:** [Bildarchiv Winterthur](https://bilddatenbank.winterthur.ch).
- **Related articles:** [Winterthur-Glossar](https://www.winterthur-glossar.ch).
- **Boundaries:** [Kanton Zürich open geodata](https://www.geolion.zh.ch), licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.de).
- **Address geocoding:** [geo.admin.ch](https://www.geo.admin.ch/).
- **Map tiles and historical aerial imagery:** [swisstopo](https://www.swisstopo.admin.ch).
- **Map library and clustering:** [Leaflet](https://leafletjs.com) and [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster).

## Development and deployment

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
npm run deploy
```

GitHub Actions runs lint, tests and build on pushes and pull requests to `main`, and deploys successful pushes to GitHub Pages.

## License and author

Application code is licensed under [MIT](LICENSE). Data retains the licences and attribution requirements of its respective sources.

Made with ❤️ by [norad32](https://github.com/norad32).
