import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { Window } from "happy-dom";

import { getRequiredElement, initDomRefs } from "../src/js/dom/dom-refs.js";

function setupDom() {
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
}

describe("getRequiredElement", () => {
  beforeEach(setupDom);

  it("getRequiredElement_Should_ReturnElement_If_IdExists", () => {
    document.body.append(el_with_id("details"));

    const node = getRequiredElement("details");

    assert.equal(node.id, "details");
  });

  it("getRequiredElement_Should_Throw_If_IdMissing", () => {
    assert.throws(() => getRequiredElement("does-not-exist"), /does-not-exist/);
  });
});

describe("initDomRefs", () => {
  beforeEach(setupDom);

  it("initDomRefs_Should_CollectAllRequiredRefs_If_Present", () => {
    for (const id of [
      "details",
      "stats",
      "titleSearch",
      "yearFrom",
      "yearTo",
      "streetInput",
      "districtSelect",
      "neighbourhoodSelect",
      "streetOptions",
      "sidebarToggle",
      "sidebar",
      "fitResultsBtn",
    ]) {
      document.body.append(el_with_id(id));
    }

    const refs = initDomRefs();

    assert.equal(refs.detailsEl.id, "details");
    assert.equal(refs.statsEl.id, "stats");
    assert.equal(refs.titleSearchEl.id, "titleSearch");
    assert.equal(refs.yearFromEl.id, "yearFrom");
    assert.equal(refs.yearToEl.id, "yearTo");
    assert.equal(refs.streetInputEl.id, "streetInput");
    assert.equal(refs.districtSelectEl.id, "districtSelect");
    assert.equal(refs.neighbourhoodSelectEl.id, "neighbourhoodSelect");
    assert.equal(refs.streetOptionsEl.id, "streetOptions");
    assert.equal(refs.sidebarToggleEl.id, "sidebarToggle");
    assert.equal(refs.sidebarEl.id, "sidebar");
    assert.equal(refs.fitResultsBtnEl.id, "fitResultsBtn");
  });

  it("initDomRefs_Should_AllowNullForOptionalRefs_If_OptionalElementsMissing", () => {
    document.body.append(el_with_id("details"));
    document.body.append(el_with_id("stats"));
    document.body.append(el_with_id("titleSearch"));
    document.body.append(el_with_id("yearFrom"));
    document.body.append(el_with_id("yearTo"));
    document.body.append(el_with_id("streetInput"));
    document.body.append(el_with_id("districtSelect"));
    document.body.append(el_with_id("neighbourhoodSelect"));
    document.body.append(el_with_id("streetOptions"));

    const refs = initDomRefs();

    assert.equal(refs.lastUpdatedEl, null);
    assert.equal(refs.sidebarToggleEl, null);
    assert.equal(refs.sidebarEl, null);
    assert.equal(refs.fitResultsBtnEl, null);
  });

  it("initDomRefs_Should_Throw_If_RequiredElementMissing", () => {
    assert.throws(() => initDomRefs(), /Required element/);
  });
});

function el_with_id(id) {
  const node = document.createElement("div");
  node.id = id;
  return node;
}
