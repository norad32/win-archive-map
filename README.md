<div align="center">
  <img src="src/assets/favicon.svg" width="180" alt="Win Archive Map logo" />
</div>

# Win Archive Map

Interactive map viewer for the [Bildarchiv Winterthur](https://bilddatenbank.winterthur.ch) image archive. Browse historical photos of Winterthur placed on an interactive map, filter by title, street, district, and year range, and switch between historical map and aerial imagery layers from swisstopo. Clicking an entry shows its metadata and links related articles from the Winterthur-Glossar.

**[View Live](https://norad32.github.io/win-archive-map/)**

## Features

- Historical photos grouped and clustered by location on a Leaflet map
- Filters: title search, street (with autocomplete), district, neighbourhood, year range
- Timeline slider to switch between historical map/aerial layers (1850–today)
- District and neighbourhood boundary overlays
- Related glossary articles per entry, from the Winterthur-Glossar

## Quick start

```bash
npm install
npm run dev     # serve at http://localhost:8000
npm run build   # build to dist/
npm run deploy  # build and publish to GitHub Pages
```

## Tech stack

Vanilla ES modules (no framework), Leaflet + Leaflet.markercluster, esbuild bundler, Python (Playwright, BeautifulSoup, httpx) for data scraping and geocoding. Data is published as GeoJSON.

## Credits

- [Bildarchiv Winterthur](https://bilddatenbank.winterthur.ch) – Metadata source
- [Winterthur-Glossar](https://winbib.ch) – Glossary entries / background information on places and topics in Winterthur
- [Stadtkreise und Quartiere Zürich und Winterthur (OGD)](https://www.geolion.zh.ch) – District and neighbourhood boundary data, licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.de)
- [geo.admin.ch](https://www.geo.admin.ch/) – Swiss federal geospatial API for address geocoding
- [swisstopo](https://www.swisstopo.admin.ch) – Base map imagery (Pixelkarte and Luftbild)
- [Leaflet](https://leafletjs.com) – Interactive maps library
- [Leaflet.markercluster](https://github.com/leaflet/leaflet.markercluster) – Marker clustering
- [Playwright](https://playwright.dev) – Web scraping
- [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) – HTML parsing

## License

[MIT](LICENSE)

## Author

[norad32](https://github.com/norad32)
