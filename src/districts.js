import { Config } from "./config.js";
import { populateSelect, setChildren } from "./dom-builder.js";

export async function loadDistricts(signal) {
    const res = await fetch(Config.DISTRICTS_URL, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data || {};
}

export function populateDistrictOptions(districtSelectEl, districtsData) {
    const keys = Object.keys(districtsData);
    const sorted = keys
        .filter((k) => k !== "")
        .sort((a, b) => a.localeCompare(b, "de", { numeric: true }));

    populateSelect(districtSelectEl, sorted, { allLabel: "All", allValue: "" });
}

export function populateStreetOptions(streetOptionsEl, districtsData, districtVal) {
    let strassen;
    if (districtVal === "") {
        const set = new Set();
        Object.values(districtsData).forEach((list) => {
            (list || []).forEach((s) => set.add(s));
        });
        strassen = Array.from(set);
    } else {
        strassen = districtsData[districtVal] || [];
    }

    const sorted = Array.from(new Set(strassen)).sort((a, b) =>
        a.localeCompare(b, "de"),
    );

    const options = sorted.map((s) => {
        const opt = document.createElement("option");
        opt.setAttribute("value", s);
        return opt;
    });

    setChildren(streetOptionsEl, options);
}
