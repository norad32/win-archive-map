export function updateStats(statsEl, shown, total) {
    statsEl.textContent = `Showing ${shown} of ${total} entries`;
}

export function updateLastUpdated(lastUpdatedEl, lastUpdated) {
    if (!lastUpdatedEl) return;
    const formatted = formatLastUpdated(lastUpdated);
    lastUpdatedEl.textContent = formatted ? `Last updated: ${formatted}` : "";
}

function formatLastUpdated(date) {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
