import { Config } from "./config.js";
import { loadDistricts } from "./districts.js";
import { loadBoundaryData } from "./boundaryData.js";
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

        try {
            const [geoRes, loadedDistricts, boundaryData] = await Promise.all([
                fetch(Config.GEOJSON_URL, { signal }),
                loadDistricts(signal),
                loadBoundaryData(signal),
            ]);

            districtsData = loadedDistricts;
            emitter.emit("districts-loaded", districtsData);
            emitter.emit("boundary-loaded", boundaryData);

            if (!geoRes.ok) throw new Error(`HTTP ${geoRes.status}`);

            const lastModifiedHeader = geoRes.headers.get("Last-Modified");
            if (lastModifiedHeader) {
                lastUpdated = new Date(lastModifiedHeader);
            }

            const data = await geoRes.json();
            allFeatures = data.features || [];
            precomputedGroups = groupFeatures(allFeatures);
            dataLoaded = true;

            emitter.emit("geo-loaded", { allFeatures, precomputedGroups, lastUpdated });
        } catch (err) {
            if (err.name === "AbortError") return;
            emitter.emit("error", err);
        } finally {
            loadInProgress = false;
            emitter.emit("load-end");
        }
    }

    function abort() {
        if (abortController) abortController.abort();
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