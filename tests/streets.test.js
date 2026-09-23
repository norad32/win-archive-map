import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { Window } from "happy-dom";

import { loadStreets, populateStreetOptions, populateDistrictOptions } from "../src/js/data/districts.js";

const streetsData = {
  districts: {
    "Winterthur-Stadt": ["Römerstrasse", "Marktgasse", "Bahnhofplatz"],
    Töss: ["Bahnstrasse", "Bahnhofplatz"],
    Other: ["Waldweg"],
  },
  neighbourhoods: {
    Altstadt: ["Marktgasse", "Bahnhofplatz"],
    "Brühlberg": ["Römerstrasse", "Bahnhofplatz"],
    Schlosstal: ["Bahnstrasse"],
  },
};

describe("loadStreets", () => {
  beforeEach(() => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => streetsData,
    });
  });

  it("loadStreets_Should_ReturnDistrictAndNeighbourhoodMaps_If_FetchSucceeds", async () => {
    const data = await loadStreets();

    assert.ok(data.districts instanceof Map);
    assert.ok(data.neighbourhoods instanceof Map);
    assert.deepEqual(data.districts.get("Töss"), ["Bahnstrasse", "Bahnhofplatz"]);
    assert.deepEqual(data.neighbourhoods.get("Altstadt"), ["Marktgasse", "Bahnhofplatz"]);
  });

  it("loadStreets_Should_Throw_If_FetchFails", async () => {
    globalThis.fetch = async () => ({ ok: false });

    await assert.rejects(() => loadStreets());
  });
});

describe("populateDistrictOptions", () => {
  it("populateDistrictOptions_Should_ListAllDistrictsSorted", () => {
    const window = new Window();
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.Node = window.Node;
    globalThis.Option = function (text, value) {
      const el = document.createElement("option");
      if (text !== undefined) el.text = text;
      if (value !== undefined) el.value = value;
      return el;
    };
    const select = document.createElement("select");

    populateDistrictOptions(
      select,
      {
        districts: new Map(Object.entries(streetsData.districts)),
        neighbourhoods: new Map(),
      },
    );

    const values = [...select.options].map((o) => o.value);
    assert.deepEqual(values, ["", "Other", "Töss", "Winterthur-Stadt"]);
  });
});

describe("populateStreetOptions", () => {
  let datalist;

  beforeEach(() => {
    const window = new Window();
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.Node = window.Node;
    globalThis.Event = window.Event;
    // happy-dom has no Option constructor; a factory works with `new`.
    globalThis.Option = function (text, value) {
      const el = document.createElement("option");
      if (text !== undefined) el.text = text;
      if (value !== undefined) el.value = value;
      return el;
    };
    datalist = document.createElement("datalist");
  });

  function streetValues() {
    return [...datalist.children].map((o) => o.value);
  }

  it("populateStreetOptions_Should_ListAllStreets_If_NoSelection", () => {
    populateStreetOptions(datalist, dataAsMaps(), "", "");

    assert.deepEqual(streetValues(), [
      "Bahnhofplatz",
      "Bahnstrasse",
      "Marktgasse",
      "Römerstrasse",
      "Waldweg",
    ]);
  });

  it("populateStreetOptions_Should_ListDistrictStreets_If_DistrictSelected", () => {
    populateStreetOptions(datalist, dataAsMaps(), "Töss", "");

    assert.deepEqual(streetValues(), ["Bahnhofplatz", "Bahnstrasse"]);
  });

  it("populateStreetOptions_Should_ListNeighbourhoodStreets_If_NeighbourhoodSelected", () => {
    populateStreetOptions(datalist, dataAsMaps(), "Winterthur-Stadt", "Altstadt");

    // Neighbourhood wins over district.
    assert.deepEqual(streetValues(), ["Bahnhofplatz", "Marktgasse"]);
  });

  it("populateStreetOptions_Should_ListNeighbourhoodStreets_If_OnlyNeighbourhoodSelected", () => {
    populateStreetOptions(datalist, dataAsMaps(), "", "Schlosstal");

    assert.deepEqual(streetValues(), ["Bahnstrasse"]);
  });

  it("populateStreetOptions_Should_ListEmpty_If_NeighbourhoodUnknown", () => {
    populateStreetOptions(datalist, dataAsMaps(), "", "Nowhere");

    assert.deepEqual(streetValues(), []);
  });
});

function dataAsMaps() {
  return {
    districts: new Map(Object.entries(streetsData.districts)),
    neighbourhoods: new Map(Object.entries(streetsData.neighbourhoods)),
  };
}
