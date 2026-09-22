import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractFirstYear } from "../src/js/utils/parse.js";

describe("extractFirstYear", () => {
  it("extractFirstYear_Should_ReturnTheFirstFourDigitYear_If_StringContainsOne", () => {
    assert.equal(extractFirstYear("Römerstrasse 8, um 1956 renoviert"), 1956);
    assert.equal(extractFirstYear("1970-1980"), 1970);
  });

  it("extractFirstYear_Should_ReturnNaN_If_ValueIsEmpty", () => {
    assert.ok(Number.isNaN(extractFirstYear("")));
    assert.ok(Number.isNaN(extractFirstYear(null)));
    assert.ok(Number.isNaN(extractFirstYear(undefined)));
  });

  it("extractFirstYear_Should_ReturnNaN_If_StringHasNoFourDigitNumber", () => {
    assert.ok(Number.isNaN(extractFirstYear("kein Jahr")));
    assert.ok(Number.isNaN(extractFirstYear("12")));
  });

  it("extractFirstYear_Should_TakeTheFirstFourDigits_If_NumberIsLonger", () => {
    assert.equal(extractFirstYear("12345"), 1234);
  });
});
