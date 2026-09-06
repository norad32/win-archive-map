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

  function fitToLayerBounds(layer) {
    const isInitialLoad = !hasFitInitialBounds;
    const bounds = layer.getBounds();

    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      maxZoom: isInitialLoad ? 16 : 17,
      animate: !isInitialLoad,
    });
    hasFitInitialBounds = true;
  }

  function renderGroups(groups, { fitBounds = false } = {}) {
    const markers = buildMarkersForGroups(groups, onMarkerClick);
    const layer = ensureGeoLayer();

    layer.clearLayers();
    layer.addLayers(markers);

    if (fitBounds && markers.length > 0) {
      fitToLayerBounds(layer);
    }
  }

  return {
    map,
    renderGroups,
    invalidateSize: () => map.invalidateSize(),
    boundaryLayers: createBoundaryLayers(map),
  };
}

function createLeafletMap(elId) {
  const map = L.map(elId, {
    minZoom: Config.MAP_INITIAL_ZOOM,
  }).setView(Config.MAP_INITIAL_CENTER, Config.MAP_INITIAL_ZOOM);

  L.tileLayer(
    "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    {
      attribution:
        '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
      maxZoom: 18,
      minZoom: Config.MAP_INITIAL_ZOOM,
    },
  ).addTo(map);

  map.createPane("boundaryLabelPane");
  map.getPane("boundaryLabelPane").style.zIndex = 650;
  map.getPane("boundaryLabelPane").style.pointerEvents = "none";

  return map;
}
