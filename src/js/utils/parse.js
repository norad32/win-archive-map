const CENTURY_RE = /(?:(anfang|mitte|ende|erste\s+hälfte(?:\s+des)?|1\.\s*hälfte(?:\s+des)?|zweite\s+hälfte(?:\s+des)?|2\.\s*hälfte(?:\s+des)?|letztes\s+drittel(?:\s+des)?)\s+)?(\d{1,2})\.?\s*(?:jahrhundert|jahrundert|jh\.?)/i;
const DECADE_RE = /(?:^|\D)(\d{2}|\d{4})\s*-?\s*er+(?:\s*-?\s*jahre)?/i;
const YEAR_INTERVAL_RE = /\b(\d{3,4})\s*[-–/]\s*(\d{2,4})\b/;
const FOUR_DIGIT_YEAR_RE = /\d{4}/;
const TWO_DIGIT_DATE_RE = /\b\d{1,2}\.\d{1,2}\.\s*(\d{2})\b/;
const INCOMPLETE_DAY_MONTH_YEAR_RE = /\b\d{1,2}\.\d{1,2}\.\s*(\d{1,3})(?=\D|$)/;
const THREE_DIGIT_YEAR_RE = /(?:^|\D)(\d{3})(?=\D|$)/;
const TWO_DIGIT_CENTURY_RE = /^\s*(1[5-9]|2[0-1])\s*$/;
const INCOMPLETE_PREFIX_YEAR_RE = /(?:^|\D)(\d{2})(?:\s*\(\.\.\)|\s*\[\.\.\]|\s*\.\.)/;

function centuryRange(century, qualifier = "") {
  const number = Number.parseInt(century, 10);
  if (!number || number > 30) return null;
  const start = (number - 1) * 100 + 1;
  const end = number * 100;
  const normalized = qualifier
    .toLowerCase()
    .replace(/\s+des$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const third = Math.floor((end - start + 1) / 3);
  if (/^(?:erste hälfte|1\. hälfte)$/.test(normalized)) {
    return { start, end: start + 49 };
  }
  if (/^(?:zweite hälfte|2\. hälfte)$/.test(normalized)) {
    return { start: start + 50, end };
  }
  if (normalized === "anfang") return { start, end: start + third - 1 };
  if (normalized === "mitte") return { start: start + third, end: end - third };
  if (normalized === "ende" || normalized === "letztes drittel") {
    return { start: end - third + 1, end };
  }
  return { start, end };
}

function expandShortYear(shortYear) {
  const year = Number.parseInt(shortYear, 10);
  return year <= 29 ? 2000 + year : 1900 + year;
}

function decadeRange(prefix) {
  const cleaned = prefix.replace(/[oO]/g, "0");
  const year = Number.parseInt(cleaned, 10);
  const start = cleaned.length === 2 ? 1900 + year : year;
  return { start, end: start + 9 };
}

function prefixYearRange(prefix) {
  const number = Number.parseInt(prefix, 10);
  const scale = 10 ** (4 - prefix.length);
  const start = number * scale;
  return { start, end: start + scale - 1 };
}

export function extractYearRange(rawYear) {
  if (rawYear == null || String(rawYear).trim() === "") return null;
  let text = String(rawYear).trim();
  if (/^(?:undatiert|unbekannt|\?)$/i.test(text)) return null;

  // Archive year values contain OCR substitutions in decade labels (e.g. 199oer).
  text = text.replace(/(?<=\d)[oO](?=er)/g, "0");

  const century = text.match(CENTURY_RE);
  if (century) return centuryRange(century[2], century[1] || "");
  const bareCentury = text.match(TWO_DIGIT_CENTURY_RE);
  if (bareCentury) return centuryRange(bareCentury[1]);

  // Open/incomplete century notation: 19(..), 19[..], 19.., 18../19..
  const openCenturies = text.match(/\b(\d{2})\s*(?:\(\.\.\)|\[\.\.\]|\.\.)\s*(?:bis\s*)?(?:\/\s*(\d{2})\s*(?:\(\.\.\)|\[\.\.\]|\.\.)\s*)?/i);
  if (openCenturies) {
    const first = prefixYearRange(openCenturies[1]);
    if (openCenturies[2]) {
      const last = prefixYearRange(openCenturies[2]);
      return { start: first.start, end: last.end };
    }
    return first;
  }
  const incompletePrefix = text.match(INCOMPLETE_PREFIX_YEAR_RE);
  if (incompletePrefix) return prefixYearRange(incompletePrefix[1]);

  const decade = text.match(DECADE_RE);
  if (decade) return decadeRange(decade[1]);

  // Numeric intervals support abbreviated end years: 1951/52, 1939-45.
  const interval = text.match(YEAR_INTERVAL_RE);
  if (interval) {
    const start = Number.parseInt(interval[1], 10);
    let end = Number.parseInt(interval[2], 10);
    if (interval[2].length === 2) {
      end = Math.floor(start / 100) * 100 + end;
      if (end < start) end += 100;
    }
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  const fourDigit = text.match(FOUR_DIGIT_YEAR_RE);
  if (fourDigit) {
    const year = Number.parseInt(fourDigit[0], 10);
    return { start: year, end: year };
  }

  const shortDate = text.match(TWO_DIGIT_DATE_RE);
  if (shortDate) {
    const year = expandShortYear(shortDate[1]);
    return { start: year, end: year };
  }

  // Best effort for truncated dates (e.g. 04.06.202) and years such as 197.
  const incompleteDate = text.match(INCOMPLETE_DAY_MONTH_YEAR_RE);
  if (incompleteDate) return prefixYearRange(incompleteDate[1]);
  const threeDigit = text.match(THREE_DIGIT_YEAR_RE);
  if (threeDigit) return prefixYearRange(threeDigit[1]);

  // Textual seasons/months without a year and unspecified dates have no range.
  return null;
}

export function extractFirstYear(rawYear) {
  return extractYearRange(rawYear)?.start ?? Number.NaN;
}
