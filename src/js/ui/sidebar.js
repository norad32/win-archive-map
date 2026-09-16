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

  function handleDistrictsLoaded(districtsData) {
    populateDistrictOptions(domRefs.districtSelectEl, districtsData);
    populateStreetOptions(domRefs.streetOptionsEl, districtsData, "");
  }

  function handleGeoLoaded({ allFeatures, lastUpdated }) {
    updateStats(domRefs.statsEl, allFeatures.length, allFeatures.length);
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

    populateStreetOptions(
      domRefs.streetOptionsEl,
      dataStore.getDistrictsData(),
      districtVal,
    );
    domRefs.streetInputEl.value = "";

    updateNeighbourhoodOptions(
      domRefs.neighbourhoodSelectEl,
      map.boundaryLayers.getDistrictToNeighbourhoods(),
      districtVal,
    );
    map.boundaryLayers.render(
      domRefs.districtSelectEl.value,
      domRefs.neighbourhoodSelectEl.value,
    );
    filters.applyFilters();
  }

  function handleNeighbourhoodChange() {
    map.boundaryLayers.render(
      domRefs.districtSelectEl.value,
      domRefs.neighbourhoodSelectEl.value,
    );
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

    unsubscribers.push(
      dataStore.on("districts-loaded", handleDistrictsLoaded),
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
