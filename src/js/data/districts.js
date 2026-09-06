import { Config } from "./../config.js";
import { populateSelect, setChildren, el } from "../dom/dom-builder.js";

export async function loadDistricts(signal) {
  const res = await fetch(Config.DISTRICTS_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return data ?? {};
}

export function populateDistrictOptions(districtSelectEl, districtsData) {
  const sorted = Object.keys(districtsData)
    .filter((k) => k !== "")
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true }));

  populateSelect(districtSelectEl, sorted, { allLabel: "All", allValue: "" });
}

export function populateStreetOptions(
  streetOptionsEl,
  districtsData,
  districtVal,
) {
  const streets =
    districtVal === ""
      ? Object.values(districtsData).flat()
      : (districtsData[districtVal] ?? []);

  const sorted = [...new Set(streets)].sort((a, b) => a.localeCompare(b, "de"));

  const options = sorted.map((s) => el("option", { value: s }));

  setChildren(streetOptionsEl, options);
}
