import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupFeatures } from "../src/js/data/grouping.js";

function buildLocations(pairs) {
  return new Map(pairs.map(([id, lon, lat]) => [id, [lon, lat]]));
}

describe("groupFeatures", () => {
  const locations = buildLocations([
    ["römerstrasse_8", 8.735, 47.5],
    ["römerstrasse_10", 8.7351, 47.5001],
    ["marktgasse_1", 8.72, 47.499],
  ]);

  it("groupFeatures_Should_CreateOneGroupPerLocation", () => {
    const entries = [
      { id: "1", loc: "römerstrasse_8", year: "1956" },
      { id: "2", loc: "römerstrasse_8", year: "1960" },
      { id: "3", loc: "marktgasse_1", year: "1970" },
    ];

    const groups = groupFeatures(entries, locations);

    assert.equal(groups.length, 2);
  });

  it("groupFeatures_Should_PlaceEntryOnEveryReferencedLocation_If_LocIsARange", () => {
    const entries = [{ id: "1", loc: ["römerstrasse_8", "römerstrasse_10"] }];

    const groups = groupFeatures(entries, locations);

    assert.equal(groups.length, 2);
    for (const group of groups) {
      assert.equal(group.entries.length, 1);
    }
  });

  it("groupFeatures_Should_SkipEntriesWithoutLoc", () => {
    const entries = [{ id: "1", loc: null }, { id: "2", loc: undefined }, {}];

    const groups = groupFeatures(entries, locations);

    assert.equal(groups.length, 0);
  });

  it("groupFeatures_Should_SkipLocReferencesWithoutCoordinates", () => {
    const entries = [{ id: "1", loc: "missing_house" }];

    const groups = groupFeatures(entries, locations);

    assert.equal(groups.length, 0);
  });

  it("groupFeatures_Should_SortGroupEntriesByYearAscending", () => {
    const entries = [
      { id: "1", loc: "römerstrasse_8", year: "1975" },
      { id: "2", loc: "römerstrasse_8", year: "1950" },
    ];

    const [group] = groupFeatures(entries, locations);

    assert.deepEqual(
      group.entries.map((entry) => entry.id),
      ["2", "1"],
    );
  });

  it("groupFeatures_Should_SortEntriesWithUnparsableYearFirst", () => {
    const entries = [
      { id: "1", loc: "römerstrasse_8", year: "1975" },
      { id: "2", loc: "römerstrasse_8", year: "um 1962" },
    ];

    const [group] = groupFeatures(entries, locations);

    assert.deepEqual(
      group.entries.map((entry) => entry.id),
      ["2", "1"],
    );
  });

  it("groupFeatures_Should_ExposeTheLocationIdAsGroupKey", () => {
    const [group] = groupFeatures(
      [{ id: "1", loc: "marktgasse_1" }],
      locations,
    );

    assert.equal(group.key, "marktgasse_1");
    assert.deepEqual(group.repCoord, [8.72, 47.499]);
  });

  it("groupFeatures_Should_SplitEntryByLocationPart_If_RangeCrossesBoundaries", () => {
    const entry = {
      id: "range-1",
      signature: "042119",
      title: "Bahnhofstrasse 1-5",
      locationParts: [
        {
          district: "Winterthur-Stadt",
          neighbourhood: "Altstadt",
          housenumbers: ["1", "3"],
          loc: ["bahnhofstrasse_1", "bahnhofstrasse_3"],
        },
        {
          district: "Veltheim",
          neighbourhood: "Rosenberg",
          housenumbers: ["5"],
          loc: ["bahnhofstrasse_5"],
        },
      ],
    };
    const coords = buildLocations([
      ["bahnhofstrasse_1", 8.7, 47.5],
      ["bahnhofstrasse_3", 8.701, 47.501],
      ["bahnhofstrasse_5", 8.702, 47.502],
    ]);

    const groups = groupFeatures([entry], coords);

    assert.equal(groups.length, 3);
    const altstadtGroup = groups.find((group) => group.key === "bahnhofstrasse_1");
    const veltheimGroup = groups.find((group) => group.key === "bahnhofstrasse_5");
    assert.equal(altstadtGroup.entries[0].district, "Winterthur-Stadt");
    assert.equal(altstadtGroup.entries[0].neighbourhood, "Altstadt");
    assert.equal(altstadtGroup.entries[0].housenumber, "1, 3");
    assert.equal(veltheimGroup.entries[0].district, "Veltheim");
    assert.equal(veltheimGroup.entries[0].neighbourhood, "Rosenberg");
    assert.equal(veltheimGroup.entries[0].housenumber, "5");
    assert.equal(altstadtGroup.entries[0].id, veltheimGroup.entries[0].id);
    assert.equal(altstadtGroup.entries[0].signature, veltheimGroup.entries[0].signature);
  });

  it("groupFeatures_Should_UseOriginalEntry_If_LocationPartsAreAbsent", () => {
    const entry = { id: "single-1", loc: "marktgasse_1", district: "Altstadt" };
    const [group] = groupFeatures([entry], locations);

    assert.equal(group.entries[0], entry);
  });

  it("groupFeatures_Should_NotDuplicateEntryWithinPart_If_SameLocRepeated", () => {
    const entry = {
      id: "range-2",
      locationParts: [
        { district: "Altstadt", neighbourhood: "Altstadt", loc: ["römerstrasse_8", "römerstrasse_8"] },
      ],
    };

    const groups = groupFeatures([entry], locations);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].entries.length, 1);
  });
});
