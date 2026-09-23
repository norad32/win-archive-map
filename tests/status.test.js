import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { updateStats, updateLastUpdated } from "../src/js/ui/status.js";

describe("updateStats", () => {
  it("updateStats_Should_WriteShownAndTotalCount", () => {
    const statsEl = { textContent: "" };
    updateStats(statsEl, 12, 340);

    assert.equal(statsEl.textContent, "Showing 12 of 340 entries");
  });
});

describe("updateLastUpdated", () => {
  it("updateLastUpdated_Should_WriteFormattedDate_If_DateProvided", () => {
    const el = { textContent: "" };
    updateLastUpdated(el, new Date("2024-05-06T14:30:00"));

    assert.match(el.textContent, /^Last updated: /);
    assert.match(el.textContent, /2024/);
    // Time format is locale-dependent (14:30 vs 02:30 PM).
    assert.match(el.textContent, /(14|02):30/);
  });

  it("updateLastUpdated_Should_WriteEmptyText_If_DateIsInvalid", () => {
    const el = { textContent: "" };
    updateLastUpdated(el, new Date("not-a-date"));

    assert.equal(el.textContent, "");
  });

  it("updateLastUpdated_Should_WriteEmptyText_If_DateIsNull", () => {
    const el = { textContent: "" };
    updateLastUpdated(el, null);

    assert.equal(el.textContent, "");
  });

  it("updateLastUpdated_Should_DoNothing_If_ElementIsMissing", () => {
    assert.doesNotThrow(() => updateLastUpdated(null, new Date()));
  });
});
