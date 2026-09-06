import { Config } from "../config.js";

export async function loadBoundaryData(signal) {
  const [districtFeatures, neighbourhoodFeatures] = await Promise.all([
    fetchBoundaryFeatures(Config.DISTRICTS_GEOJSON_URL, signal),
    fetchBoundaryFeatures(Config.NEIGHBOURHOODS_GEOJSON_URL, signal),
  ]);

  return {
    districtFeatures,
    neighbourhoodFeatures,
    districtToNeighbourhoods: buildDistrictToNeighbourhoodsMap(
      neighbourhoodFeatures,
    ),
  };
}

async function fetchBoundaryFeatures(url, signal) {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.features ?? [];
  } catch (error) {
    if (error.name === "AbortError") throw error;

    console.error(`Failed to load boundary layer: ${url}`, error);
    return [];
  }
}

function buildDistrictToNeighbourhoodsMap(neighbourhoodFeatures) {
  const districtMap = new Map();

  for (const feature of neighbourhoodFeatures) {
    const { district, neighbourhood } = feature.properties ?? {};
    if (!district || !neighbourhood) continue;

    if (!districtMap.has(district)) districtMap.set(district, []);
    districtMap.get(district).push(neighbourhood);
  }

  for (const list of districtMap.values()) {
    list.sort((a, b) => a.localeCompare(b));
  }

  return districtMap;
}
