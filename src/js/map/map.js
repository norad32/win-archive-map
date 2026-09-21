import { Config } from "./../config.js";
import { el } from "./../dom/dom-builder.js";
import { makeClusterIcon, buildMarkersForGroups } from "./markers.js";
import { createBoundaryLayers } from "./boundary-layers.js";

export function createMap(elId, onMarkerClick) {
  const map = createLeafletMap(elId);

  /** @type {?L.MarkerClusterGroup} */
  let geoLayer = null;
  let hasFitInitialBounds = false;
  let selectedGroupKey = null;

  map.on("contextmenu", (event) => {
    event.originalEvent?.preventDefault?.();
    openCoordinatesPopup(map, event.latlng);
  });

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

  function fitToLayerBounds(layer, { force = false } = {}) {
    const isInitialLoad = !hasFitInitialBounds;
    const bounds = layer.getBounds();

    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      maxZoom: Config.MAP_MAX_ZOOM,
      animate: !isInitialLoad && !force,
    });
    hasFitInitialBounds = true;
  }

  function renderGroups(groups, { selectedKey } = {}) {
    if (selectedKey !== undefined) {
      selectedGroupKey = selectedKey;
    }
    const markers = buildMarkersForGroups(
      groups,
      onMarkerClick,
      map,
      selectedGroupKey,
    );
    const layer = ensureGeoLayer();

    layer.clearLayers();
    layer.addLayers(markers);

    updateFitResultsButton(markers.length > 0);
  }

  function updateFitResultsButton(hasResults) {
    const button = document.getElementById("fitResultsBtn");
    if (button) {
      button.hidden = !hasResults;
    }
  }

  function fitToResults() {
    if (geoLayer) {
      fitToLayerBounds(geoLayer, { force: true });
    }
  }

  return {
    map,
    renderGroups,
    fitToResults,
    setSelected: (key) => {
      selectedGroupKey = key;
    },
    invalidateSize: () => map.invalidateSize(),
    boundaryLayers: createBoundaryLayers(map),
  };
}

function openCoordinatesPopup(map, latlng) {
  const text = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
  const button = el(
    "button",
    {
      className: "coord-popup-copy",
      type: "button",
      onClick: async () => {
        const copied = await copyText(text);
        button.textContent = copied ? "Copied!" : "Copy failed";
        button.disabled = true;
        setTimeout(() => {
          button.textContent = "Copy";
          button.disabled = false;
        }, 1500);
      },
    },
    "Copy",
  );

  L.popup({ className: "coord-popup", closeButton: false, autoPan: false })
    .setLatLng(latlng)
    .setContent(
      el("div", { className: "coord-popup-body" }, [
        el("code", { className: "coord-popup-text" }, text),
        button,
      ]),
    )
    .openOn(map);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = el("textarea", { value: text });
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }
}

function swisstopoWmts(
  layerId,
  {
    format = "jpeg",
    timestamp = "current",
    maxZoom = Config.MAP_MAX_ZOOM,
    maxNativeZoom = Config.MAP_MAX_NATIVE_ZOOM,
  } = {},
) {
  return L.tileLayer(
    `https://wmts.geo.admin.ch/1.0.0/${layerId}/default/${timestamp}/3857/{z}/{x}/{y}.${format}`,
    {
      attribution:
        '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
      maxZoom,
      maxNativeZoom,
      minZoom: Config.MAP_MIN_ZOOM,
    },
  );
}

function swisstopoZeitreihen(year) {
  return swisstopoWmts("ch.swisstopo.zeitreihen", {
    format: "png",
    timestamp: `${year}1231`,
  });
}

function createLeafletMap(elId) {
  const map = L.map(elId, {
    minZoom: Config.MAP_MIN_ZOOM,
    maxBounds: Config.MAP_MAX_BOUNDS,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
  }).setView(Config.MAP_INITIAL_CENTER, Config.MAP_INITIAL_ZOOM);

  let selectedMapAttribution = "";

  const digitalMapCurrent = swisstopoWmts("ch.swisstopo.pixelkarte-farbe");
  const aerialImageCurrent = swisstopoWmts("ch.swisstopo.swissimage");

  const digitalMap2020 = swisstopoZeitreihen(2020);
  const digitalMap2010 = swisstopoZeitreihen(2010);
  const digitalMap2000 = swisstopoZeitreihen(2000);
  const digitalMap1990 = swisstopoZeitreihen(1990);
  const digitalMap1970 = swisstopoZeitreihen(1970);
  const digitalMap1945 = swisstopoZeitreihen(1945);
  const digitalMap1921 = swisstopoZeitreihen(1921);
  const digitalMap1896 = swisstopoZeitreihen(1896);
  const digitalMap1881 = swisstopoZeitreihen(1881);
  const digitalMap1850 = swisstopoZeitreihen(1850);

  const aerialImage2011 = swisstopoWmts("ch.swisstopo.swissimage-product", {
    timestamp: "2011",
  });
  const aerialImage2000 = swisstopoWmts("ch.swisstopo.swissimage-product", {
    timestamp: "2000",
  });
  const aerialImage1990 = swisstopoWmts("ch.swisstopo.swissimage-product", {
    timestamp: "1990",
  });
  const aerialImage1970 = swisstopoWmts("ch.swisstopo.swissimage-product", {
    timestamp: "1970",
  });
  const aerialImage1945 = swisstopoWmts("ch.swisstopo.swissimage-product", {
    timestamp: "1945",
  });
  const aerialImage1931 = swisstopoWmts("ch.swisstopo.swissimage-product", {
    timestamp: "1931",
  });

  const layerMap = {
    digitalMapCurrent,
    digitalMap2020,
    digitalMap2010,
    digitalMap2000,
    digitalMap1990,
    digitalMap1970,
    digitalMap1945,
    digitalMap1921,
    digitalMap1896,
    digitalMap1881,
    digitalMap1850,
    aerialImageCurrent,
    aerialImage2011,
    aerialImage2000,
    aerialImage1990,
    aerialImage1970,
    aerialImage1945,
    aerialImage1931,
  };

  const CURRENT_YEAR = new Date().getFullYear();

  // Years in ascending order; "current" slot maps to the actual current year
  const digitalMapYears = [
    1850,
    1881,
    1896,
    1921,
    1945,
    1970,
    1990,
    2000,
    2010,
    2020,
    CURRENT_YEAR,
  ];
  const aerialImageYears = [1931, 1945, 1970, 1990, 2000, 2011, CURRENT_YEAR];

  const digitalMapLayerKeys = [
    "digitalMap1850",
    "digitalMap1881",
    "digitalMap1896",
    "digitalMap1921",
    "digitalMap1945",
    "digitalMap1970",
    "digitalMap1990",
    "digitalMap2000",
    "digitalMap2010",
    "digitalMap2020",
    "digitalMapCurrent",
  ];

  const aerialImageLayerKeys = [
    "aerialImage1931",
    "aerialImage1945",
    "aerialImage1970",
    "aerialImage1990",
    "aerialImage2000",
    "aerialImage2011",
    "aerialImageCurrent",
  ];

  let currentMode = "digitalMap";
  let currentLayer = digitalMapCurrent;

  const yearSlider = document.getElementById("yearSlider");
  const yearRangeLabels = document.getElementById("yearRangeLabels");

  function getYearsForMode(mode) {
    return mode === "digitalMap" ? digitalMapYears : aerialImageYears;
  }

  function getLayerKeysForMode(mode) {
    return mode === "digitalMap" ? digitalMapLayerKeys : aerialImageLayerKeys;
  }

  function formatYearLabel(year) {
    return year === CURRENT_YEAR ? "Today" : year;
  }

  function setupSliderForMode(mode) {
    const years = getYearsForMode(mode);
    yearSlider.min = 0;
    yearSlider.max = years.length - 1;
    yearSlider.step = 1;
    yearSlider.value = years.length - 1;

    yearRangeLabels.replaceChildren();
    years.forEach((year, i) => {
      const span = document.createElement("span");
      span.textContent = formatYearLabel(year);
      span.className = "year-tick-label";
      if (years.length > 7 && i % 2 !== 0 && i !== years.length - 1) {
        span.classList.add("year-tick-hidden");
      }
      yearRangeLabels.appendChild(span);
    });
  }

  function updateLayer() {
    const layerKeys = getLayerKeysForMode(currentMode);
    const index = Number(yearSlider.value);
    const layerKey = layerKeys[index];

    if (currentLayer) map.removeLayer(currentLayer);
    currentLayer = layerMap[layerKey];
    map.addLayer(currentLayer);

    updateMapAttribution();
  }

  function updateMapAttribution() {
    const years = getYearsForMode(currentMode);
    const year = years[Number(yearSlider.value)];

    const type = currentMode === "digitalMap" ? "digital map" : "aerial image";

    const label = year === CURRENT_YEAR ? "current" : year;

    if (selectedMapAttribution) {
      map.attributionControl.removeAttribution(selectedMapAttribution);
    }

    selectedMapAttribution = `${type} ${label}`;
    map.attributionControl.addAttribution(selectedMapAttribution);
  }

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
      setupSliderForMode(currentMode);
      updateLayer();
    });
  });

  yearSlider.addEventListener("input", updateLayer);

  setupSliderForMode(currentMode);
  updateLayer();

  map.createPane("boundaryLabelPane");
  map.getPane("boundaryLabelPane").style.zIndex = 650;
  map.getPane("boundaryLabelPane").style.pointerEvents = "none";

  window.__map = map;

  return map;
}
