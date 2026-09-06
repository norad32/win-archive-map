import { Config } from "./config.js";
import { initDomRefs } from "./dom/dom-refs.js";
import { createDataStore } from "./data/data-store.js";
import { createSidebar, showSidebar, updateNeighbourhoodOpts } from "./ui/sidebar.js";
import { createMap } from "./map/map.js";
import { initAboutModal } from "./ui/about-modal.js";

let map = null;
let domRefs = null;

function handleMarkerClick(group) {
  showSidebar(domRefs.detailsEl, group.entries);
  const isMobile = window.matchMedia(
    `(max-width: ${Config.MOBILE_BREAKPOINT}px)`,
  ).matches;
  if (isMobile && domRefs.sidebarEl) {
    domRefs.sidebarEl.classList.add("open");
    domRefs.sidebarToggleEl?.setAttribute("aria-expanded", "true");
  }
}

function attachGlobalListeners({ sidebar, dataStore }) {
  if (domRefs.sidebarToggleEl && domRefs.sidebarEl) {
    domRefs.sidebarToggleEl.addEventListener("click", () => {
      const isOpen = domRefs.sidebarEl.classList.toggle("open");
      domRefs.sidebarToggleEl.setAttribute("aria-expanded", String(isOpen));
      setTimeout(() => map.invalidateSize(), 300);
    });
  }

  window.addEventListener("resize", () => {
    map.invalidateSize();
  });

  window.addEventListener("beforeunload", () => {
    sidebar.filters.cancelPending();
    dataStore.abort();
  });
}

document.addEventListener("DOMContentLoaded", () => {

  domRefs = initDomRefs();
  map = createMap("map", handleMarkerClick);
  initAboutModal(); 

  const dataStore = createDataStore();

  dataStore.on("boundary-loaded", (boundaryData) => {
    map.boundaryLayers.setData(boundaryData);
    updateNeighbourhoodOpts(
      domRefs.neighbourhoodSelectEl,
      boundaryData.districtToNeighbourhoods,
      domRefs.districtSelectEl.value,
    );
    map.boundaryLayers.render(domRefs.districtSelectEl.value, domRefs.neighbourhoodSelectEl.value);
  });

  const sidebar = createSidebar({ domRefs, dataStore, map });

  dataStore.on("districts-loaded", sidebar.handleDistrictsLoaded);

  dataStore.on("geo-loaded", (payload) => {
    map.renderGroups(payload.precomputedGroups, { fitBounds: true });
    sidebar.handleGeoLoaded(payload);
  });

  dataStore.on("error", sidebar.handleError);

  sidebar.attachListeners();
  attachGlobalListeners({ sidebar, dataStore });

  dataStore.load();
});
