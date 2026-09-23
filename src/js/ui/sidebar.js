import { createFilters } from "./filter.js";
import {
  populateDistrictOptions,
  populateStreetOptions,
} from "../data/districts.js";
import { updateStats, updateLastUpdated } from "./status.js";
import { updateNeighbourhoodOptions } from "./neighbourhood-select.js";
import { showError } from "./details-panel.js";

export function createSidebar({ domRefs, dataStore, map }) {
  const filters = createFilters({
    domRefs,
    dataStore,
    map,
    onStatsUpdate: (shown, total) => updateStats(domRefs.statsEl, shown, total),
  });

  function handleStreetsLoaded(streetsData) {
    populateDistrictOptions(domRefs.districtSelectEl, streetsData);
    populateStreetOptions(domRefs.streetOptionsEl, streetsData, "", "");
  }

  function repopulateStreetOptions() {
    populateStreetOptions(
      domRefs.streetOptionsEl,
      dataStore.getStreetsData(),
      domRefs.districtSelectEl.value,
      domRefs.neighbourhoodSelectEl.value,
    );
  }

  function handleGeoLoaded({ allEntries, lastUpdated }) {
    updateStats(domRefs.statsEl, allEntries.length, allEntries.length);
    updateLastUpdated(domRefs.lastUpdatedEl, lastUpdated);
  }

  function handleError(err) {
    showError(
      domRefs.detailsEl,
      `Error loading data: ${err.message}. Please try reloading the page.`,
    );
    console.error("Data load error:", err);
  }

  function handleBoundaryPartialError(errors) {
    const detail = errors.map((e) => e.message ?? String(e)).join(" ");
    showError(
      domRefs.detailsEl,
      `Some map boundaries could not be loaded: ${detail}`,
    );
    console.warn("Boundary partial load errors:", errors);
  }

  function handleDistrictChange(e) {
    const districtVal = e.target.value;

    repopulateStreetOptions();
    domRefs.streetInputEl.value = "";

    updateNeighbourhoodOptions(
      domRefs.neighbourhoodSelectEl,
      map.boundaryLayers.getDistrictToNeighbourhoods(),
      districtVal,
    );
    repopulateStreetOptions();
    map.boundaryLayers.render(
      domRefs.districtSelectEl.value,
      domRefs.neighbourhoodSelectEl.value,
    );
    filters.applyFilters();
  }

  function handleNeighbourhoodChange() {
    repopulateStreetOptions();
    map.boundaryLayers.render(
      domRefs.districtSelectEl.value,
      domRefs.neighbourhoodSelectEl.value,
    );
    filters.applyFilters();
  }

  function handleClearFilters() {
    domRefs.titleSearchEl.value = "";
    domRefs.yearFromEl.value = "";
    domRefs.yearToEl.value = "";
    domRefs.streetInputEl.value = "";
    domRefs.districtSelectEl.value = "";
    domRefs.neighbourhoodSelectEl.value = "";

    repopulateStreetOptions();
    map.boundaryLayers.render("", "");
    filters.applyFilters();
  }

  const unsubscribers = [];

  function attachListeners() {
    domRefs.titleSearchEl.addEventListener("input", filters.applyFilters);
    domRefs.yearFromEl.addEventListener("input", filters.applyFilters);
    domRefs.yearToEl.addEventListener("input", filters.applyFilters);
    domRefs.streetInputEl.addEventListener("change", filters.applyFilters);
    domRefs.districtSelectEl.addEventListener("change", handleDistrictChange);
    domRefs.neighbourhoodSelectEl?.addEventListener(
      "change",
      handleNeighbourhoodChange,
    );
    domRefs.clearFiltersBtnEl?.addEventListener("click", handleClearFilters);

    unsubscribers.push(
      dataStore.on("districts-loaded", handleStreetsLoaded),
      dataStore.on("geo-loaded", handleGeoLoaded),
      dataStore.on("error", handleError),
      dataStore.on("boundary-partial-error", handleBoundaryPartialError),
    );
  }

  function detachListeners() {
    domRefs.titleSearchEl.removeEventListener("input", filters.applyFilters);
    domRefs.yearFromEl.removeEventListener("input", filters.applyFilters);
    domRefs.yearToEl.removeEventListener("input", filters.applyFilters);
    domRefs.streetInputEl.removeEventListener("change", filters.applyFilters);
    domRefs.districtSelectEl.removeEventListener(
      "change",
      handleDistrictChange,
    );
    domRefs.neighbourhoodSelectEl?.removeEventListener(
      "change",
      handleNeighbourhoodChange,
    );

    unsubscribers.forEach((unsub) => unsub());
    unsubscribers.length = 0;
  }

  return {
    filters,
    attachListeners,
    detachListeners,
  };
}
