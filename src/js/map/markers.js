/**
 * @typedef {{
 *   repCoord: !Array<number>,
 *   entries: !Array<!Object>,
 * }} FeatureGroup
 */

export function makeClusterIcon(cluster) {
  const total = cluster
    .getAllChildMarkers()
    .reduce((sum, marker) => sum + (marker.options.entryCount || 1), 0);
  return makeCountIcon(total);
}

export function buildMarkersForGroups(groups, onMarkerClick) {
  return groups.map((group) => {
    const [lon, lat] = group.repCoord;
    const count = group.entries.length;

    const marker = L.marker([lat, lon], {
      icon: makeCountIcon(count),
      entryCount: count,
    });
    marker.on("click", () => onMarkerClick(group));
    return marker;
  });
}

function getIconSizeForCount(count) {
  if (count >= 50) return 44;
  if (count >= 20) return 38;
  if (count >= 10) return 32;
  if (count >= 5) return 28;
  if (count >= 2) return 24;
  return 20;
}

function makeCountIcon(count) {
  const size = getIconSizeForCount(count);
  return L.divIcon({
    className: "count-marker",
    html: `<div class="count-circle">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
