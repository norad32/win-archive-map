import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractFirstYear,
  extractYearRange,
} from "../src/js/utils/parse.js";

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

  it("extractYearRange_Should_ExpandTwoDigitDecade_If_TitleUses90er", () => {
    assert.deepEqual(extractYearRange("90er"), { start: 1990, end: 1999 });
    assert.deepEqual(extractYearRange("90er Jahre"), { start: 1990, end: 1999 });
  });

  it("extractYearRange_Should_ExpandFourDigitDecade_If_TitleUses1980erJahre", () => {
    assert.deepEqual(extractYearRange("1980er-Jahre"), {
      start: 1980,
      end: 1989,
    });
    assert.deepEqual(extractYearRange("1990er-Jahre?"), {
      start: 1990,
      end: 1999,
    });
  });

  it("extractYearRange_Should_ReturnSingleYearRange_If_YearIsExact", () => {
    assert.deepEqual(extractYearRange("um 1956"), { start: 1956, end: 1956 });
  });

  it("extractYearRange_Should_ReturnNull_If_NoYearCanBeParsed", () => {
    assert.equal(extractYearRange("undatiert"), null);
    assert.equal(extractYearRange("?"), null);
    assert.equal(extractYearRange("März"), null);
  });

  it("extractYearRange_Should_ExpandCentury_If_CenturyIsNamed", () => {
    assert.deepEqual(extractYearRange("19. Jahrhundert"), {
      start: 1801,
      end: 1900,
    });
    assert.deepEqual(extractYearRange("18. Jh."), {
      start: 1701,
      end: 1800,
    });
    assert.deepEqual(extractYearRange("19"), { start: 1801, end: 1900 });
  });

  it("extractYearRange_Should_ExpandPartOfCentury_If_HalfIsNamed", () => {
    assert.deepEqual(extractYearRange("2. Hälfte 19. Jh."), {
      start: 1851,
      end: 1900,
    });
    assert.deepEqual(extractYearRange("1. Hälfte des 19. Jh."), {
      start: 1801,
      end: 1850,
    });
  });

  it("extractYearRange_Should_ExpandTwoDigitDateYear_If_DateUsesTwoDigitYear", () => {
    assert.deepEqual(extractYearRange("26.07.70"), {
      start: 1970,
      end: 1970,
    });
    assert.deepEqual(extractYearRange("21.06.01"), {
      start: 2001,
      end: 2001,
    });
  });

  it("extractYearRange_Should_ExpandIncompleteDateYearToDecade_If_YearHasThreeDigits", () => {
    assert.deepEqual(extractYearRange("04.06.202"), {
      start: 2020,
      end: 2029,
    });
    assert.deepEqual(extractYearRange("197"), {
      start: 1970,
      end: 1979,
    });
  });

  it("extractYearRange_Should_ExpandOpenCentury_If_DigitsAreUnknown", () => {
    assert.deepEqual(extractYearRange("19(..)"), {
      start: 1900,
      end: 1999,
    });
    assert.deepEqual(extractYearRange("19.."), {
      start: 1900,
      end: 1999,
    });
    assert.deepEqual(extractYearRange("18../19.."), {
      start: 1800,
      end: 1999,
    });
  });

  it("extractYearRange_Should_ExpandAbbreviatedYearRange_If_EndYearHasTwoDigits", () => {
    assert.deepEqual(extractYearRange("1939-45"), {
      start: 1939,
      end: 1945,
    });
    assert.deepEqual(extractYearRange("1951/52"), {
      start: 1951,
      end: 1952,
    });
  });
});
