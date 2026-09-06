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

async function fetchGeoJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const lastUpdatedHeader = res.headers.get("Last-Modified");
  const lastUpdated = lastUpdatedHeader ? new Date(lastUpdatedHeader) : null;

  const data = await res.json();
  return { features: data.features ?? [], lastUpdated };
}

export function createDataStore() {
  const emitter = createEmitter();

  let allFeatures = [];
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
      fetchGeoJson(Config.GEOJSON_URL, signal),
      loadDistricts(signal),
      loadBoundaryData(signal),
    ]);

    const [geoResult, districtsResult, boundaryResult] = results;

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

    if (geoResult.status === "fulfilled") {
      ({ features: allFeatures, lastUpdated } = geoResult.value);
      precomputedGroups = groupFeatures(allFeatures);
      dataLoaded = true;

      emitter.emit("geo-loaded", {
        allFeatures,
        precomputedGroups,
        lastUpdated,
      });
    } else {
      emitter.emit("error", geoResult.reason);
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
    getFeatures: () => allFeatures,
    getTotalCount: () => allFeatures.length,
    getDistrictsData: () => districtsData,
    getLastUpdated: () => lastUpdated,
    isLoaded: () => dataLoaded,
    isLoading: () => loadInProgress,
  };
}
