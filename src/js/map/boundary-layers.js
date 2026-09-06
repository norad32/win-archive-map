import { Config } from "./../config.js";
import { el } from "../dom/dom-builder.js";

const DISTRICT_STYLE = { color: Config.OUTLINE_COLOR, weight: 2, fill: false };
const NEIGHBOURHOOD_STYLE = {
  color: Config.OUTLINE_COLOR,
  weight: 1,
  fill: false,
};

let districtFeatures = [];
let neighbourhoodFeatures = [];

export function createBoundaryLayers(map) {
  let districtToNeighbourhoods = new Map();

  /** @type {?{district: L.LayerGroup, neighbourhood: L.LayerGroup, districtLabels: L.LayerGroup, neighbourhoodLabels: L.LayerGroup}} */
  let layers = null;

  function setData(data) {
    ({ districtFeatures, neighbourhoodFeatures, districtToNeighbourhoods } =
      data);
  }

  function getDistrictToNeighbourhoods() {
    return districtToNeighbourhoods;
  }

  function render(selectedDistrict = "", selectedNeighbourhood = "") {
    const { districtsToShow, neighbourhoodsToShow } = selectVisibleFeatures(
      selectedDistrict,
      selectedNeighbourhood,
    );

    clearLayers();
    layers = createLayers();

    for (const feature of districtsToShow) {
      addBoundaryFeature(
        feature,
        layers.district,
        layers.districtLabels,
        "district-label",
        DISTRICT_STYLE,
      );
    }

    for (const feature of neighbourhoodsToShow) {
      addBoundaryFeature(
        feature,
        layers.neighbourhood,
        layers.neighbourhoodLabels,
        "neighbourhood-label",
        NEIGHBOURHOOD_STYLE,
      );
    }

    Object.values(layers).forEach((group) => group.addTo(map));
  }

  function clearLayers() {
    if (!layers) return;
    Object.values(layers).forEach((group) => map.removeLayer(group));
  }

  return { setData, getDistrictToNeighbourhoods, render };
}

function selectVisibleFeatures(selectedDistrict, selectedNeighbourhood) {
  if (selectedNeighbourhood) {
    const neighbourhoodsToShow = neighbourhoodFeatures.filter(
      (f) => f.properties.neighbourhood === selectedNeighbourhood,
    );
    const parentDistrict = neighbourhoodsToShow[0]?.properties.district;
    const districtsToShow = parentDistrict
      ? districtFeatures.filter((f) => f.properties.district === parentDistrict)
      : [];

    return { districtsToShow, neighbourhoodsToShow };
  }

  if (selectedDistrict) {
    return {
      districtsToShow: districtFeatures.filter(
        (f) => f.properties.district === selectedDistrict,
      ),
      neighbourhoodsToShow: neighbourhoodFeatures.filter(
        (f) => f.properties.district === selectedDistrict,
      ),
    };
  }

  return {
    districtsToShow: districtFeatures,
    neighbourhoodsToShow: neighbourhoodFeatures,
  };
}

function createLayers() {
  return {
    district: L.layerGroup(),
    neighbourhood: L.layerGroup(),
    districtLabels: L.layerGroup(),
    neighbourhoodLabels: L.layerGroup(),
  };
}

function addBoundaryFeature(
  feature,
  layerGroup,
  labelGroup,
  labelClassName,
  style,
) {
  const layer = L.geoJSON(feature, { style });
  layer.addTo(layerGroup);
  addBoundaryLabel(feature, labelGroup, labelClassName);
}

function addBoundaryLabel(feature, labelGroup, labelClassName) {
  const text = buildBoundaryLabelText(feature.properties ?? {});
  if (!text) return;

  const center = feature.properties?.center;

  const [lon, lat] = center;
  const lines = text.split("\n").map((line) => el("div", {}, line));

  const labelMarker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: labelClassName,
      html: el("div", {}, lines),
      iconSize: null,
    }),
    interactive: false,
    keyboard: false,
    pane: "boundaryLabelPane",
  });

  labelGroup.addLayer(labelMarker);
}

function buildBoundaryLabelText(props) {
  if (props.neighbourhood == null) return String(props.district ?? "");

  const lines = [String(props.neighbourhood)];
  if (props.number != null) lines.push(String(props.number));
  return lines.join("\n");
}
