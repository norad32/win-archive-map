import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { Window } from "happy-dom";

import { updateNeighbourhoodOptions } from "../src/js/ui/neighbourhood-select.js";

describe("updateNeighbourhoodOptions", () => {
  let select;
  const districtMap = new Map([
    ["Winterthur-Stadt", ["Neuwiesen", "Altstadt"]],
    ["Töss", ["Schlosstal"]],
  ]);

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
    select = document.createElement("select");
  });

  it("updateNeighbourhoodOptions_Should_ListAllSorted_If_NoDistrictSelected", () => {
    updateNeighbourhoodOptions(select, districtMap, "");

    const values = [...select.options].map((o) => o.value);
    assert.deepEqual(values, ["", "Altstadt", "Neuwiesen", "Schlosstal"]);
  });

  it("updateNeighbourhoodOptions_Should_ListDistrictOnly_If_DistrictSelected", () => {
    updateNeighbourhoodOptions(select, districtMap, "Töss");

    const values = [...select.options].map((o) => o.value);
    assert.deepEqual(values, ["", "Schlosstal"]);
  });

  it("updateNeighbourhoodOptions_Should_MarkPreviousValueSelected_If_StillAvailable", () => {
    updateNeighbourhoodOptions(select, districtMap, "Winterthur-Stadt");
    select.value = "Altstadt"; // state a browser would have after user selection
    updateNeighbourhoodOptions(select, districtMap, "Winterthur-Stadt");

    const selected = [...select.options].find(
      (o) => o.defaultSelected && o.value !== "",
    );
    assert.equal(selected.value, "Altstadt");
  });

  it("updateNeighbourhoodOptions_Should_ResetSelection_If_NotAvailable", () => {
    updateNeighbourhoodOptions(select, districtMap, "Winterthur-Stadt");
    updateNeighbourhoodOptions(select, districtMap, "Töss");

    const selected = [...select.options].filter((o) => o.defaultSelected);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].value, "");
  });
});
