import { Config } from "./../config.js";
import { loadStreets } from "./districts.js";
import { loadBoundaryData } from "./boundary.js";
import { groupFeatures } from "./grouping.js";

function createEmitter() {
  const listeners = new Map();

  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event)?.delete(handler);
  }

  function emit(event, payload) {
    listeners.get(event)?.forEach((handler) => handler(payload));
  }

  return { on, emit };
}

async function fetchWithLastModified(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const lastUpdatedHeader = res.headers.get("Last-Modified");
  const lastUpdated = lastUpdatedHeader ? new Date(lastUpdatedHeader) : null;

  const data = await res.json();
  return { data, lastUpdated };
}

async function fetchGeoJson(url, signal) {
  const { data } = await fetchWithLastModified(url, signal);
  return data.features ?? [];
}

async function fetchArchive(url, signal) {
  const { data, lastUpdated } = await fetchWithLastModified(url, signal);
  return { entries: Array.isArray(data) ? data : [], lastUpdated };
}

function buildLocationsById(addressFeatures, locationFeatures) {
  const locationsById = new Map();

  for (const feature of [...addressFeatures, ...locationFeatures]) {
    const { id } = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    if (!id || !coordinates) continue;
    locationsById.set(id, coordinates);
  }

  return locationsById;
}

export function createDataStore() {
  const emitter = createEmitter();

  let allEntries = [];
  let unlocatedEntries = [];
  let precomputedGroups = [];
  let streetsData = {};
  let lastUpdated = null;

  let dataLoaded = false;
  let loadInProgress = false;
  let abortController = null;

  async function load() {
    if (dataLoaded || loadInProgress) return;

    loadInProgress = true;
    abortController = new AbortController();
    const { signal } = abortController;

    emitter.emit("load-start");

    const results = await Promise.allSettled([
      fetchArchive(Config.ARCHIVE_URL, signal),
      fetchGeoJson(Config.ADDRESSES_URL, signal),
      fetchGeoJson(Config.LOCATIONS_URL, signal),
      loadStreets(signal),
      loadBoundaryData(signal),
    ]);

    const [
      archiveResult,
      addressesResult,
      locationsResult,
      streetsResult,
      boundaryResult,
    ] = results;

    // Any rejection due to abort short-circuits everything else silently.
    const aborted = results.some(
      (r) => r.status === "rejected" && r.reason?.name === "AbortError",
    );
    if (aborted) {
      loadInProgress = false;
      emitter.emit("load-end");
      return;
    }

    if (streetsResult.status === "fulfilled") {
      streetsData = streetsResult.value;
      emitter.emit("districts-loaded", streetsData);
    } else {
      emitter.emit("error", streetsResult.reason);
    }

    if (boundaryResult.status === "fulfilled") {
      emitter.emit("boundary-loaded", boundaryResult.value);
      if (boundaryResult.value.errors?.length) {
        emitter.emit("boundary-partial-error", boundaryResult.value.errors);
      }
    } else {
      emitter.emit("error", boundaryResult.reason);
    }

    if (archiveResult.status === "fulfilled") {
      ({ entries: allEntries, lastUpdated } = archiveResult.value);

      const addressFeatures =
        addressesResult.status === "fulfilled" ? addressesResult.value : [];
      const locationFeatures =
        locationsResult.status === "fulfilled" ? locationsResult.value : [];

      if (addressesResult.status === "rejected") {
        emitter.emit("error", addressesResult.reason);
      }
      if (locationsResult.status === "rejected") {
        emitter.emit("error", locationsResult.reason);
      }

      const locationsById = buildLocationsById(
        addressFeatures,
        locationFeatures,
      );
      precomputedGroups = groupFeatures(allEntries, locationsById);
      // "Unlocated" = no loc at all, or loc references that resolve to no
      // coordinates such entries appear on no marker and must stay reachable via search/filter.
      const entryKey = (entry) => `${entry.id}\u0000${entry.signature ?? ""}`;
      const placedIds = new Set();
      for (const group of precomputedGroups) {
        for (const entry of group.entries) placedIds.add(entryKey(entry));
      }
      unlocatedEntries = allEntries.filter(
        (entry) =>
          !(entry.locationParts?.length || entry.loc) ||
          !placedIds.has(entryKey(entry)),
      );
      dataLoaded = true;

      emitter.emit("geo-loaded", {
        allEntries,
        precomputedGroups,
        lastUpdated,
      });
    } else {
      emitter.emit("error", archiveResult.reason);
    }

    loadInProgress = false;
    emitter.emit("load-end");
  }

  function abort() {
    abortController?.abort();
  }

  return {
    load,
    abort,
    on: emitter.on,

    getGroups: () => precomputedGroups,
    getEntries: () => allEntries,
    getUnlocatedEntries: () => unlocatedEntries,
    getTotalCount: () => allEntries.length,
    getStreetsData: () => streetsData,
    getLastUpdated: () => lastUpdated,
    isLoaded: () => dataLoaded,
    isLoading: () => loadInProgress,
  };
}
