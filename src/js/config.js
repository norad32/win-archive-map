export const Config = Object.freeze({
  ARCHIVE_URL: "data/archive.json",
  ADDRESSES_URL: "data/addresses.geojson",
  LOCATIONS_URL: "data/locations.geojson",
  DISTRICTS_URL: "data/districts.json",
  DISTRICTS_GEOJSON_URL: "data/districts.geojson",
  NEIGHBOURHOODS_GEOJSON_URL: "data/neighbourhoods.geojson",
  GLOSSARY_URL: "data/glossary.json",

  GITHUB_REPO: "norad32/win-archive-map",

  MOBILE_BREAKPOINT: 932, // keep in sync with style.css @media rule

  OUTLINE_COLOR: "#d81400", // matches --color-brand in style.css

  MAP_INITIAL_CENTER: [47.5001, 8.724],
  MAP_INITIAL_ZOOM: 13,
  MAP_MIN_ZOOM: 11,
  MAP_MAX_ZOOM: 18,
  MAP_MAX_BOUNDS: [
    [47.368449, 8.53753], // south-west
    [47.589595, 8.886116], // north-east
  ],
});
