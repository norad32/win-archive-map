/**
 * @typedef {{
 *   key: ?string,
 *   repCoord: !Array<number>,
 *   entries: !Array<!Object>,
 * }} FeatureGroup
 */

import { Config } from "../config.js";

let selectedMarker = null;

export function makeClusterIcon(cluster) {
  const total = cluster
    .getAllChildMarkers()
    .reduce((sum, marker) => sum + (marker.options.entryCount || 1), 0);
  const icon = makePinIcon(total);
  icon.options.html = icon.options.html.replace(
    "</svg>",
    `<title>${total} entries</title></svg>`,
  );
  return icon;
}

export function buildMarkersForGroups(
  groups,
  onMarkerClick,
  map,
  selectedKey = null,
) {
  selectedMarker = null;

  return groups.map((group) => {
    const [lon, lat] = group.repCoord;
    const count = group.entries.length;
    const isSelected = selectedKey != null && group.key === selectedKey;

    const marker = L.marker([lat, lon], {
      icon: makePinIcon(count, { selected: isSelected }),
      entryCount: count,
      title: `${count} entries`,
      zIndexOffset: isSelected ? 1000 : 0,
    });
    if (isSelected) selectedMarker = marker;

    marker.on("click", () => {
      selectMarker(marker);
      onMarkerClick(group);

      if (map) {
        const targetZoom = Math.min(
          Math.max(map.getZoom() + 2, 15),
          Config.MAP_MAX_ZOOM,
        );
        map.flyTo([lat, lon], targetZoom, {
          animate: true,
          duration: 0.5,
        });
      }
    });

    return marker;
  });
}

function selectMarker(marker) {
  if (selectedMarker === marker) return;
  if (selectedMarker) {
    selectedMarker.setIcon(makePinIcon(selectedMarker.options.entryCount));
    selectedMarker.setZIndexOffset(0);
  }
  marker.setIcon(makePinIcon(marker.options.entryCount, { selected: true }));
  marker.setZIndexOffset(1000);
  selectedMarker = marker;
}

function sizeForCount(count) {
  const clamped = Math.min(Math.max(count, 1), Config.PIN_MAX_COUNT);
  const ratio = Math.log10(clamped) / Math.log10(Config.PIN_MAX_COUNT);
  return Math.round(
    Config.PIN_MIN_SIZE + (Config.PIN_MAX_SIZE - Config.PIN_MIN_SIZE) * ratio,
  );
}

const PIN_TAIL = '<path class="pin-tail" d="M24 44 L40 44 L32 59 Z"/>';
const PIN_HEAD = '<circle class="pin-head" cx="32" cy="30" r="20"/>';
const PIN_HOLE = '<circle class="pin-hole" cx="32" cy="30" r="9"/>';
// "Geoleo" (the starburst) lion, drawn on the selected marker.
const GEOLEO =
  '<path class="pin-lion" d="M51 30 L46 33.8 L48.5 39.5 L42.3 40.3 L41.5 46.5 L35.8 44 L32 49 L28.3 44 L22.5 46.5 L21.8 40.3 L15.6 39.5 L18 33.8 L13 30 L18 26.3 L15.6 20.5 L21.8 19.8 L22.5 13.6 L28.3 16 L32 11 L35.8 16 L41.5 13.6 L42.3 19.8 L48.5 20.5 L46 26.3 Z"/>' +
  '<circle class="pin-lion" cx="32" cy="30" r="11"/>' +
  '<circle class="pin-eye" cx="27.5" cy="26.5" r="1.6"/>' +
  '<circle class="pin-eye" cx="36.5" cy="26.5" r="1.6"/>' +
  '<path class="pin-eye" d="M29.3 31.3 L34.7 31.3 L32 34.6 Z"/>' +
  '<path class="pin-whiskers" d="M32 34.6 V36.6 M32 36.6 Q29.5 39.2 26.8 37.4 M32 36.6 Q34.5 39.2 37.2 37.4"/>';

export function makePinIcon(count, { selected = false } = {}) {
  const size = selected ? Config.LION_PIN_SIZE : sizeForCount(count);
  const body = selected
    ? PIN_TAIL + PIN_HEAD + GEOLEO
    : PIN_TAIL + PIN_HEAD + PIN_HOLE;

  return L.divIcon({
    className: selected ? "pin-marker pin-marker--selected" : "pin-marker",
    html: `<svg viewBox="0 0 64 64">${body}</svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, Math.round(size * (59 / 64))],
  });
}
