import { populateSelect } from "../dom/dom-builder.js";

export function updateNeighbourhoodOptions(
  selectElement,
  districtToNeighbourhoods,
  selectedDistrict,
) {
  const previousValue = selectElement.value;

  const neighbourhoods = selectedDistrict
    ? (districtToNeighbourhoods.get(selectedDistrict) ?? [])
    : [...districtToNeighbourhoods.values()]
        .flat()
        .sort((a, b) => a.localeCompare(b));

  const selected = neighbourhoods.includes(previousValue) ? previousValue : "";
  populateSelect(selectElement, neighbourhoods, { selected });
}
