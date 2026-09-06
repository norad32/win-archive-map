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

  selectElement.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  selectElement.appendChild(allOption);

  for (const name of neighbourhoods) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    selectElement.appendChild(option);
  }

  selectElement.value = neighbourhoods.includes(previousValue)
    ? previousValue
    : "";
}
