export function getRequiredElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element #${id} not found in the DOM.`);
  }
  return el;
}

export function initDomRefs() {
  return {
    detailsEl: getRequiredElement("details"),
    statsEl: getRequiredElement("stats"),
    titleSearchEl: getRequiredElement("titleSearch"),
    yearFromEl: getRequiredElement("yearFrom"),
    yearToEl: getRequiredElement("yearTo"),
    streetInputEl: getRequiredElement("streetInput"),
    districtSelectEl: getRequiredElement("districtSelect"),
    neighbourhoodSelectEl: getRequiredElement("neighbourhoodSelect"),
    streetOptionsEl: getRequiredElement("streetOptions"),
    lastUpdatedEl: document.getElementById("lastUpdated"),
    sidebarToggleEl: document.getElementById("sidebarToggle"),
    sidebarEl: document.getElementById("sidebar"),
  };
}
