import { Config } from "./../config.js";
import { loadDistricts } from "./districts.js";
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

async function fetchEntries(url, signal) {
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
  let districtsData = {};
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
      fetchEntries(Config.ENTRIES_URL, signal),
      fetchGeoJson(Config.ADDRESSES_URL, signal),
      fetchGeoJson(Config.LOCATIONS_URL, signal),
      loadDistricts(signal),
      loadBoundaryData(signal),
    ]);

    const [
      entriesResult,
      addressesResult,
      locationsResult,
      districtsResult,
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

    if (districtsResult.status === "fulfilled") {
      districtsData = districtsResult.value;
      emitter.emit("districts-loaded", districtsData);
    } else {
      emitter.emit("error", districtsResult.reason);
    }

    if (boundaryResult.status === "fulfilled") {
      emitter.emit("boundary-loaded", boundaryResult.value);
      if (boundaryResult.value.errors?.length) {
        emitter.emit("boundary-partial-error", boundaryResult.value.errors);
      }
    } else {
      emitter.emit("error", boundaryResult.reason);
    }

    if (entriesResult.status === "fulfilled") {
      ({ entries: allEntries, lastUpdated } = entriesResult.value);

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
      unlocatedEntries = allEntries.filter((entry) => !entry.loc);
      precomputedGroups = groupFeatures(allEntries, locationsById);
      dataLoaded = true;

      emitter.emit("geo-loaded", {
        allEntries,
        precomputedGroups,
        lastUpdated,
      });
    } else {
      emitter.emit("error", entriesResult.reason);
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
    getDistrictsData: () => districtsData,
    getLastUpdated: () => lastUpdated,
    isLoaded: () => dataLoaded,
    isLoading: () => loadInProgress,
  };
}
