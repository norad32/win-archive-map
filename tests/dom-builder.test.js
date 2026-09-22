import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { Window } from "happy-dom";

import { el, setChildren, populateSelect } from "../src/js/dom/dom-builder.js";

describe("el", () => {
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
  });

  it("el_Should_CreateElementWithClass_If_ClassNameGiven", () => {
    const node = el("div", { className: "foo" });

    assert.equal(node.tagName, "DIV");
    assert.equal(node.className, "foo");
  });

  it("el_Should_AppendChildren_If_Given", () => {
    const child = document.createTextNode("hello");
    const node = el("p", {}, [child]);

    assert.equal(node.textContent, "hello");
  });

  it("el_Should_SkipNullAndFalseChildren", () => {
    const node = el("p", {}, [null, false, "text"]);

    assert.equal(node.textContent, "text");
  });

  it("el_Should_ConvertNonNodeChildrenToString", () => {
    const node = el("p", {}, [42]);

    assert.equal(node.textContent, "42");
  });

  it("el_Should_RegisterListener_If_OnHandlerGiven", () => {
    let clicked = false;
    const node = el("button", { onClick: () => (clicked = true) });

    node.dispatchEvent(new window.Event("click"));

    assert.equal(clicked, true);
  });

  it("el_Should_AssignDataset_If_DatasetGiven", () => {
    const node = el("div", { dataset: { id: "7" } });

    assert.equal(node.dataset.id, "7");
  });

  it("el_Should_SetAttribute_If_PropertyUnknown", () => {
    const node = el("div", { "data-custom": "x" });

    assert.equal(node.getAttribute("data-custom"), "x");
  });

  it("el_Should_SkipNullValues_If_ValueIsNull", () => {
    const node = el("div", { title: null });

    assert.equal(node.hasAttribute("title"), false);
  });
});

describe("setChildren", () => {
  it("setChildren_Should_ReplaceExistingChildren", () => {
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
    const node = el("div", {}, ["old"]);
    setChildren(node, ["new"]);

    assert.equal(node.textContent, "new");
  });
});

describe("populateSelect", () => {
  it("populateSelect_Should_CreateOptions_WithAllLabelAndSelection", () => {
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
    const select = document.createElement("select");
    populateSelect(select, ["Seen", "Töss"], {
      allLabel: "All",
      selected: "Töss",
    });

    const values = [...select.options].map((o) => o.value);
    assert.deepEqual(values, ["", "Seen", "Töss"]);
    assert.equal(select.options[0].textContent, "All");
    assert.equal(
      [...select.options].find((o) => o.value === "Töss").defaultSelected,
      true,
    );
  });
});
