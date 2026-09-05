import { Config } from "./config.js";

let map = null;

let districtFeatures = [];
let neighbourhoodFeatures = [];

let districtLayerGroup = null;
let neighbourhoodLayerGroup = null;
let districtLabelGroup = null;
let neighbourhoodLabelGroup = null;

let districtToNeighbourhoods = new Map();

export function initBoundaryLayers(mapInstance) {
  map = mapInstance;
}

export function getDistrictToNeighbourhoods() {
  return districtToNeighbourhoods;
}

export async function loadBoundaryLayers(signal, districtSelectEl, neighbourhoodSelectEl) {
  const [districts, neighbourhoods] = await Promise.all([
    loadBoundaryLayer(Config.DISTRICTS_GEOJSON_URL, signal),
    loadBoundaryLayer(Config.NEIGHBOURHOODS_GEOJSON_URL, signal),
  ]);

  districtFeatures = districts;
  neighbourhoodFeatures = neighbourhoods;
  districtToNeighbourhoods =
    buildDistrictToNeighbourhoodsMap(neighbourhoodFeatures);

  updateNeighbourhoodOptions(districtSelectEl);

  renderBoundaryLayers(
    districtSelectEl.value,
    neighbourhoodSelectEl.value,
  );
}

/**
 * Repopulates the neighbourhood select with only the neighbourhoods
 * belonging to the given district. If no district is selected, restores
 * the full neighbourhood list.
 * @param {string} selectedDistrict Currently selected district, or "" for all.
 * @return {void}
 */
export function updateNeighbourhoodOptions(selectElement, selectedDistrict) {
  const previousValue = selectElement.value;

  const neighbourhoods = selectedDistrict
    ? districtToNeighbourhoods.get(selectedDistrict) || []
    : [...districtToNeighbourhoods.values()]
      .flat()
      .sort((a, b) => a.localeCompare(b));

  selectElement.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  selectElement.appendChild(allOption);

  for (const name of neighbourhoods) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    selectElement.appendChild(option);
  }

  selectElement.value = neighbourhoods.includes(previousValue)
    ? previousValue
    : "";
}


/**
 * Renders district and neighbourhood boundary layers on the map,
 * filtered by the currently selected district/neighbourhood values.
 * Clears and rebuilds both layer groups each call.
 * @return {void}
 */
export function renderBoundaryLayers(  selectedDistrict = "",
  selectedNeighbourhood = "") {

  // --- Determine which features to show ---
  let districtsToShow = districtFeatures;
  let neighbourhoodsToShow = neighbourhoodFeatures;

  if (selectedNeighbourhood) {
    // Show only the selected neighbourhood (and its parent district)
    neighbourhoodsToShow = neighbourhoodFeatures.filter(
      (f) => f.properties.neighbourhood === selectedNeighbourhood
    );
    const parentDistrict = neighbourhoodsToShow[0]?.properties.district;
    districtsToShow = parentDistrict
      ? districtFeatures.filter((f) => f.properties.district === parentDistrict)
      : [];
  } else if (selectedDistrict) {
    // Show the selected district and only its neighbourhoods
    districtsToShow = districtFeatures.filter(
      (f) => f.properties.district === selectedDistrict
    );
    neighbourhoodsToShow = neighbourhoodFeatures.filter(
      (f) => f.properties.district === selectedDistrict
    );
  }

  // --- Clear existing layers ---
  if (districtLayerGroup) map.removeLayer(districtLayerGroup);
  if (neighbourhoodLayerGroup) map.removeLayer(neighbourhoodLayerGroup);
  if (districtLabelGroup) map.removeLayer(districtLabelGroup);
  if (neighbourhoodLabelGroup) map.removeLayer(neighbourhoodLabelGroup);

  districtLayerGroup = L.layerGroup();
  neighbourhoodLayerGroup = L.layerGroup();
  districtLabelGroup = L.layerGroup();
  neighbourhoodLabelGroup = L.layerGroup();

  // --- Build district polygons + labels ---
  for (const feature of districtsToShow) {
    const layer = L.geoJSON(feature, {
      style: {
        color: Config.OUTLINE_COLOR,
        weight: 2,
        fill: false,
      },
    });
    layer.addTo(districtLayerGroup);
    addBoundaryLabel(layer, feature, districtLabelGroup, "district-label");
  }

  // --- Build neighbourhood polygons + labels ---
  for (const feature of neighbourhoodsToShow) {
    const layer = L.geoJSON(feature, {
      style: {
        color: Config.OUTLINE_COLOR,
        weight: 1,
        fill: false,
      },
    });
    layer.addTo(neighbourhoodLayerGroup);
    addBoundaryLabel(layer, feature, neighbourhoodLabelGroup, "neighbourhood-label");
  }

  // --- Add to map (respecting layer control checkboxes if present) ---
  districtLayerGroup.addTo(map);
  neighbourhoodLayerGroup.addTo(map);
  districtLabelGroup.addTo(map);
  neighbourhoodLabelGroup.addTo(map);
}


async function loadBoundaryLayer(url, signal) {
  try {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.features || [];
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    console.error(`Failed to load boundary layer: ${url}`, error);
    return [];
  }
}

/**
 * Builds a map from district name to the list of neighbourhood names
 * belonging to it, derived from the neighbourhood GeoJSON features.
 * @param {!Array<!Object>} neighbourhoodFeatures GeoJSON features.
 * @return {!Map<string, !Array<string>>} District name -> neighbourhood names.
 */
function buildDistrictToNeighbourhoodsMap(neighbourhoodFeatures) {
  const map = new Map();
  for (const feature of neighbourhoodFeatures) {
    const district = feature.properties?.district;
    const neighbourhood = feature.properties?.neighbourhood;
    if (!district || !neighbourhood) continue;

    if (!map.has(district)) {
      map.set(district, []);
    }
    map.get(district).push(neighbourhood);
  }

  // Sort each list for a nicer dropdown order
  for (const list of map.values()) {
    list.sort((a, b) => a.localeCompare(b));
  }

  return map;
}



/**
 * Creates a non-interactive label marker centered on a layer's bounds,
 * added to the given label layer group.
 * @param {!L.Layer} layer Leaflet layer for a single polygon feature.
 * @param {!Object} feature GeoJSON feature.
 * @param {!L.LayerGroup} labelGroup Group to add the label marker to.
 * @param {string} labelClassName CSS class for the label's divIcon.
 * @return {void}
 */
function addBoundaryLabel(layer, feature, labelGroup, labelClassName) {
  const props = feature.properties || {};
  const text = buildBoundaryLabelText(props);
  if (!text) return;

  const center = layer.getBounds().getCenter();
  const htmlLines = text
    .split("\n")
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

  const icon = L.divIcon({
    className: labelClassName,
    html: htmlLines,
    iconSize: null, // let CSS size it based on content
  });

  const labelMarker = L.marker(center, {
    icon,
    interactive: false,
    keyboard: false,
    pane: "boundaryLabelPane",
  });
  labelGroup.addLayer(labelMarker);
}


/**
 * Builds the label content (plain text, multi-line) for a boundary
 * feature, based on which property keys are present.
 * @param {!Object} props Feature properties.
 * @return {string} Label text, possibly multi-line.
 */
function buildBoundaryLabelText(props) {
  if (props.neighbourhood == null) {
    return String(props.district);
  }

  if (props.neighbourhood != null) {
    const lines = [String(props.neighbourhood)];
    if (props.number != null) lines.push(String(props.number));
    return lines.join("\n");
  }
}

/**
 * Escapes a value for safe interpolation into HTML markup.
 * @param {*} value Value to escape. `null`/`undefined` become `''`.
 * @return {string} HTML-escaped string.
 */
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
