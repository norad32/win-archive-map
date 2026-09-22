import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { loadBoundaryData } from "../src/js/data/boundary.js";

const districtGeojson = {
  features: [{ properties: { district: "Winterthur-Stadt" } }],
};
const neighbourhoodGeojson = {
  features: [
    { properties: { district: "Winterthur-Stadt", neighbourhood: "Altstadt" } },
    {
      properties: { district: "Winterthur-Stadt", neighbourhood: "Neuwiesen" },
    },
    { properties: { district: "Töss", neighbourhood: "Schlosstal" } },
    { properties: { district: "Töss" } },
  ],
};

function mockFetch(handler) {
  globalThis.fetch = async (url) => handler(url);
}

function jsonResponse(payload) {
  return { ok: true, json: async () => payload };
}

describe("loadBoundaryData", () => {
  beforeEach(() => {
    mockFetch((url) => {
      if (url.includes("districts")) return jsonResponse(districtGeojson);
      if (url.includes("neighbourhoods"))
        return jsonResponse(neighbourhoodGeojson);
      return { ok: false };
    });
  });

  it("loadBoundaryData_Should_ReturnBothFeatureSets_If_FetchSucceeds", async () => {
    const data = await loadBoundaryData();

    assert.equal(data.districtFeatures.length, 1);
    assert.equal(data.neighbourhoodFeatures.length, 4);
  });

  it("loadBoundaryData_Should_GroupNeighbourhoodsByDistrict_SortedAlphabetically", async () => {
    const data = await loadBoundaryData();

    assert.deepEqual(data.districtToNeighbourhoods.get("Winterthur-Stadt"), [
      "Altstadt",
      "Neuwiesen",
    ]);
    assert.deepEqual(data.districtToNeighbourhoods.get("Töss"), ["Schlosstal"]);
  });

  it("loadBoundaryData_Should_SkipFeaturesWithoutDistrictOrNeighbourhood", async () => {
    const data = await loadBoundaryData();

    // "Töss" feature without neighbourhood is not added as empty entry.
    assert.deepEqual(data.districtToNeighbourhoods.get("Töss"), ["Schlosstal"]);
  });

  it("loadBoundaryData_Should_ReturnEmptyFeatures_If_FetchFails", async () => {
    mockFetch(async () => {
      throw new Error("network down");
    });

    const data = await loadBoundaryData();

    assert.deepEqual(data.districtFeatures, []);
    assert.deepEqual(data.neighbourhoodFeatures, []);
    assert.equal(data.districtToNeighbourhoods.size, 0);
  });

  it("loadBoundaryData_Should_Rethrow_If_FetchWasAborted", async () => {
    mockFetch(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });

    await assert.rejects(() => loadBoundaryData());
  });
});
