/** @typedef {{ from: number, to: number, street?: string, district?: string, neighbourhood?: string, title?: string }} FilterCriteria */

export function createFilterPredicate(criteria) {
    const { from, to, street = "", district = "", neighbourhood = "", title = "" } = criteria;

    const normalizedStreet = street.trim().toLocaleLowerCase();
    const normalizedDistrict = district.trim().toLocaleLowerCase();
    const normalizedNeighbourhood = neighbourhood.trim().toLocaleLowerCase();
    const titleWords = title.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);

    return (props) =>
        yearInRange(props, from, to) &&
        streetIncludes(props, normalizedStreet) &&
        districtEquals(props, normalizedDistrict) &&
        neighbourhoodEquals(props, normalizedNeighbourhood) &&
        titleIncludesAllWords(props, titleWords);
}

function extractFirstYear(rawYear) {
    if (!rawYear) return NaN;
    const match = String(rawYear).match(/\d{4}/);
    return match ? Number.parseInt(match[0], 10) : NaN;
}

function yearInRange(props, from, to) {
    if (from === -Infinity && to === Infinity) return true;
    const year = extractFirstYear(props.year);
    return !Number.isNaN(year) && year >= from && year <= to;
}

function streetIncludes(props, street) {
    if (!street) return true;
    return String(props.street ?? "").trim().toLocaleLowerCase().includes(street);
}

function districtEquals(props, district) {
    if (!district) return true;
    return String(props.district ?? "").trim().toLocaleLowerCase() === district;
}

function neighbourhoodEquals(props, neighbourhood) {
    if (!neighbourhood) return true;
    return String(props.neighbourhood ?? "").trim().toLocaleLowerCase() === neighbourhood;
}

function titleIncludesAllWords(props, words) {
    if (words.length === 0) return true;
    const title = String(props.title ?? "").toLocaleLowerCase();
    return words.every((word) => title.includes(word));
}
