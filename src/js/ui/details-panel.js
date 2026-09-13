import { buildCustomLink, buildReportIssueUrl } from "./link-builder.js";
import { loadGlossary, findGlossaryMatches } from "./glossary-matcher.js";

export async function showDetails(detailsEl, entries) {
  detailsEl.innerHTML = "";

  if (!entries || entries.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder";
    placeholder.textContent = "No details available.";
    detailsEl.appendChild(placeholder);
    return;
  }

  // Load glossary once (cached after first call)
  let glossary = [];
  try {
    glossary = await loadGlossary();
  } catch (err) {
    console.warn("Glossary could not be loaded:", err);
  }

  // Collect matches across all displayed (filtered) entries, dedupe by URL
  const combinedMatches = new Map(); // url -> match
  entries.forEach((props) => {
    const matches = findGlossaryMatches(props, glossary);
    matches.forEach((match) => {
      if (!combinedMatches.has(match.url)) {
        combinedMatches.set(match.url, match);
      }
    });
  });

  const sortedMatches = Array.from(combinedMatches.values()).sort((a, b) =>
    (a.title || "")
      .toLowerCase()
      .localeCompare((b.title || "").toLowerCase(), "de"),
  );

  if (sortedMatches.length > 0) {
    detailsEl.appendChild(buildGlossarySection(sortedMatches));
  }

  entries.forEach((props, idx) => {
    detailsEl.appendChild(buildEntryBlock(props));
    if (idx < entries.length - 1) {
      const hr = document.createElement("hr");
      hr.className = "entry-separator";
      detailsEl.appendChild(hr);
    }
  });
}

function buildEntryBlock(props) {
  const block = document.createElement("div");
  block.className = "entry-block";

  const heading = document.createElement("h3");
  heading.textContent = props.title || "Untitled";
  block.appendChild(heading);

  const table = document.createElement("table");
  const rows = [
    ["Year", props.year || ""],
    ["Street", props.street || ""],
    ["House number", props.housenumber || ""],
    ["District", props.district || ""],
    ["Neighbourhood", props.neighbourhood || ""],
  ];

  for (const [label, value] of rows) {
    const tr = document.createElement("tr");
    const keyCell = document.createElement("td");
    keyCell.className = "key";
    keyCell.textContent = label;
    const valueCell = document.createElement("td");
    valueCell.textContent = value;
    tr.append(keyCell, valueCell);
    table.appendChild(tr);
  }
  block.appendChild(table);

  const linkRow = document.createElement("div");
  linkRow.className = "entry-links";

  const link = document.createElement("a");
  link.className = "gen-link";
  link.href = buildCustomLink(props);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Search in Bildarchiv Winterthur";
  linkRow.appendChild(link);

  const reportLink = document.createElement("a");
  reportLink.className = "report-error-link";
  reportLink.href = buildReportIssueUrl(props);
  reportLink.target = "_blank";
  reportLink.rel = "noopener noreferrer";
  reportLink.textContent = "Report incorrect metadata";
  linkRow.appendChild(reportLink);

  block.appendChild(linkRow);
  return block;
}

function buildGlossarySection(matches) {
  const wrapper = document.createElement("div");
  wrapper.className = "glossary-matches";

  const heading = document.createElement("h3");
  heading.textContent = "Related Articles from the 'Winterthur Glossar'";
  wrapper.appendChild(heading);

  const list = document.createElement("ul");
  matches.forEach((match) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = match.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = match.subtitle
      ? `${match.title} — ${match.subtitle}`
      : match.title;
    li.appendChild(a);
    if (match.category) {
      const span = document.createElement("span");
      span.className = "glossary-category";
      span.textContent = ` (${match.category})`;
      li.appendChild(span);
    }
    list.appendChild(li);
  });
  wrapper.appendChild(list);

  return wrapper;
}
