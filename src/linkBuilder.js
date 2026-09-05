import { Config } from "./config.js";

export function buildCustomLink(props) {
    const year = extractFirstYear(props.year);
    const street = props.street || "";
    const housenumber = extractFirstHouseNumber(props.housenumber);

    let district = props.district || "";
    if (district === "Other") {
        district = "";
    } else if (district === "Winterthur-Stadt") {
        district = "Altstadt";
    }

    const parts = [];
    if (housenumber !== "") parts.push(`HAUSNUMMER=${housenumber}`);
    if (!Number.isNaN(year)) parts.push(`JAHR=${year}`);
    if (district !== "") parts.push(`STADTKREIS=${district}`);
    if (street !== "") parts.push(`STRASSE=${street}`);

    const query = parts.join(" ");
    return `https://bilddatenbank.winterthur.ch/ims_publisher/images?query=${encodeURIComponent(query)}`;
}

export function buildReportIssueUrl(props) {
    const title = props.title || "Untitled entry";
    const issueTitle = `Incorrect metadata: ${title}`;

    const bodyLines = [
        "## Reported entry metadata",
        "",
        `- Title: ${props.title || "(none)"}`,
        `- Year: ${props.year || "(none)"}`,
        `- Street: ${props.street || "(none)"}`,
        `- House number: ${props.housenumber || "(none)"}`,
        `- District: ${props.district || "(none)"}`,
        "",
        "## What's incorrect?",
        "",
        "<!-- Please describe what's wrong and, if known, what the correct value should be. -->",
    ];
    const issueBody = bodyLines.join("\n");

    const params = new URLSearchParams({
        title: issueTitle,
        body: issueBody,
        labels: "metadata",
    });
    return `https://github.com/${Config.GITHUB_REPO}/issues/new?${params.toString()}`;
}

function extractFirstHouseNumber(housenumber) {
    if (!housenumber) return "";
    const match = String(housenumber).match(/\d+/);
    return match ? match[0] : "";
}

function extractFirstYear(rawYear) {
    if (!rawYear) return NaN;
    const match = String(rawYear).match(/\d{4}/);
    return match ? Number.parseInt(match[0], 10) : NaN;
}
