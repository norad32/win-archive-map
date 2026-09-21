/**
 * @typedef {{
 *   repCoord: !Array<number>,
 *   entries: !Array<!Object>,
 * }} FeatureGroup
 */

/**
 * Groups entries by location id. An entry may reference several houses
 * (e.g. housenumber "43-47"), in which case it appears in one group per
 * house, one marker per house, all linking back to the same entry.
 * Entries without a loc are omitted (they are handled separately as
 * unlocated entries).
 *
 * @param {!Array<!Object>} entries archive metadata records
 * @param {!Map<string, !Array<number>>} locationsById location id -> [lon, lat]
 * @returns {!Array<!FeatureGroup>}
 */
export function groupFeatures(entries, locationsById) {
  const groups = new Map();

  for (const entry of entries) {
    const loc = entry.loc;
    if (!loc) continue;

    const locIds = Array.isArray(loc) ? loc : [loc];
    for (const locId of locIds) {
      const coord = locationsById.get(locId);
      if (!coord) continue;

      if (!groups.has(locId)) {
        groups.set(locId, { key: locId, repCoord: coord, entries: [] });
      }
      groups.get(locId).entries.push(entry);
    }
  }

  for (const group of groups.values()) {
    group.entries.sort((a, b) => {
      const ya = Number.parseInt(a.year, 10) || 0;
      const yb = Number.parseInt(b.year, 10) || 0;
      return ya - yb;
    });
  }

  return Array.from(groups.values());
}
