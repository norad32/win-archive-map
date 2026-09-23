import { Config } from "./../config.js";
import { populateSelect, setChildren, el } from "../dom/dom-builder.js";

/**
 * @typedef {{
 *   districts: !Map<string, !Array<string>>,
 *   neighbourhoods: !Map<string, !Array<string>>,
 * }} StreetsData
 */

export async function loadStreets(signal) {
  const res = await fetch(Config.STREETS_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return {
    districts: new Map(
      Object.entries(data.districts ?? {}).map(([district, streets]) => [
        district,
        streets,
      ]),
    ),
    neighbourhoods: new Map(
      Object.entries(data.neighbourhoods ?? {}).map(
        ([neighbourhood, streets]) => [neighbourhood, streets],
      ),
    ),
  };
}

export function populateDistrictOptions(districtSelectEl, streetsData) {
  const sorted = [...streetsData.districts.keys()].sort((a, b) =>
    a.localeCompare(b, "de", { numeric: true }),
  );

  populateSelect(districtSelectEl, sorted, { allLabel: "All", allValue: "" });
}

export function populateStreetOptions(
  streetOptionsEl,
  streetsData,
  districtVal,
  neighbourhoodVal,
) {
  let streets;
  if (neighbourhoodVal) {
    streets = streetsData.neighbourhoods.get(neighbourhoodVal) ?? [];
  } else if (districtVal) {
    streets = streetsData.districts.get(districtVal) ?? [];
  } else {
    streets = [...new Set([...streetsData.districts.values()].flat())];
  }

  const sorted = [...new Set(streets)].sort((a, b) => a.localeCompare(b, "de"));

  const options = sorted.map((s) => el("option", { value: s }));

  setChildren(streetOptionsEl, options);
}
