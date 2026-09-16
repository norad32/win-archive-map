import { Config } from "./../config.js";
import { el } from "../dom/dom-builder.js";

const DISTRICT_STYLE = { color: Config.OUTLINE_COLOR, weight: 5, fill: false };
const NEIGHBOURHOOD_STYLE = {
  color: Config.OUTLINE_COLOR,
  weight: 3,
  fill: false,
};

const NEIGHBOURHOOD_LABEL_MIN_ZOOM = 14;

export function createBoundaryLayers(map) {
  let districtFeatures = [];
  let neighbourhoodFeatures = [];
  let districtToNeighbourhoods = new Map();

  /** @type {?{district: L.LayerGroup, neighbourhood: L.LayerGroup, neighbourhoodLabels: L.LayerGroup}} */
  let layers = null;

  let forceShowNeighbourhoodLabels = false;

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

    removeLayers();
    layers = {
      district: L.layerGroup(),
      neighbourhood: L.layerGroup(),
      neighbourhoodLabels: L.layerGroup(),
    };

    for (const feature of districtsToShow) {
      layers.district.addLayer(L.geoJSON(feature, { style: DISTRICT_STYLE }));
    }

    for (const feature of neighbourhoodsToShow) {
      layers.neighbourhood.addLayer(
        L.geoJSON(feature, { style: NEIGHBOURHOOD_STYLE }),
      );
      addLabelMarker(feature, layers.neighbourhoodLabels);
    }

    layers.district.addTo(map);
    layers.neighbourhood.addTo(map);

    forceShowNeighbourhoodLabels = Boolean(selectedNeighbourhood);
    updateNeighbourhoodLabelVisibility();
  }

  function removeLayers() {
    if (!layers) return;
    Object.values(layers).forEach((group) => map.removeLayer(group));
  }

  function updateNeighbourhoodLabelVisibility() {
    if (!layers) return;

    const shouldShow =
      forceShowNeighbourhoodLabels ||
      map.getZoom() >= NEIGHBOURHOOD_LABEL_MIN_ZOOM;

    if (shouldShow && !map.hasLayer(layers.neighbourhoodLabels)) {
      layers.neighbourhoodLabels.addTo(map);
    } else if (!shouldShow && map.hasLayer(layers.neighbourhoodLabels)) {
      map.removeLayer(layers.neighbourhoodLabels);
    }
  }

  function selectVisibleFeatures(selectedDistrict, selectedNeighbourhood) {
    if (selectedNeighbourhood) {
      const neighbourhoodsToShow = neighbourhoodFeatures.filter(
        (f) => f.properties.neighbourhood === selectedNeighbourhood,
      );
      const parentDistrict = neighbourhoodsToShow[0]?.properties.district;
      const districtsToShow = parentDistrict
        ? districtFeatures.filter(
            (f) => f.properties.district === parentDistrict,
          )
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

  function addLabelMarker(feature, labelGroup) {
    const text = buildLabelText(feature.properties ?? {});
    if (!text) return;

    const [lon, lat] = feature.properties?.center ?? [];
    const lines = text.split("\n").map((line) => el("div", {}, line));

    labelGroup.addLayer(
      L.marker([lat, lon], {
        icon: L.divIcon({
          className: "neighbourhood-label",
          html: el("div", {}, lines),
          iconSize: null,
        }),
        interactive: false,
        keyboard: false,
        pane: "boundaryLabelPane",
      }),
    );
  }

  function buildLabelText(props) {
    if (props.neighbourhood == null) return "";
    const lines = [String(props.neighbourhood)];
    if (props.number != null) lines.push(String(props.number));
    return lines.join("\n");
  }

  return { setData, getDistrictToNeighbourhoods, render };
}
