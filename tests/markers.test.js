import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Minimal Leaflet stub — markers.js only uses divIcon/marker.
globalThis.L = {
  divIcon: (options) => ({ options }),
  marker: (latlng, options) => {
    const marker = {
      latlng,
      options,
      handlers: {},
      on(event, handler) {
        this.handlers[event] = handler;
      },
      setIcon(icon) {
        this.options.icon = icon;
      },
      setZIndexOffset(offset) {
        this.options.zIndexOffset = offset;
      },
    };
    return marker;
  },
};

const { makePinIcon, makeClusterIcon, buildMarkersForGroups } =
  await import("../src/js/map/markers.js");
const { Config } = await import("../src/js/config.js");

function fakeMap() {
  return { getZoom: () => 13, flyTo: () => {} };
}

describe("makePinIcon", () => {
  it("makePinIcon_Should_UseMinSize_If_CountIsOne", () => {
    assert.equal(makePinIcon(1).options.iconSize[0], Config.PIN_MIN_SIZE);
  });

  it("makePinIcon_Should_UseMaxSize_If_CountReachesMaxCount", () => {
    assert.equal(
      makePinIcon(Config.PIN_MAX_COUNT).options.iconSize[0],
      Config.PIN_MAX_SIZE,
    );
  });

  it("makePinIcon_Should_ClampSize_If_CountExceedsMaxCount", () => {
    assert.equal(makePinIcon(100000).options.iconSize[0], Config.PIN_MAX_SIZE);
  });

  it("makePinIcon_Should_SizeBetweenMinAndMax_If_CountIsMidRange", () => {
    const size = makePinIcon(10).options.iconSize[0];
    assert.ok(size > Config.PIN_MIN_SIZE && size < Config.PIN_MAX_SIZE);
  });

  it("makePinIcon_Should_RenderLionSvg_If_Selected", () => {
    const icon = makePinIcon(5, { selected: true });

    assert.ok(icon.options.html.includes("pin-lion"));
    assert.ok(icon.options.className.includes("pin-marker--selected"));
    assert.equal(icon.options.iconSize[0], Config.LION_PIN_SIZE);
  });

  it("makePinIcon_Should_NotRenderLion_If_NotSelected", () => {
    const icon = makePinIcon(5);

    assert.ok(!icon.options.html.includes("pin-lion"));
    assert.ok(icon.options.html.includes("pin-hole"));
  });
});

describe("makeClusterIcon", () => {
  it("makeClusterIcon_Should_SizeBySummedEntryCount_If_ClusterHasChildren", () => {
    const cluster = {
      getAllChildMarkers: () => [
        { options: { entryCount: 3 } },
        { options: { entryCount: 7 } },
      ],
    };
    const icon = makeClusterIcon(cluster);

    assert.equal(icon.options.iconSize[0], makePinIcon(10).options.iconSize[0]);
  });

  it("makeClusterIcon_Should_AddCountTooltip_If_ClusterHasChildren", () => {
    const cluster = {
      getAllChildMarkers: () => [{ options: { entryCount: 4 } }],
    };
    const icon = makeClusterIcon(cluster);

    assert.ok(icon.options.html.includes("<title>4 entries</title>"));
  });
});

describe("buildMarkersForGroups", () => {
  const groups = [
    { key: "a", repCoord: [8.7, 47.5], entries: [{ id: "1" }, { id: "2" }] },
    { key: "b", repCoord: [8.71, 47.51], entries: [{ id: "3" }] },
  ];

  it("buildMarkersForGroups_Should_CreateOneMarkerPerGroup_If_Called", () => {
    const markers = buildMarkersForGroups(groups, () => {}, fakeMap());

    assert.equal(markers.length, 2);
  });

  it("buildMarkersForGroups_Should_RestoreLionIcon_If_GroupMatchesSelectedKey", () => {
    const markers = buildMarkersForGroups(groups, () => {}, fakeMap(), "b");

    assert.ok(markers[1].options.icon.options.html.includes("pin-lion"));
    assert.ok(!markers[0].options.icon.options.html.includes("pin-lion"));
  });

  it("buildMarkersForGroups_Should_SwapSelectedIconOnMarkerClick", () => {
    const markers = buildMarkersForGroups(groups, () => {}, fakeMap());

    markers[0].handlers["click"]();

    assert.ok(markers[0].options.icon.options.html.includes("pin-lion"));
    markers[1].handlers["click"]();
    assert.ok(markers[1].options.icon.options.html.includes("pin-lion"));
    assert.ok(!markers[0].options.icon.options.html.includes("pin-lion"));
  });

  it("buildMarkersForGroups_Should_CallOnClickWithGroup_If_MarkerClicked", () => {
    let clicked = null;
    const markers = buildMarkersForGroups(
      groups,
      (group) => (clicked = group),
      fakeMap(),
    );

    markers[1].handlers["click"]();

    assert.equal(clicked.key, "b");
  });

  it("buildMarkersForGroups_Should_FlyToMarker_If_MapProvided", () => {
    let flownTo = null;
    const map = { getZoom: () => 13, flyTo: (latlng) => (flownTo = latlng) };
    const markers = buildMarkersForGroups(groups, () => {}, map);

    markers[0].handlers["click"]();

    assert.deepEqual(flownTo, [47.5, 8.7]);
  });
});
