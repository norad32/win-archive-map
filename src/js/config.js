export const Config = Object.freeze({
  GEOJSON_URL: "data/archive.geojson",
  DISTRICTS_URL: "data/districts.json",
  DISTRICTS_GEOJSON_URL: "data/districts.geojson",
  NEIGHBOURHOODS_GEOJSON_URL: "data/neighbourhoods.geojson",
  GLOSSARY_URL: "data/glossary.json",

  GITHUB_REPO: "norad32/win-archive-map",

  MOBILE_BREAKPOINT: 768, // keep in sync with style.css @media rule

  OUTLINE_COLOR: "#d81400", // matches --color-brand in style.css

  MAP_INITIAL_CENTER: [47.5001, 8.724],
  MAP_INITIAL_ZOOM: 13,
  MAP_MIN_ZOOM: 11,
  MAP_MAX_BOUNDS: [
    [47.42, 8.64], // south-west
    [47.59, 8.89], // north-east
  ],
});
