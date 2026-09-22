import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { createDataStore } from "../src/js/data/data-store.js";

const entries = [
  { id: "1", loc: "römerstrasse_8", year: "1956" },
  { id: "2", loc: "römerstrasse_8", year: "1970" },
  { id: "3", loc: null, year: "1980" },
];
const addressFeatures = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [8.735, 47.5] },
    properties: {
      id: "römerstrasse_8",
      street: "Römerstrasse",
      housenumber: "8",
    },
  },
];

function jsonResponse(payload) {
  return {
    ok: true,
    headers: { get: () => null },
    json: async () => payload,
  };
}

function mockUrls({
  archive = entries,
  addresses = { features: addressFeatures },
  locations = { features: [] },
  districts = {},
}) {
  globalThis.fetch = async (url) => {
    if (url.includes("archive.json")) return jsonResponse(archive);
    if (url.includes("addresses")) return jsonResponse(addresses);
    if (url.includes("locations")) return jsonResponse(locations);
    if (url.includes("districts.json")) return jsonResponse(districts);
    return jsonResponse({ features: [] });
  };
}

describe("createDataStore", () => {
  beforeEach(() => {
    mockUrls({});
  });

  it("createDataStore_Should_EmitGeoLoadedWithGroups_If_LoadSucceeds", async () => {
    const store = createDataStore();
    const events = [];
    store.on("geo-loaded", (payload) => events.push(["geo-loaded", payload]));

    await store.load();

    assert.equal(events.length, 1);
    const [type, payload] = events[0];
    assert.equal(type, "geo-loaded");
    assert.equal(payload.allEntries.length, 3);
    assert.equal(payload.precomputedGroups.length, 1);
  });

  it("createDataStore_Should_SeparateUnlocatedEntries_If_LocIsNull", async () => {
    const store = createDataStore();
    await store.load();

    assert.equal(store.getUnlocatedEntries().length, 1);
    assert.equal(store.getUnlocatedEntries()[0].id, "3");
  });

  it("createDataStore_Should_ExposeTotalsAndFlags_If_LoadSucceeds", async () => {
    const store = createDataStore();
    assert.equal(store.isLoaded(), false);

    await store.load();

    assert.equal(store.isLoaded(), true);
    assert.equal(store.getTotalCount(), 3);
    assert.equal(store.getEntries().length, 3);
    assert.ok(store.getGroups().length > 0);
  });

  it("createDataStore_Should_EmitError_If_ArchiveFetchFails", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      headers: { get: () => null },
    });
    const store = createDataStore();
    const errors = [];
    store.on("error", (err) => errors.push(err));

    await store.load();

    // One error per rejected top-level fetch: archive + districts.
    // Boundary data swallows its own fetch errors and fulfills with [].
    assert.equal(errors.length, 2);
    assert.equal(store.isLoaded(), false);
  });

  it("createDataStore_Should_MergeLocationsFromLocationsFile_If_Provided", async () => {
    mockUrls({
      archive: [{ id: "4", loc: "poi:stadtgarten", year: "1990" }],
      locations: {
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [8.6, 47.45] },
            properties: { id: "poi:stadtgarten", name: "Stadtgarten" },
          },
        ],
      },
    });

    const store = createDataStore();
    await store.load();

    const groups = store.getGroups();
    assert.ok(groups.some((g) => g.key === "poi:stadtgarten"));
  });
});
