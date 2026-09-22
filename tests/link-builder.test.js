import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCustomLink,
  buildReportIssueUrl,
} from "../src/js/utils/link-builder.js";

describe("buildCustomLink", () => {
  it("buildCustomLink_Should_BuildArchiveQueryUrl_If_AllFieldsPresent", () => {
    const url = buildCustomLink({
      street: "Römerstrasse",
      housenumber: "8",
      year: "1956",
    });

    assert.ok(
      url.startsWith(
        "https://bilddatenbank.winterthur.ch/ims_publisher/images?query=",
      ),
    );
    const query = decodeURIComponent(new URL(url).searchParams.get("query"));
    assert.deepEqual(query.split(" ").sort(), [
      "HAUSNUMMER=8",
      "JAHR=1956",
      "STRASSE=Römerstrasse",
    ]);
  });

  it("buildCustomLink_Should_ExtractFirstYear_If_YearIsARange", () => {
    const query = decodeURIComponent(
      new URL(buildCustomLink({ year: "1950-1960" })).searchParams.get("query"),
    );

    assert.equal(query, "JAHR=1950");
  });

  it("buildCustomLink_Should_OmitEmptyParts_If_FieldsAreMissing", () => {
    const query = decodeURIComponent(
      new URL(buildCustomLink({})).searchParams.get("query"),
    );

    assert.equal(query, "");
  });

  it("buildCustomLink_Should_UseFirstNumberOnly_If_HousenumberIsAComposite", () => {
    const query = decodeURIComponent(
      new URL(buildCustomLink({ housenumber: "31-35" })).searchParams.get(
        "query",
      ),
    );

    assert.equal(query, "HAUSNUMMER=31");
  });
});

describe("buildReportIssueUrl", () => {
  it("buildReportIssueUrl_Should_BuildGitHubIssueUrl_If_Called", () => {
    const url = buildReportIssueUrl({ title: "Römerstrasse 8", year: "1956" });

    assert.ok(
      url.startsWith("https://github.com/norad32/win-archive-map/issues/new?"),
    );
    const params = new URL(url).searchParams;
    assert.ok(params.get("title").includes("Römerstrasse 8"));
    assert.ok(params.get("body").includes("1956"));
    assert.equal(params.get("labels"), "metadata");
  });

  it("buildReportIssueUrl_Should_Untitled_If_TitleIsMissing", () => {
    const params = new URL(buildReportIssueUrl({})).searchParams;

    assert.ok(params.get("title").includes("Untitled entry"));
  });
});
