import { Config } from "./../config.js";
import { makeClusterIcon, buildMarkersForGroups } from "./markers.js";
import { createBoundaryLayers } from "./boundary-layers.js";

export function createMap(elId, onMarkerClick) {
  const map = createLeafletMap(elId);

  /** @type {?L.MarkerClusterGroup} */
  let geoLayer = null;

  let hasFitInitialBounds = false;

  function ensureGeoLayer() {
    if (geoLayer) return geoLayer;

    geoLayer = L.markerClusterGroup({
      iconCreateFunction: makeClusterIcon,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 40,
      chunkedLoading: true,
      chunkDelay: 50,
      chunkInterval: 200,
    });
    map.addLayer(geoLayer);

    return geoLayer;
  }

  function fitToLayerBounds() {
    const isInitialLoad = !hasFitInitialBounds;
    try {
      map.fitBounds(geoLayer.getBounds(), {
        maxZoom: isInitialLoad ? 16 : 17,
        animate: !isInitialLoad,
      });
      hasFitInitialBounds = true;
    } catch (e) {
      console.error("Bounds error:", e);
    }
  }

  function renderGroups(groups, options = {}) {
    const { fitBounds = false } = options;

    const markers = buildMarkersForGroups(groups, onMarkerClick);
    const layer = ensureGeoLayer();

    layer.clearLayers();
    layer.addLayers(markers);

    if (fitBounds && markers.length > 0) {
      fitToLayerBounds();
    }
  }

  function invalidateSize() {
    map.invalidateSize();
  }

  return {
    map,
    renderGroups,
    invalidateSize,
    boundaryLayers: createBoundaryLayers(map),
  };
}

function createLeafletMap(elId) {
  const map = L.map(elId, {
    minZoom: Config.MAP_INITIAL_ZOOM,
  }).setView(Config.MAP_INITIAL_CENTER, Config.MAP_INITIAL_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      'Tiles style by <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a> ' +
      'hosted by <a href="https://openstreetmap.fr/">OpenStreetMap France</a>',
  }).addTo(map);

  map.createPane("boundaryLabelPane");
  map.getPane("boundaryLabelPane").style.zIndex = 650;
  map.getPane("boundaryLabelPane").style.pointerEvents = "none";

  return map;
}
