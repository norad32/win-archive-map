export function groupFeatures(features) {
  const groups = new Map();

  for (const f of features) {
    if (!f.geometry) continue;

    const repCoord = f.geometry.coordinates;
    const [lon, lat] = repCoord;
    const key = `${lon.toFixed(6)},${lat.toFixed(6)}`;

    if (!groups.has(key)) {
      groups.set(key, { repCoord, entries: [] });
    }

    groups.get(key).entries.push(f.properties ?? {});
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
