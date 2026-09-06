import { buildCustomLink, buildReportIssueUrl } from "./link-builder.js";

export function showDetails(detailsEl, entries) {
  detailsEl.innerHTML = "";

  if (!entries || entries.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder";
    placeholder.textContent = "No details available.";
    detailsEl.appendChild(placeholder);
    return;
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
