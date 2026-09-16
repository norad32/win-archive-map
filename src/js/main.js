import { Config } from "./config.js";
import { initDomRefs } from "./dom/dom-refs.js";
import { createDataStore } from "./data/data-store.js";
import { createSidebar } from "./ui/sidebar.js";
import { updateNeighbourhoodOptions } from "./ui/neighbourhood-select.js";
import { showDetails } from "./ui/details-panel.js";
import { createMap } from "./map/map.js";
import { initAboutModal } from "./ui/about-modal.js";
import { showError } from "./ui/details-panel.js";

function isMobileViewport() {
  return window.matchMedia(`(max-width: ${Config.MOBILE_BREAKPOINT}px)`)
    .matches;
}

function init() {
  const domRefs = initDomRefs();
  const dataStore = createDataStore();
  const map = createMap("map", handleMarkerClick);
  initAboutModal();

  function closeSidebar() {
    domRefs.sidebarEl.classList.remove("open");
    domRefs.sidebarToggleEl?.setAttribute("aria-expanded", "false");
  }

  function handleMarkerClick(group) {
    showDetails(domRefs.detailsEl, group.entries);
    if (isMobileViewport() && domRefs.sidebarEl) {
      domRefs.sidebarEl.classList.add("open");
      domRefs.sidebarToggleEl?.setAttribute("aria-expanded", "true");
    }
  }

  function handleOutsideClick(event) {
    if (!isMobileViewport()) return;
    if (!domRefs.sidebarEl.classList.contains("open")) return;
    if (!(event.target instanceof Element)) return;

    const clickedInsideSidebar = domRefs.sidebarEl.contains(event.target);
    const clickedToggle = domRefs.sidebarToggleEl?.contains(event.target);
    const clickedMarker = event.target.closest(".leaflet-marker-icon");

    if (!clickedInsideSidebar && !clickedToggle && !clickedMarker) {
      closeSidebar();
    }
  }

  function handleSidebarToggle() {
    const isOpen = domRefs.sidebarEl.classList.toggle("open");
    domRefs.sidebarToggleEl.setAttribute("aria-expanded", String(isOpen));
    setTimeout(() => map.invalidateSize(), 300);
  }

  function handleUnexpectedError(err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    showError(domRefs.detailsEl, `Something went wrong: ${message}`);
    console.error("Unhandled error:", err);
  }

  function handleUnhandledRejection(event) {
    const reason = event.reason;
    if (reason?.name === "AbortError") return;
    handleUnexpectedError(reason);
  }

  function attachGlobalListeners(sidebar) {
    if (domRefs.sidebarToggleEl && domRefs.sidebarEl) {
      domRefs.sidebarToggleEl.addEventListener("click", handleSidebarToggle);
    }

    window.addEventListener("error", (event) => {
      handleUnexpectedError(event.error ?? event.message);
    });
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    window.addEventListener("resize", () => {
      map.invalidateSize();
    });

    window.addEventListener("beforeunload", () => {
      sidebar.filters.cancelPending();
      dataStore.abort();
    });
  }

  dataStore.on("boundary-loaded", (boundaryData) => {
    map.boundaryLayers.setData(boundaryData);
    updateNeighbourhoodOptions(
      domRefs.neighbourhoodSelectEl,
      boundaryData.districtToNeighbourhoods,
      domRefs.districtSelectEl.value,
    );
    map.boundaryLayers.render(
      domRefs.districtSelectEl.value,
      domRefs.neighbourhoodSelectEl.value,
    );
  });

  dataStore.on("geo-loaded", ({ precomputedGroups }) => {
    map.renderGroups(precomputedGroups, { fitBounds: true });
  });

  const sidebar = createSidebar({ domRefs, dataStore, map });

  sidebar.attachListeners();
  attachGlobalListeners(sidebar);
  document.addEventListener("click", handleOutsideClick, true);

  dataStore.load();
}

init();
