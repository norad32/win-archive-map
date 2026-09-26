import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { Window } from "happy-dom";

import { showDetails } from "../src/js/ui/details-panel.js";

function setupDom() {
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
}

describe("showDetails", () => {
  beforeEach(() => {
    setupDom();
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => [],
    });
  });

  it("showDetails_Should_OmitRowsWithNullOrEmptyProperties", async () => {
    const details = document.createElement("section");

    await showDetails(details, [
      {
        id: "1",
        signature: "042119",
        title: "Historic building",
        year: null,
        street: "",
        housenumber: null,
        district: "Winterthur-Stadt",
        neighbourhood: null,
      },
    ]);

    const labels = [...details.querySelectorAll(".entry-block .key")].map(
      (cell) => cell.textContent,
    );
    const values = [...details.querySelectorAll(".entry-block table tr")].map(
      (row) => row.cells[1].textContent,
    );

    assert.deepEqual(labels, ["District"]);
    assert.deepEqual(values, ["Winterthur-Stadt"]);
  });

  it("showDetails_Should_RenderEveryMetadataRow_If_AllPropertiesPresent", async () => {
    const details = document.createElement("section");

    await showDetails(details, [
      {
        id: "2",
        signature: "042120",
        title: "Historic building",
        year: "1900",
        street: "Marktgasse",
        housenumber: "8",
        district: "Winterthur-Stadt",
        neighbourhood: "Altstadt",
      },
    ]);

    const labels = [...details.querySelectorAll(".entry-block .key")].map(
      (cell) => cell.textContent,
    );

    assert.deepEqual(labels, ["Year", "Street", "House number", "District", "Neighbourhood"]);
  });

  it("showDetails_Should_OmitAllMetadataRows_If_AllPropertiesAreNull", async () => {
    const details = document.createElement("section");

    await showDetails(details, [
      {
        id: "3",
        signature: "042121",
        title: "Portrait",
        year: null,
        street: null,
        housenumber: null,
        district: null,
        neighbourhood: null,
      },
    ]);

    assert.equal(details.querySelectorAll(".entry-block table tr").length, 0);
  });
});
