import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Config } from "../src/js/config.js";

describe("Config", () => {
  it("Config_Should_DefinePinSizing_WithMinSmallerThanMax", () => {
    assert.ok(Config.PIN_MIN_SIZE > 0);
    assert.ok(Config.PIN_MIN_SIZE < Config.PIN_MAX_SIZE);
    assert.ok(Config.LION_PIN_SIZE > Config.PIN_MAX_SIZE);
    assert.ok(Config.PIN_MAX_COUNT >= 1);
  });

  it("Config_Should_HaveMaxZoomAtLeastMaxNativeZoom", () => {
    assert.ok(Config.MAP_MAX_ZOOM >= Config.MAP_MAX_NATIVE_ZOOM);
  });

  it("Config_Should_ContainDataUrls_If_AppLoadsRemoteData", () => {
    for (const key of ["ARCHIVE_URL", "ADDRESSES_URL", "LOCATIONS_URL"]) {
      assert.match(Config[key], /^data\//);
    }
  });
});
