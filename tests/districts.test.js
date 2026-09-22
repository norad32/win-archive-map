import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { Window } from "happy-dom";

import { loadDistricts } from "../src/js/data/districts.js";
import { populateStreetOptions } from "../src/js/data/districts.js";

const districtsData = {
  "Winterthur-Stadt": ["Römerstrasse", "Marktgasse"],
  Töss: ["Bahnstrasse"],
};

describe("loadDistricts", () => {
  beforeEach(() => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => districtsData,
    });
  });

  it("loadDistricts_Should_ReturnData_If_FetchSucceeds", async () => {
    const data = await loadDistricts();

    assert.deepEqual(data, districtsData);
  });

  it("loadDistricts_Should_Throw_If_FetchFails", async () => {
    globalThis.fetch = async () => ({ ok: false });

    await assert.rejects(() => loadDistricts());
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
    // defaultSelected survives attaching the option to the select.
    globalThis.Option = function (text, value, defaultSelected, selected) {
      const el = document.createElement("option");
      if (text !== undefined) el.text = text;
      if (value !== undefined) el.value = value;
      if (defaultSelected || selected) {
        el.defaultSelected = true;
        el.selected = true;
      }
      return el;
    };
    datalist = document.createElement("datalist");
  });

  it("populateStreetOptions_Should_FillSortedStreets_If_DistrictSelected", () => {
    populateStreetOptions(datalist, districtsData, "Winterthur-Stadt");

    const values = [...datalist.children].map((o) => o.value);
    assert.deepEqual(values, ["Marktgasse", "Römerstrasse"]);
  });

  it("populateStreetOptions_Should_FillAllStreets_If_DistrictEmpty", () => {
    populateStreetOptions(datalist, districtsData, "");

    const values = [...datalist.children].map((o) => o.value);
    assert.deepEqual(values, ["Bahnstrasse", "Marktgasse", "Römerstrasse"]);
  });
});
