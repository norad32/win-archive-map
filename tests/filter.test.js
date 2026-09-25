import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFilters } from "../src/js/ui/filter.js";

function input(value = "") {
  return { value, listeners: {} };
}

const FILTER_DEBOUNCE_MS = 300;

function buildSetup({ entries, groups, unlocated = [] }) {
  const domRefs = {
    yearFromEl: input(),
    yearToEl: input(),
    streetInputEl: input(),
    districtSelectEl: input(),
    neighbourhoodSelectEl: input(),
    titleSearchEl: input(),
  };
  const dataStore = {
    isLoaded: () => true,
    getGroups: () => groups,
    getUnlocatedEntries: () => unlocated,
    getTotalCount: () => entries.length,
  };
  let rendered = null;
  const map = { renderGroups: (g) => (rendered = g) };

  let stats = null;
  const filters = createFilters({
    domRefs,
    dataStore,
    map,
    onStatsUpdate: (shown, total) => (stats = { shown, total }),
  });

  async function runFilterNow() {
    filters.applyFilters();
    await new Promise((resolve) =>
      setTimeout(resolve, FILTER_DEBOUNCE_MS + 50),
    );
  }

  return {
    domRefs,
    filters,
    getRendered: () => rendered,
    getStats: () => stats,
    runFilterNow,
  };
}

const GROUPS = [
  {
    key: "römerstrasse_8",
    repCoord: [8.735, 47.5],
    entries: [
      {
        id: "1",
        title: "Römerstrasse 8, Lindengut",
        year: "1956",
        street: "Römerstrasse",
        district: "Winterthur-Stadt",
        neighbourhood: "Altstadt",
      },
      {
        id: "2",
        title: "Römerstrasse 8, Renovation",
        year: "1970",
        street: "Römerstrasse",
        district: "Winterthur-Stadt",
        neighbourhood: "Altstadt",
      },
    ],
  },
  {
    key: "marktgasse_1",
    repCoord: [8.72, 47.499],
    entries: [
      {
        id: "3",
        title: "Marktgasse 1, Apotheker",
        year: "1930",
        street: "Marktgasse",
        district: "Winterthur-Stadt",
        neighbourhood: "Altstadt",
      },
    ],
  },
];

const UNLOCATED = [
  {
    id: "4",
    title: "Waldfriedhof",
    year: "1945",
    street: null,
    district: "Other",
  },
];

describe("createFilters", () => {
  it("createFilters_Should_ShowAllEntries_If_NoFilterCriteria", async () => {
    const { filters, runFilterNow, getRendered, getStats } = buildSetup({
      entries: GROUPS.flatMap((g) => g.entries),
      groups: GROUPS,
      unlocated: UNLOCATED,
    });

    await runFilterNow();

    // 3 located entries in groups + 1 unlocated entry
    assert.equal(getStats().shown, 4);
    assert.equal(getStats().total, 3);
    assert.equal(getRendered().length, 2);
  });

  it("createFilters_Should_FilterByYear_If_RangeSet", async () => {
    const { domRefs, filters, runFilterNow, getRendered } = buildSetup({
      entries: [],
      groups: GROUPS,
    });
    domRefs.yearFromEl.value = "1940";
    domRefs.yearToEl.value = "1960";

    await runFilterNow();

    const shown = getRendered().flatMap((g) => g.entries);
    assert.deepEqual(
      shown.map((e) => e.id),
      ["1"],
    );
  });

  it("createFilters_Should_FilterByStreet_If_StreetSet", async () => {
    const { domRefs, filters, runFilterNow, getRendered } = buildSetup({
      entries: [],
      groups: GROUPS,
    });
    domRefs.streetInputEl.value = "Marktgasse";

    await runFilterNow();

    assert.deepEqual(
      getRendered().flatMap((g) => g.entries.map((e) => e.id)),
      ["3"],
    );
  });

  it("createFilters_Should_FilterByDistrictAndNeighbourhood_If_Set", async () => {
    const { domRefs, filters, runFilterNow, getRendered } = buildSetup({
      entries: [],
      groups: GROUPS,
    });
    domRefs.districtSelectEl.value = "Winterthur-Stadt";
    domRefs.neighbourhoodSelectEl.value = "Altstadt";

    await runFilterNow();

    assert.equal(getRendered().length, 2);
  });

  it("createFilters_Should_MatchAllTitleWords_If_MultipleWordsEntered", async () => {
    const { domRefs, filters, runFilterNow, getRendered } = buildSetup({
      entries: [],
      groups: GROUPS,
    });
    domRefs.titleSearchEl.value = "römerstrasse lindengut";

    await runFilterNow();

    assert.deepEqual(
      getRendered().flatMap((g) => g.entries.map((e) => e.id)),
      ["1"],
    );
  });

  it("createFilters_Should_CountEntryOnce_If_LocSpansSeveralHouses", async () => {
    const entry = {
      id: "1",
      title: "Haus 31-35",
      year: "1950",
      street: "Street",
      signature: "sig-1",
    };
    const multiGroups = ["31", "33", "35"].map((number) => ({
      key: `street_${number}`,
      repCoord: [8.7, 47.5],
      entries: [{ ...entry }],
    }));
    const { filters, runFilterNow, getStats, getRendered } = buildSetup({
      entries: [entry],
      groups: multiGroups,
    });

    await runFilterNow();

    assert.equal(getRendered().length, 3);
    assert.equal(getStats().shown, 1);
  });

  it("createFilters_Should_CountOneArchiveEntryOnce_If_LocationIsSplitByBoundaries", async () => {
    const base = {
      id: "2",
      signature: "sig-2",
      title: "Bahnhofstrasse 1-5",
      year: "1950",
      street: "Bahnhofstrasse",
    };
    const splitGroups = [
      {
        key: "bahnhofstrasse_1",
        repCoord: [8.7, 47.5],
        entries: [{ ...base, district: "Winterthur-Stadt", neighbourhood: "Altstadt", housenumber: "1, 3" }],
      },
      {
        key: "bahnhofstrasse_5",
        repCoord: [8.702, 47.502],
        entries: [{ ...base, district: "Veltheim", neighbourhood: "Rosenberg", housenumber: "5" }],
      },
    ];
    const { filters, runFilterNow, getStats, getRendered } = buildSetup({
      entries: [base],
      groups: splitGroups,
    });

    await runFilterNow();

    assert.equal(getRendered().length, 2);
    assert.equal(getStats().shown, 1);
  });

  it("createFilters_Should_FilterSplitEntryByPartDistrict_If_DistrictSelected", async () => {
    const base = {
      id: "2",
      signature: "sig-2",
      title: "Bahnhofstrasse 1-5",
      year: "1950",
      street: "Bahnhofstrasse",
    };
    const groups = [
      {
        key: "bahnhofstrasse_1",
        repCoord: [8.7, 47.5],
        entries: [{ ...base, district: "Winterthur-Stadt", neighbourhood: "Altstadt", housenumber: "1, 3" }],
      },
      {
        key: "bahnhofstrasse_5",
        repCoord: [8.702, 47.502],
        entries: [{ ...base, district: "Töss", neighbourhood: "Schlosstal", housenumber: "5" }],
      },
    ];
    const { domRefs, filters, runFilterNow, getRendered, getStats } = buildSetup({
      entries: [base],
      groups,
    });
    domRefs.districtSelectEl.value = "Töss";

    await runFilterNow();

    assert.deepEqual(getRendered().map((group) => group.key), ["bahnhofstrasse_5"]);
    assert.equal(getRendered()[0].entries[0].housenumber, "5");
    assert.equal(getStats().shown, 1);
  });

  it("createFilters_Should_CountSeparateSignaturesSeparately_If_IdsAreShared", async () => {
    const base = { id: "3", title: "Shared id", year: "1950", street: "Street" };
    const entries = [
      { ...base, signature: "sig-a" },
      { ...base, signature: "sig-b" },
    ];
    const groups = [
      {
        key: "street_1",
        repCoord: [8.7, 47.5],
        entries: entries.map((entry) => ({ ...entry })),
      },
      {
        key: "street_2",
        repCoord: [8.71, 47.51],
        entries: entries.map((entry) => ({ ...entry })),
      },
    ];
    const { filters, runFilterNow, getStats } = buildSetup({ entries, groups });

    await runFilterNow();

    assert.equal(getStats().shown, 2);
  });

  it("createFilters_Should_CountMatchingUnlocatedEntries_If_UnlocatedPresent", async () => {
    const { filters, runFilterNow, getStats } = buildSetup({
      entries: [],
      groups: GROUPS,
      unlocated: UNLOCATED,
    });
    await runFilterNow();

    assert.equal(getStats().shown, 4);
  });

  it("createFilters_Should_CountMatchingUnlocatedEntries_If_TitleFilterMatches", async () => {
    const { domRefs, filters, runFilterNow, getStats } = buildSetup({
      entries: [],
      groups: GROUPS,
      unlocated: UNLOCATED,
    });
    domRefs.titleSearchEl.value = "Waldfriedhof";

    await runFilterNow();

    assert.equal(getStats().shown, 1);
  });

  it("createFilters_Should_SkipEmptyGroups_If_NoEntryMatches", async () => {
    const { domRefs, filters, runFilterNow, getRendered } = buildSetup({
      entries: [],
      groups: GROUPS,
    });
    domRefs.titleSearchEl.value = "Apotheker";

    await runFilterNow();

    assert.deepEqual(
      getRendered().map((g) => g.key),
      ["marktgasse_1"],
    );
  });

  it("createFilters_Should_PassGroupKeyAndCoordThrough_If_GroupRendered", async () => {
    const { filters, runFilterNow, getRendered } = buildSetup({
      entries: [],
      groups: GROUPS,
    });

    await runFilterNow();

    const [group] = getRendered();
    assert.equal(group.key, "römerstrasse_8");
    assert.deepEqual(group.repCoord, [8.735, 47.5]);
  });

  it("createFilters_Should_NotRun_If_DataNotLoaded", async () => {
    const domRefs = {
      yearFromEl: input(),
      yearToEl: input(),
      streetInputEl: input(),
      districtSelectEl: input(),
      neighbourhoodSelectEl: input(),
      titleSearchEl: input(),
    };
    let rendered = null;
    const filters = createFilters({
      domRefs,
      dataStore: {
        isLoaded: () => false,
        getGroups: () => GROUPS,
        getUnlocatedEntries: () => [],
        getTotalCount: () => 3,
      },
      map: { renderGroups: (g) => (rendered = g) },
    });

    filters.applyFilters();

    assert.equal(rendered, null);
  });
});
