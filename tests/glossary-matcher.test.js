import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  loadGlossary,
  normalize,
  findGlossaryMatches,
} from "../src/js/ui/glossary-matcher.js";

describe("loadGlossary", () => {
  const successfulFetch = () => ({
    ok: true,
    json: async () => [
      {
        title: "Lindengut",
        district: "Winterthur-Stadt",
        neighbourhood: "Altstadt",
        street: "Römerstrasse",
        address: "Römerstrasse 8",
        tags: "Lindengut, Römer",
      },
      {
        title: "Fotofabrik",
        tags: "Fotografie",
        address: "keine Nummer",
      },
    ],
  });

  beforeEach(() => {
    // The module caches its fetch result; reset it between tests.
    globalThis.fetch = successfulFetch;
  });

  // Runs first: the module caches the glossary after a successful load, so a
  // fetch failure can only be observed before any successful call.
  it("loadGlossary_Should_AllowRetry_If_FetchFailed", async () => {
    const payload = successfulFetch().json();
    let fail = true;
    globalThis.fetch = async () => ({
      ok: !fail,
      json: async () => (fail ? [] : payload),
    });

    await assert.rejects(() => loadGlossary());

    fail = false;
    const glossary = await loadGlossary();

    assert.equal(glossary.length, 2);
  });

  it("loadGlossary_Should_ReturnPreparedEntries_If_FetchSucceeds", async () => {
    const glossary = await loadGlossary();

    assert.equal(glossary.length, 2);
    assert.deepEqual(glossary[0]._streets, ["romerstrasse"]);
    assert.deepEqual(glossary[0]._addresses, [
      { street: "romerstrasse", housenumber: "8" },
    ]);
    assert.deepEqual(glossary[0]._tags, ["lindengut", "romer"]);
  });

  it("loadGlossary_Should_DropAddressesWithoutNumber_If_AddressHasNoDigits", async () => {
    const glossary = await loadGlossary();

    assert.deepEqual(glossary[1]._addresses, []);
  });

  it("loadGlossary_Should_CacheAndReturnSameInstance_If_CalledTwice", async () => {
    const first = await loadGlossary();
    const second = await loadGlossary();

    assert.equal(first, second);
  });
});

describe("glossary matching", () => {
  const glossary = [
    {
      title: "Lindengut",
      district: "Winterthur-Stadt",
      neighbourhood: "Altstadt",
      street: "Römerstrasse",
      address: "Römerstrasse 8",
      tags: "Lindengut, Römer",
    },
    {
      title: "Tösstal",
      district: "Töss",
      tags: "",
    },
  ].map((entry) => prepareEntry(entry));

  // Mirror of the prepare step in loadGlossary() (split + normalize).
  function prepareEntry(entry) {
    return {
      ...entry,
      _districts: split(entry.district).map(normalize),
      _neighbourhoods: split(entry.neighbourhood).map(normalize),
      _streets: split(entry.street).map(normalize),
      _addresses: split(entry.address)
        .map((part) => {
          const match = part.match(/^(.+?)\s+([\d].*)$/);
          return match
            ? { street: normalize(match[1]), housenumber: normalize(match[2]) }
            : null;
        })
        .filter(Boolean),
      _tags: split(entry.tags).map(normalize),
    };
  }

  function split(text) {
    if (!text) return [];
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  it("findGlossaryMatches_Should_MatchByTag_If_TitleContainsTag", () => {
    const matches = findGlossaryMatches(
      { title: "Römerstrasse 8, Lindengut, Museum" },
      glossary,
    );

    assert.deepEqual(
      matches.map((m) => m.title),
      ["Lindengut"],
    );
  });

  it("findGlossaryMatches_Should_MatchByStreetAndHousenumber_If_AddressMatches", () => {
    const matches = findGlossaryMatches(
      { title: "Ein Foto", street: "Römerstrasse", housenumber: "8" },
      glossary,
    );

    assert.deepEqual(
      matches.map((m) => m.title),
      ["Lindengut"],
    );
  });

  it("findGlossaryMatches_Should_MatchByAddressRange_If_HousenumberIsARange", () => {
    const rangeGlossary = [
      prepareEntry({
        title: "Areal",
        street: "Bahnstrasse",
        address: "Bahnstrasse 2-10",
      }),
    ];
    const matches = findGlossaryMatches(
      { title: "Areal", street: "Bahnstrasse", housenumber: "6" },
      rangeGlossary,
    );

    assert.deepEqual(
      matches.map((m) => m.title),
      ["Areal"],
    );
  });

  it("findGlossaryMatches_Should_NotMatchByAddress_If_EntryStreetDiffers", () => {
    const matches = findGlossaryMatches(
      { title: "Ein Foto", street: "Marktgasse", housenumber: "8" },
      glossary,
    );

    assert.deepEqual(
      matches.map((m) => m.title),
      [],
    );
  });

  it("findGlossaryMatches_Should_MatchByNeighbourhood_If_NeighbourhoodEquals", () => {
    const matches = findGlossaryMatches(
      { title: "Etwas anderes", neighbourhood: "Altstadt" },
      glossary,
    );

    assert.deepEqual(
      matches.map((m) => m.title),
      ["Lindengut"],
    );
  });

  it("findGlossaryMatches_Should_MatchByDistrict_If_DistrictEquals", () => {
    const matches = findGlossaryMatches(
      { title: "Etwas anderes", district: "Töss" },
      glossary,
    );

    assert.deepEqual(
      matches.map((m) => m.title),
      ["Tösstal"],
    );
  });

  it("findGlossaryMatches_Should_ReturnEmpty_If_NothingMatches", () => {
    const matches = findGlossaryMatches(
      { title: "Vögel im Wald", district: "Seen" },
      glossary,
    );

    assert.deepEqual(matches, []);
  });

  it("findGlossaryMatches_Should_ReturnEmpty_If_GlossaryIsEmpty", () => {
    assert.deepEqual(findGlossaryMatches({ title: "Lindengut" }, []), []);
  });

  it("findGlossaryMatches_Should_SortMatchesAlphabetically_If_MultipleMatch", () => {
    const sorted = findGlossaryMatches(
      { title: "Tösstal Lindengut", district: "Töss" },
      [glossary[1], glossary[0]],
    );

    assert.deepEqual(
      sorted.map((m) => m.title),
      ["Lindengut", "Tösstal"],
    );
  });
});

describe("normalize (used by the glossary matcher)", () => {
  it("normalize_Should_LowercaseAndStripAccents", () => {
    assert.equal(normalize("Römerstrasse"), "romerstrasse");
  });

  it("normalize_Should_CollapseWhitespace_If_TextHasMultipleSpaces", () => {
    assert.equal(normalize("  a   b  "), "a b");
  });

  it("normalize_Should_KeepSlashesAndDashes", () => {
    assert.equal(normalize("Werk 1/2 - Teil"), "werk 1/2 - teil");
  });

  it("normalize_Should_ReturnEmptyString_If_InputIsEmpty", () => {
    assert.equal(normalize(""), "");
    assert.equal(normalize(null), "");
  });
});
