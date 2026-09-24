export const Config = Object.freeze({
  ARCHIVE_URL: "data/archive.json",
  ADDRESSES_URL: "data/addresses.geojson",
  LOCATIONS_URL: "data/locations.geojson",
  STREETS_URL: "data/streets.json",
  DISTRICTS_GEOJSON_URL: "data/districts.geojson",
  NEIGHBOURHOODS_GEOJSON_URL: "data/neighbourhoods.geojson",
  GLOSSARY_URL: "data/glossary.json",

  GITHUB_REPO: "norad32/win-archive-map",

  MOBILE_BREAKPOINT: 932, // keep in sync with style.css @media rule

  OUTLINE_COLOR: "#d81400", // matches --color-brand in style.css

  MAP_INITIAL_CENTER: [47.5001, 8.724],
  MAP_INITIAL_ZOOM: 13,
  MAP_MIN_ZOOM: 11,
  MAP_MAX_ZOOM: 20,
  // Tiles are only fetched up to this zoom, beyond it they are upscaled instead of missing.
  MAP_MAX_NATIVE_ZOOM: 18,
  MAP_MAX_BOUNDS: [
    [47.42, 8.59], // south-west
    [47.60, 8.96] // north-east
  ],

  // Marker sizing: plain pins scale with entry count (log, 1..PIN_MAX_COUNT),
  // the lion pin ("Geoleo", the selected marker) is always the same size.
  PIN_MIN_SIZE: 28,
  PIN_MAX_SIZE: 44,
  PIN_MAX_COUNT: 1000,
  LION_PIN_SIZE: 80,
});
