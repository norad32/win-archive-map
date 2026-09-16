export function extractFirstYear(rawYear) {
  if (!rawYear) return Number.NaN;
  const match = String(rawYear).match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : Number.NaN;
}
