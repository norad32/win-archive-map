import { Config } from "./../config.js";

const DISTRICT_STYLE = { color: Config.OUTLINE_COLOR, weight: 5, fill: false };
const NEIGHBOURHOOD_STYLE = {
  color: Config.OUTLINE_COLOR,
  weight: 3,
  fill: false,
};

export function createBoundaryLayers(map) {
  let districtFeatures = [];
  let neighbourhoodFeatures = [];
  let districtToNeighbourhoods = new Map();

  /** @type {?{district: L.LayerGroup, neighbourhood: L.LayerGroup}} */
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

    removeLayers();
    layers = {
      district: L.layerGroup(),
      neighbourhood: L.layerGroup(),
    };

    for (const feature of districtsToShow) {
      layers.district.addLayer(L.geoJSON(feature, { style: DISTRICT_STYLE }));
    }

    for (const feature of neighbourhoodsToShow) {
      layers.neighbourhood.addLayer(
        L.geoJSON(feature, { style: NEIGHBOURHOOD_STYLE }),
      );
    }

    layers.district.addTo(map);
    layers.neighbourhood.addTo(map);
  }

  function removeLayers() {
    if (!layers) return;
    Object.values(layers).forEach((group) => map.removeLayer(group));
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

  return { setData, getDistrictToNeighbourhoods, render };
}
