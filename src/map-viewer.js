// ===========================================================
// CONFIG / CONSTANTS
// ===========================================================
const GEOJSON_URL = "data/archive.geojson";
const DISTRICTS_URL = "data/districts.json";
const MOBILE_BREAKPOINT = 768; // keep in sync with style.css @media rule

const MARKER_COLOR = "#d81400"; // matches --color-brand in style.css
const MARKER_STROKE = "#ececea"; // matches --color-surface in style.css

const MAP_INITIAL_CENTER = [47.5001, 8.724];
const MAP_INITIAL_ZOOM = 14;

/**
 * Toggle for verbose logging.
 */
const DEBUG = false;

/**
 * Debug-gated logger.
 * @param {...*} args Values to log, forwarded to `console.log`.
 * @return {void}
 */
function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

/**
 * Debug-gated timer start. Pairs with {@link debugTimeEnd}.
 * @param {string} label Timer label.
 * @return {void}
 */
function debugTime(label) {
  if (DEBUG) console.time(label);
}

/**
 * Debug-gated timer end. Pairs with {@link debugTime}.
 * @param {string} label Timer label.
 * @return {void}
 */
function debugTimeEnd(label) {
  if (DEBUG) console.timeEnd(label);
}

// ===========================================================
// TRUSTED TYPES POLICY
// ===========================================================

/**
 * Trusted Types policy used for all dynamic HTML we assign via
 * `innerHTML`. IMPORTANT: `createHTML` here is a **passthrough with no
 * sanitization** — it exists only to satisfy a CSP `require-trusted-types`
 * directive. Safety depends entirely on every interpolated value having
 * already been sanitized with {@link escapeHtml} (or being a trusted,
 * hardcoded string) *before* it reaches {@link setInnerHtml}. Do not feed
 * raw user/data input into `setInnerHtml` without escaping it first.
 * @type {?TrustedTypePolicy}
 */
let htmlPolicy = null;

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  htmlPolicy = window.trustedTypes.createPolicy("app-html", {
    createHTML: (input) => input,
  });
}

/**
 * Wraps a string in a TrustedHTML object via the app's Trusted Types
 * policy, if available. See the security note on {@link htmlPolicy}.
 * @param {string} htmlString Pre-escaped HTML markup.
 * @return {TrustedHTML|string} TrustedHTML if Trusted Types is supported,
 *     otherwise the original string.
 */
function toTrustedHtml(htmlString) {
  return htmlPolicy ? htmlPolicy.createHTML(htmlString) : htmlString;
}

/**
 * Safely assigns `innerHTML`, routing through the Trusted Types policy.
 * Caller is responsible for ensuring `htmlString` contains no unescaped
 * user-controlled data (see {@link escapeHtml}).
 * @param {Element} el Target element.
 * @param {string} htmlString Pre-escaped HTML markup.
 * @return {void}
 */
function setInnerHtml(el, htmlString) {
  el.innerHTML = toTrustedHtml(htmlString);
}

// ===========================================================
// STATE
// ===========================================================
let dataLoaded = false;
let loadInProgress = false;
let allFeatures = [];

let precomputedGroups = [];

let geoLayer = null; // persistent L.markerClusterGroup instance, created lazily
let filterTimeout;
let hasFitInitialBounds = false; // only auto-fit bounds once, on first load

let districtsData = {};
let loadAbortController = null;

/** @type {?L.Map} Leaflet map instance, created in {@link initMap}. */
let map = null;

// DOM refs populated once in initDomRefs() on DOMContentLoaded, then reused
// on every subsequent access instead of re-querying the DOM each time.
let sidebarEl = null;
let sidebarToggleEl = null;
let detailsEl = null;
let statsEl = null;
let titleSearchEl = null;
let yearFromEl = null;
let yearToEl = null;
let strasseInputEl = null;
let stadtkreisSelectEl = null;
let strasseOptionsEl = null;

// ===========================================================
// UTIL: safe HTML escaping
// ===========================================================

/**
 * Escapes a value for safe interpolation into HTML markup.
 * @param {*} value Value to escape. `null`/`undefined` become `''`.
 * @return {string} HTML-escaped string.
 */
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

/**
 * @return {boolean} Whether the viewport currently matches the mobile
 *     breakpoint defined in {@link MOBILE_BREAKPOINT}.
 */
function isMobileViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

/**
 * Looks up a required DOM element by id.
 * @param {string} id Element id (without `#`).
 * @return {!Element} The matched element.
 * @throws {Error} If no element with the given id exists.
 */
function getRequiredElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element #${id} not found in the DOM.`);
  }
  return el;
}

// ===========================================================
// LINK BUILDER
// ===========================================================

/**
 * Extracts the first run of digits from a house-number string, e.g.
 * `"12a-14"` -> `"12"`.
 * @param {?string} hausnr Raw house-number value.
 * @return {string} The first digit sequence found, or `''`.
 */
function extractFirstHouseNumber(hausnr) {
  if (!hausnr) return "";
  const match = String(hausnr).match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Extracts the first 4-digit year found in a string, e.g. `"um 1920"` ->
 * `"1920"`.
 * @param {?string} jahr Raw year value.
 * @return {string} The first 4-digit year found, or `''`.
 */
function extractFirstYear(jahr) {
  if (!jahr) return "";
  const match = String(jahr).match(/\d{4}/);
  return match ? match[0] : "";
}

/**
 * Builds a deep link into the Bildarchiv Winterthur image database,
 * pre-filled with the given feature's metadata.
 * @param {{year?: string, street?: string, housenumber?: string,
 *     district?: string}} props Feature properties.
 * @return {string} A fully-encoded search URL.
 */
function buildCustomLink(props) {
  const jahr = extractFirstYear(props.year);
  const strasse = props.street || "";
  const hausnr = extractFirstHouseNumber(props.housenumber);
  const stadtkreis = props.district || "";

  const parts = [];
  if (hausnr !== "") parts.push(`HAUSNUMMER=${hausnr}`);
  if (jahr !== "") parts.push(`JAHR=${jahr}`);
  if (stadtkreis !== "") parts.push(`STADTKREIS=${stadtkreis}`);
  if (strasse !== "") parts.push(`STRASSE=${strasse}`);

  const query = parts.join(" ");
  return `https://bilddatenbank.winterthur.ch/ims_publisher/images?query=${encodeURIComponent(query)}`;
}

// ===========================================================
// MAP INIT
// ===========================================================

/**
 * Creates the Leaflet map instance and base tile layer. Must be called
 * after the DOM is ready (the `#map` element must exist), which is why
 * this is invoked from `DOMContentLoaded` rather than at module-parse
 * time.
 * @return {!L.Map} The initialized Leaflet map.
 */
function initMap() {
  const mapInstance = L.map("map").setView(
    MAP_INITIAL_CENTER,
    MAP_INITIAL_ZOOM,
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mapInstance);

  return mapInstance;
}

// ===========================================================
// GROUPING LOGIC
// ===========================================================

/**
 * Extracts a representative `[lon, lat]` coordinate pair from a GeoJSON
 * geometry. Only `Point` geometries are supported.
 * @param {{type: string, coordinates: !Array<number>}} geometry GeoJSON
 *     geometry object.
 * @return {?Array<number>} `[lon, lat]`, or `null` if unsupported.
 */
function getRepresentativeCoord(geometry) {
  if (geometry.type === "Point") {
    return geometry.coordinates;
  }
  debugLog(`Unsupported geometry type skipped: ${geometry.type}`);
  return null;
}

/**
 * Builds a stable string key for a coordinate pair, rounded to 6 decimal
 * places (~0.11m precision).
 * @param {!Array<number>} coords `[lon, lat]`.
 * @return {string} Coordinate key, e.g. `"8.723999,47.500100"`.
 */
function coordKey(coords) {
  const [lon, lat] = coords;
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

/**
 * Cheap dedupe key-
 * @param {!Object<string, *>} props Feature properties.
 * @return {string} Composite metadata key.
 */
function metadataKey(props) {
  return (
    `${props.id ?? ""}|${props.title ?? ""}|${props.year ?? ""}|` +
    `${props.street ?? ""}|${props.housenumber ?? ""}|${props.district ?? ""}`
  );
}

/**
 * @typedef {{
 *   repCoord: !Array<number>,
 *   entries: !Array<!Object<string, *>>,
 *   seenMetadata: !Set<string>,
 * }} FeatureGroup
 */

/**
 * Groups GeoJSON features by coordinate, de-duplicating entries that share
 * both a coordinate and identity metadata.
 * @param {!Array<!Object>} features GeoJSON feature array.
 * @return {!Array<!FeatureGroup>} One group per unique coordinate.
 */
function groupFeatures(features) {
  const groups = new Map();

  for (const f of features) {
    if (!f.geometry) continue;

    const repCoord = getRepresentativeCoord(f.geometry);
    if (!repCoord) continue;

    const key = coordKey(repCoord);
    if (!groups.has(key)) {
      groups.set(key, {
        repCoord,
        entries: [],
        seenMetadata: new Set(),
      });
    }

    const group = groups.get(key);
    const props = f.properties || {};
    const mKey = metadataKey(props);

    if (group.seenMetadata.has(mKey)) continue;

    group.seenMetadata.add(mKey);
    group.entries.push(props);
  }

  groups.forEach((g) => {
    g.entries.sort((a, b) => {
      const ya = Number.parseInt(a.year, 10) || 0;
      const yb = Number.parseInt(b.year, 10) || 0;
      return ya - yb;
    });
  });

  return Array.from(groups.values());
}

// ===========================================================
// STYLING / MARKERS
// ===========================================================

/**
 * Maps an entry count to a marker diameter in pixels, using fixed
 * thresholds so marker size communicates rough magnitude at a glance.
 * @param {number} count Number of entries represented by the marker.
 * @return {number} Icon size in pixels (square).
 */
function getIconSizeForCount(count) {
  if (count >= 50) return 44;
  if (count >= 20) return 38;
  if (count >= 10) return 32;
  if (count >= 5) return 28;
  if (count >= 2) return 24;
  return 20;
}

/**
 * Builds a `divIcon` showing a numeric badge for a single (non-cluster)
 * marker.
 * @param {number} count Number of entries at this coordinate.
 * @return {!L.DivIcon} Leaflet icon instance.
 */
function makeCountIcon(count) {
  const size = getIconSizeForCount(count);
  return L.divIcon({
    className: "count-marker",
    html: `<div class="count-circle">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Builds a `divIcon` for a marker cluster, summing the `entryCount` of all
 * child markers to show a combined total.
 * @param {!L.MarkerCluster} cluster Leaflet.markercluster cluster instance.
 * @return {!L.DivIcon} Leaflet icon instance.
 */
function makeClusterIcon(cluster) {
  const children = cluster.getAllChildMarkers();
  const total = children.reduce(
    (sum, m) => sum + (m.options.entryCount || 1),
    0,
  );
  const size = getIconSizeForCount(total);

  return L.divIcon({
    className: "count-marker",
    html: `<div class="count-circle">${total}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ===========================================================
// DETAILS PANEL (DOM-built, no innerHTML with dynamic data)
// ===========================================================

/**
 * Builds a DOM block describing a single feature's properties, including
 * a table of metadata and an outbound search link. Built via DOM APIs
 * (not `innerHTML`) since the data is untrusted.
 * @param {!Object<string, *>} props Feature properties.
 * @return {!HTMLDivElement} The constructed `.entry-block` element.
 */
function buildEntryBlock(props) {
  const block = document.createElement("div");
  block.className = "entry-block";

  const heading = document.createElement("h3");
  heading.textContent = props.title || "Untitled";
  block.appendChild(heading);

  const table = document.createElement("table");
  const rows = [
    ["Year", props.year || ""],
    ["Street", props.street || ""],
    ["House number", props.housenumber || ""],
    ["District", props.district || ""],
  ];

  for (const [label, value] of rows) {
    const tr = document.createElement("tr");

    const keyCell = document.createElement("td");
    keyCell.className = "key";
    keyCell.textContent = label;

    const valueCell = document.createElement("td");
    valueCell.textContent = value;

    tr.append(keyCell, valueCell);
    table.appendChild(tr);
  }
  block.appendChild(table);

  const link = document.createElement("a");
  link.className = "gen-link";
  link.href = buildCustomLink(props);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Search in Bildarchiv Winterthur";
  block.appendChild(link);

  return block;
}

/**
 * Renders the details panel for a set of feature entries (typically all
 * entries sharing one map marker/coordinate). Clears any previous content.
 * @param {?Array<!Object<string, *>>} entries Feature properties to
 *     display, or `null`/empty for the placeholder state.
 * @return {void}
 */
function showDetails(entries) {
  detailsEl.innerHTML = "";

  if (!entries || entries.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder";
    placeholder.textContent = "No details available.";
    detailsEl.appendChild(placeholder);
    return;
  }

  entries.forEach((props, idx) => {
    detailsEl.appendChild(buildEntryBlock(props));
    if (idx < entries.length - 1) {
      const hr = document.createElement("hr");
      hr.className = "entry-separator";
      detailsEl.appendChild(hr);
    }
  });
}

// ===========================================================
// DISTRICTS DATA LOADING
// ===========================================================

/**
 * Fetches and parses the districts JSON file, populating the module-level
 * `districtsData` map of district name -> street list.
 * @param {AbortSignal} signal Abort signal tied to the current load cycle.
 * @return {!Promise<void>}
 * @throws {Error} If the HTTP response is not OK.
 */
async function loadDistricts(signal) {
  const res = await fetch(DISTRICTS_URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  districtsData = data || {};
  debugLog("Districts loaded:", Object.keys(districtsData).length, "districts");
}

// ===========================================================
// DATA LOADING
// ===========================================================

/**
 * Loads the GeoJSON dataset and districts data, then groups features and
 * performs the initial render. Safe to call multiple times — subsequent
 * calls are no-ops while a load is already complete or in progress.
 * @return {!Promise<void>}
 */
async function loadData() {
  if (dataLoaded || loadInProgress) {
    debugLog("Data already loaded or load in progress");
    return;
  }

  loadInProgress = true;
  loadAbortController = new AbortController();
  const { signal } = loadAbortController;

  debugLog("Starting data load...");

  try {
    const [geoRes] = await Promise.all([
      fetch(GEOJSON_URL, { signal }),
      loadDistricts(signal),
    ]);

    if (!geoRes.ok) throw new Error(`HTTP ${geoRes.status}`);
    const data = await geoRes.json();

    debugLog("Data loaded successfully:", data.features.length, "features");
    allFeatures = data.features || [];

    debugTime("groupFeatures");
    precomputedGroups = groupFeatures(allFeatures);
    debugTimeEnd("groupFeatures");

    renderGroups(precomputedGroups, { fitBounds: true });
    updateStats(allFeatures.length, allFeatures.length);

    populateStadtkreisOptions();
    populateStrasseOptions("");

    dataLoaded = true;
  } catch (err) {
    if (err.name === "AbortError") {
      debugLog("Data load aborted");
      return;
    }
    statsEl.textContent = `Error loading data: ${err.message}`;
    console.error("Data load error:", err);
  } finally {
    loadInProgress = false;
  }
}

// ===========================================================
// FILTER OPTION POPULATION (from districts.json)
// ===========================================================

/**
 * Populates the Stadtkreis (district) `<select>` with an "All" option plus
 * one option per known district, sorted using German collation rules.
 * @return {void}
 */
function populateStadtkreisOptions() {
  const keys = Object.keys(districtsData);
  const sorted = keys
    .filter((k) => k !== "")
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true }));

  const html =
    `<option value="">All</option>` +
    sorted
      .map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`)
      .join("");
  setInnerHtml(stadtkreisSelectEl, html);
}

/**
 * Populates the street `<datalist>` used for autocomplete, scoped to the
 * given district (or all districts if `stadtkreisVal` is empty).
 * @param {string} stadtkreisVal Selected district name, or `''` for all.
 * @return {void}
 */
function populateStrasseOptions(stadtkreisVal) {
  let strassen;
  if (stadtkreisVal === "") {
    const set = new Set();
    Object.values(districtsData).forEach((list) => {
      (list || []).forEach((s) => set.add(s));
    });
    strassen = Array.from(set);
  } else {
    strassen = districtsData[stadtkreisVal] || [];
  }

  const sorted = Array.from(new Set(strassen)).sort((a, b) =>
    a.localeCompare(b, "de"),
  );
  const html = sorted
    .map((s) => `<option value="${escapeHtml(s)}"></option>`)
    .join("");
  setInnerHtml(strasseOptionsEl, html);
}

// ===========================================================
// RENDERING
// ===========================================================

/**
 * Builds one `L.Marker` per group. Extracted so both initial render and
 * filtered re-renders share identical marker construction logic.
 * @param {!Array<!FeatureGroup>} groups Groups to render.
 * @return {!Array<!L.Marker>} One marker per group, in the same order.
 */
function buildMarkersForGroups(groups) {
  const markers = new Array(groups.length);
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const [lon, lat] = group.repCoord;
    const count = group.entries.length;

    const marker = L.marker([lat, lon], {
      icon: makeCountIcon(count),
      entryCount: count,
    });
    marker.on("click", () => handleMarkerClick(group));
    markers[i] = marker;
  }
  return markers;
}

/**
 * Handles a marker click: shows the group's entries in the details panel
 * and, on mobile viewports, opens the sidebar.
 * @param {!FeatureGroup} group The clicked group.
 * @return {void}
 */
function handleMarkerClick(group) {
  showDetails(group.entries);
  if (isMobileViewport() && sidebarEl) {
    sidebarEl.classList.add("open");
    if (sidebarToggleEl) sidebarToggleEl.setAttribute("aria-expanded", "true");
  }
}

/**
 * Renders a set of groups onto the map.
 * @param {!Array<!FeatureGroup>} groups Groups to render.
 * @param {{fitBounds: (boolean|undefined)}=} options `fitBounds` controls
 *     whether the map auto-zooms to the rendered markers. Pass `true` only
 *     for the initial full-data load; `false` for filter-driven re-renders.
 * @return {void}
 */
function renderGroups(groups, options = {}) {
  const { fitBounds = false } = options;

  const markers = buildMarkersForGroups(groups);

  if (!geoLayer) {
    geoLayer = L.markerClusterGroup({
      iconCreateFunction: makeClusterIcon,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 40,
      chunkedLoading: true,
      chunkDelay: 50,
      chunkInterval: 200,
    });
    map.addLayer(geoLayer);
  }

  geoLayer.clearLayers();
  geoLayer.addLayers(markers);

  if (fitBounds && !hasFitInitialBounds && markers.length > 0) {
    try {
      map.fitBounds(geoLayer.getBounds(), { maxZoom: 16, animate: false });
      hasFitInitialBounds = true;
    } catch (e) {
      console.error("Bounds error:", e);
    }
  }
}

/**
 * Updates the "Showing X of Y entries" status text.
 * @param {number} shown Number of entries currently matching filters.
 * @param {number} total Total number of entries in the full dataset.
 * @return {void}
 */
function updateStats(shown, total) {
  statsEl.textContent = `Showing ${shown} of ${total} entries`;
}

// ===========================================================
// COMBINED FILTER LOGIC
// ===========================================================

/**
 * Checks whether a title matches a free-text search query. All
 * whitespace-separated words in `query` must appear somewhere in `title`
 * (case-insensitive, unordered).
 * @param {?string} title Feature title.
 * @param {string} query Raw search query.
 * @return {boolean} Whether the title matches.
 */
function matchesTitleSearch(title, query) {
  if (!query) return true;
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const normalizedTitle = (title || "").toLowerCase();
  return words.every((word) => normalizedTitle.includes(word));
}

/**
 * @typedef {{
 *   from: number,
 *   to: number,
 *   strasseVal: string,
 *   stadtkreisVal: string,
 *   titleVal: string,
 * }} FilterCriteria
 */

/**
 * Builds a predicate function for filtering feature properties against the
 * given filter criteria.
 * @param {!FilterCriteria} criteria Parsed filter form values.
 * @return {function(!Object<string, *>): boolean} Predicate usable with
 *     `Array#filter`.
 */
function buildFilterPredicate({
  from,
  to,
  strasseVal,
  stadtkreisVal,
  titleVal,
}) {
  const normalizedStrasseVal = (strasseVal || "").trim().toLowerCase();

  return (props) => {
    const year = Number.parseInt(props.year, 10);
    const yearOk = Number.isNaN(year) ? true : year >= from && year <= to;

    const strasse = (props.street || "").trim().toLowerCase();
    const strasseOk =
      normalizedStrasseVal === "" || strasse.includes(normalizedStrasseVal);

    const stadtkreis =
      props.district != null ? String(props.district).trim() : "";
    const stadtkreisOk = stadtkreisVal === "" || stadtkreis === stadtkreisVal;

    const titleOk = matchesTitleSearch(props.title, titleVal);

    return yearOk && strasseOk && stadtkreisOk && titleOk;
  };
}

/**
 * Parses a year-bound input value into a finite number usable in a range
 * comparison. Empty strings and unparseable values fall back to `fallback`
 * (±Infinity).
 * @param {string} rawValue Raw input value.
 * @param {number} fallback Value to use when `rawValue` is empty or
 *     unparseable (typically `-Infinity` or `Infinity`).
 * @return {number} Parsed year, or `fallback`.
 */
function parseYearBound(rawValue, fallback) {
  if (rawValue === "") return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Reads current filter form values, applies them to the
 * precomputed groups, and re-renders the map + stats. No-op until the
 * initial dataset has finished loading.
 * @return {void}
 */
function applyFilters() {
  if (!dataLoaded) return;

  clearTimeout(filterTimeout);

  filterTimeout = setTimeout(() => {
    const fromVal = yearFromEl.value;
    const toVal = yearToEl.value;
    const strasseVal = strasseInputEl.value;
    const stadtkreisVal = stadtkreisSelectEl.value;
    const titleVal = titleSearchEl.value.trim();

    const from = parseYearBound(fromVal, -Infinity);
    const to = parseYearBound(toVal, Infinity);

    const predicate = buildFilterPredicate({
      from,
      to,
      strasseVal,
      stadtkreisVal,
      titleVal,
    });

    const filteredGroups = [];
    let shownCount = 0;

    for (const group of precomputedGroups) {
      const matchingEntries = group.entries.filter(predicate);
      if (matchingEntries.length > 0) {
        filteredGroups.push({
          repCoord: group.repCoord,
          entries: matchingEntries,
        });
        shownCount += matchingEntries.length;
      }
    }

    renderGroups(filteredGroups, { fitBounds: false });
    updateStats(shownCount, allFeatures.length);
  }, 300);
}

// ===========================================================
// DOM REF / EVENT INITIALIZATION
// ===========================================================

/**
 * Looks up and caches all DOM elements the app needs.
 * @return {void}
 */
function initDomRefs() {
  detailsEl = getRequiredElement("details");
  statsEl = getRequiredElement("stats");
  titleSearchEl = getRequiredElement("titleSearch");
  yearFromEl = getRequiredElement("yearFrom");
  yearToEl = getRequiredElement("yearTo");
  strasseInputEl = getRequiredElement("strasseInput");
  stadtkreisSelectEl = getRequiredElement("stadtkreisSelect");
  strasseOptionsEl = getRequiredElement("strasseOptions");

  // Sidebar toggle is optional (e.g. desktop-only layouts might omit it),
  // so these use direct lookups rather than getRequiredElement.
  sidebarToggleEl = document.getElementById("sidebarToggle");
  sidebarEl = document.getElementById("sidebar");
}

/**
 * Wires up all event listeners. Assumes {@link initDomRefs} and
 * {@link initMap} have already run.
 * @return {void}
 */
function attachEventListeners() {
  titleSearchEl.addEventListener("input", applyFilters);
  yearFromEl.addEventListener("input", applyFilters);
  yearToEl.addEventListener("input", applyFilters);
  strasseInputEl.addEventListener("change", applyFilters);

  stadtkreisSelectEl.addEventListener("change", (e) => {
    const stadtkreisVal = e.target.value;
    populateStrasseOptions(stadtkreisVal);
    strasseInputEl.value = "";
    applyFilters();
  });

  if (sidebarToggleEl && sidebarEl) {
    sidebarToggleEl.addEventListener("click", () => {
      const isOpen = sidebarEl.classList.toggle("open");
      sidebarToggleEl.setAttribute("aria-expanded", String(isOpen));
      setTimeout(() => map.invalidateSize(), 300);
    });
  }

  window.addEventListener("resize", () => {
    map.invalidateSize();
  });

  window.addEventListener("beforeunload", () => {
    if (loadAbortController) loadAbortController.abort();
  });
}

// ===========================================================
// BOOTSTRAP
// ===========================================================
document.addEventListener("DOMContentLoaded", () => {
  debugLog("DOM Content Loaded - initializing app");

  initDomRefs();
  map = initMap();
  attachEventListeners();

  loadData();
});
