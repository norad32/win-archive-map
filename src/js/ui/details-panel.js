import { el } from "../dom/dom-builder.js";
import { buildCustomLink, buildReportIssueUrl } from "../utils/link-builder.js";
import { loadGlossary, findGlossaryMatches } from "./glossary-matcher.js";

export function showError(detailsEl, message) {
  detailsEl.replaceChildren();
  detailsEl.append(
    el(
      "div",
      { className: "error-banner", role: "alert" },
      el("p", {}, message),
    ),
  );
}

export async function showDetails(detailsEl, entries) {
  detailsEl.replaceChildren();

  if (!entries || entries.length === 0) {
    detailsEl.append(
      el("p", { className: "placeholder" }, "No details available."),
    );
    return;
  }

  let glossary = [];
  try {
    glossary = await loadGlossary();
  } catch {
    detailsEl.append(
      el(
        "p",
        { className: "error-inline" },
        "Related glossary articles are unavailable right now.",
      ),
    );
  }

  const matches = collectGlossaryMatches(entries, glossary);
  if (matches.length > 0) {
    detailsEl.append(buildGlossarySection(matches));
  }

  entries.forEach((props, idx) => {
    detailsEl.append(buildEntryBlock(props));
    if (idx < entries.length - 1) {
      detailsEl.append(el("hr", { className: "entry-separator" }));
    }
  });
}

function collectGlossaryMatches(entries, glossary) {
  const unique = new Map();

  for (const props of entries) {
    for (const match of findGlossaryMatches(props, glossary)) {
      if (!unique.has(match.url)) {
        unique.set(match.url, match);
      }
    }
  }

  return [...unique.values()].sort((a, b) =>
    (a.title || "")
      .toLowerCase()
      .localeCompare((b.title || "").toLowerCase(), "de"),
  );
}

function buildEntryBlock(props) {
  const rows = [
    ["Year", props.year],
    ["Street", props.street],
    ["House number", props.housenumber],
    ["District", props.district],
    ["Neighbourhood", props.neighbourhood],
  ].map(([label, value]) =>
    el("tr", {}, [
      el("td", { className: "key" }, label),
      el("td", {}, value || ""),
    ]),
  );

  return el("div", { className: "entry-block" }, [
    el("h3", {}, props.title || "Untitled"),
    el("table", {}, rows),
    el("div", { className: "entry-links" }, [
      el(
        "a",
        {
          className: "gen-link",
          href: buildCustomLink(props),
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "Search in Bildarchiv Winterthur",
      ),
      el(
        "a",
        {
          className: "report-error-link",
          href: buildReportIssueUrl(props),
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "Report incorrect metadata",
      ),
    ]),
  ]);
}

function buildGlossarySection(matches) {
  return el("div", { className: "glossary-matches" }, [
    el("h3", {}, "Related Articles from the 'Winterthur Glossar'"),
    el(
      "ul",
      {},
      matches.map((match) =>
        el("li", {}, [
          el(
            "a",
            {
              href: match.url,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            match.subtitle ? `${match.title} — ${match.subtitle}` : match.title,
          ),
          match.category
            ? el(
                "span",
                { className: "glossary-category" },
                ` (${match.category})`,
              )
            : null,
        ]),
      ),
    ),
  ]);
}
