import { Config } from "./../config.js";
import { buildBoundaryLabelText } from "./boundary-label-text.js";
import { el } from "../dom/dom-builder.js";

export function createBoundaryLayers(map) {
    let districtFeatures = [];
    let neighbourhoodFeatures = [];
    let districtToNeighbourhoods = new Map();

    let districtLayerGroup = null;
    let neighbourhoodLayerGroup = null;
    let districtLabelGroup = null;
    let neighbourhoodLabelGroup = null;

    function setData(data) {
        districtFeatures = data.districtFeatures;
        neighbourhoodFeatures = data.neighbourhoodFeatures;
        districtToNeighbourhoods = data.districtToNeighbourhoods;
    }

    function getDistrictToNeighbourhoods() {
        return districtToNeighbourhoods;
    }

    function render(selectedDistrict = "", selectedNeighbourhood = "") {
        const { districtsToShow, neighbourhoodsToShow } = selectVisibleFeatures(
            selectedDistrict,
            selectedNeighbourhood,
        );

        clearLayerGroups();
        createLayerGroups();

        for (const feature of districtsToShow) {
            addBoundaryFeature(feature, districtLayerGroup, districtLabelGroup, "district-label", {
                color: Config.OUTLINE_COLOR,
                weight: 2,
                fill: false,
            });
        }

        for (const feature of neighbourhoodsToShow) {
            addBoundaryFeature(feature, neighbourhoodLayerGroup, neighbourhoodLabelGroup, "neighbourhood-label", {
                color: Config.OUTLINE_COLOR,
                weight: 1,
                fill: false,
            });
        }

        districtLayerGroup.addTo(map);
        neighbourhoodLayerGroup.addTo(map);
        districtLabelGroup.addTo(map);
        neighbourhoodLabelGroup.addTo(map);
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
                districtsToShow: districtFeatures.filter((f) => f.properties.district === selectedDistrict),
                neighbourhoodsToShow: neighbourhoodFeatures.filter((f) => f.properties.district === selectedDistrict),
            };
        }

        return { districtsToShow: districtFeatures, neighbourhoodsToShow: neighbourhoodFeatures };
    }

    function clearLayerGroups() {
        if (districtLayerGroup) map.removeLayer(districtLayerGroup);
        if (neighbourhoodLayerGroup) map.removeLayer(neighbourhoodLayerGroup);
        if (districtLabelGroup) map.removeLayer(districtLabelGroup);
        if (neighbourhoodLabelGroup) map.removeLayer(neighbourhoodLabelGroup);
    }

    function createLayerGroups() {
        districtLayerGroup = L.layerGroup();
        neighbourhoodLayerGroup = L.layerGroup();
        districtLabelGroup = L.layerGroup();
        neighbourhoodLabelGroup = L.layerGroup();
    }

    function addBoundaryFeature(feature, layerGroup, labelGroup, labelClassName, style) {
        const layer = L.geoJSON(feature, { style });
        layer.addTo(layerGroup);
        addBoundaryLabel(layer, feature, labelGroup, labelClassName);
    }

    function addBoundaryLabel(layer, feature, labelGroup, labelClassName) {
        const text = buildBoundaryLabelText(feature.properties ?? {});
        if (!text) return;

        const center = layer.getBounds().getCenter();
        const lines = text.split("\n").map((line) => el("div", {}, line));

        const labelMarker = L.marker(center, {
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

    return { setData, getDistrictToNeighbourhoods, render };
}
