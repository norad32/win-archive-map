import { Config } from "../config.js";

let glossaryData = null;
let glossaryLoadPromise = null;

export async function loadGlossary() {
  if (glossaryData) return glossaryData;
  if (glossaryLoadPromise) return glossaryLoadPromise;

  glossaryLoadPromise = (async () => {
    const res = await fetch(Config.GLOSSARY_URL);
    if (!res.ok) throw new Error(`Failed to load glossary: ${res.status}`);
    const data = await res.json();

    glossaryData = data.map((entry) => ({
      ...entry,
      _districts: splitCommaSeparatedString(entry.district).map(normalize),
      _neighbourhoods: splitCommaSeparatedString(entry.neighbourhood).map(
        normalize,
      ),
      _streets: splitCommaSeparatedString(entry.street).map(normalize),
      _addresses: parseAddressList(entry.address),
      _tags: splitCommaSeparatedString(entry.tags).map(normalize),
    }));

    return glossaryData;
  })().catch((err) => {
    glossaryLoadPromise = null;
    throw err;
  });

  return glossaryLoadPromise;
}

function normalize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^\w\s\/-]/g, " ") // keep '-' and '/' for number ranges
    .replace(/\s+/g, " ")
    .trim();
}

function splitCommaSeparatedString(text) {
  if (!text) return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAddressList(text) {
  const parts = splitCommaSeparatedString(text);
  const addresses = [];

  for (const part of parts) {
    const match = part.match(/^(.+?)\s+([\d].*)$/);
    if (!match) continue;
    const street = normalize(match[1]);
    const housenumber = normalize(match[2]);
    if (street && housenumber) {
      addresses.push({ street, housenumber });
    }
  }

  return addresses;
}

function parseHousenumbers(token) {
  if (!token) return [];
  const numbers = new Set();

  const parts = token.split(/[+/]/);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);

      const startParity = start % 2;
      const endParity = end % 2;
      // Same parity (e.g. "10-20") => only same-parity numbers in range.
      // Mixed parity (e.g. "10-11") => treat as a full inclusive range.
      const sameParity = startParity === endParity;

      for (let n = lo; n <= hi; n++) {
        if (!sameParity || n % 2 === startParity) numbers.add(n);
      }
    } else {
      const plain = parseInt(part, 10);
      if (!Number.isNaN(plain)) numbers.add(plain);
    }
  }

  return [...numbers];
}

function matchesAddress(entry, street, housenumber) {
  if (!street || !housenumber) return false;
  if (entry._addresses.length === 0) return false;

  const targetNumbers = new Set(parseHousenumbers(housenumber));
  if (targetNumbers.size === 0) return false;

  for (const addr of entry._addresses) {
    if (addr.street !== street) continue;
    const entryNumbers = parseHousenumbers(addr.housenumber);
    if (entryNumbers.some((n) => targetNumbers.has(n))) return true;
  }

  return false;
}

function matchesStreet(entry, street) {
  if (!street) return false;
  return entry._streets.includes(street);
}

function matchesTags(entry, normTitle) {
  if (!normTitle) return false;
  return entry._tags.some((tag) => tag && normTitle.includes(tag));
}

function matchesDistrictOrNeighbourhood(entry, district, neighbourhood) {
  const normDistrict = normalize(district);
  const normNeighbourhood = normalize(neighbourhood);

  return (
    (!!normDistrict && entry._districts.includes(normDistrict)) ||
    (!!normNeighbourhood && entry._neighbourhoods.includes(normNeighbourhood))
  );
}

function compareAlphabetically(a, b) {
  const titleA = (a.title || "").toLowerCase();
  const titleB = (b.title || "").toLowerCase();
  return titleA.localeCompare(titleB, "de");
}

export function findGlossaryMatches(props, glossary) {
  if (!glossary || glossary.length === 0) return [];

  const normTitle = normalize(props.title);
  const street = normalize(props.street);
  const housenumber = normalize(props.housenumber);

  const results = glossary.filter(
    (entry) =>
      matchesAddress(entry, street, housenumber) ||
      matchesStreet(entry, street) ||
      matchesTags(entry, normTitle) ||
      matchesDistrictOrNeighbourhood(
        entry,
        props.district,
        props.neighbourhood,
      ),
  );

  return results.sort(compareAlphabetically);
}
